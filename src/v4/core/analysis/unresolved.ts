/**
 * Unresolved variable detection
 * Detects CSS variables with var() references that couldn't be resolved
 */

import type { CSSVariable } from '../../types';

/**
 * Compiled regex pattern for var() reference extraction (global flag)
 */
const VAR_REFERENCE_REGEX_GLOBAL = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g;

/**
 * Compiled regex pattern for var() reference testing (non-global)
 */
const VAR_REFERENCE_REGEX_TEST = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/;

/**
 * Represents an unresolved CSS variable reference
 */
export interface UnresolvedVariable {
  /** Original variable name (e.g., '--font-sans') */
  variableName: string;
  /** Original value containing var() (e.g., 'var(--font-geist-sans)') */
  originalValue: string;
  /** Referenced variable name (e.g., '--font-geist-sans') */
  referencedVariable: string;
  /** Fallback value if provided in var() */
  fallbackValue?: string;
  /** Source of the variable ('theme', 'root', 'variant') */
  source: 'theme' | 'root' | 'variant';
  /** Variant name if source is 'variant' */
  variantName?: string;
  /** CSS selector if from variant */
  selector?: string;
  /** Likely cause of unresolved reference */
  likelyCause: UnresolvedCause;
}

/**
 * Categories of unresolved variable causes
 */
export type UnresolvedCause =
  | 'external' // External reference (runtime injection, plugins, other stylesheets)
  | 'self-referential' // Self-referential variables (intentionally skipped)
  | 'unknown'; // Unknown cause

/**
 * Determines the likely cause of an unresolved variable
 *
 * @param referencedVar - The variable that couldn't be resolved
 * @param isSelfReferential - Whether the variable references itself
 * @returns Likely cause category
 */
function determineLikelyCause(
  referencedVar: string,
  isSelfReferential: boolean,
): UnresolvedCause {
  if (isSelfReferential) {
    return 'self-referential';
  }

  // Tailwind-specific prefixes indicate plugin/framework variables
  if (referencedVar.startsWith('--tw-')) {
    return 'external';
  }

  // Everything else is considered external (could be runtime injection,
  // external stylesheets, missing variables, etc.)
  return 'unknown';
}

/**
 * Extracts all var() references from a CSS value
 *
 * @param value - CSS value that may contain var() references
 * @returns Array of {variable, fallback} tuples
 */
function extractAllVarReferences(
  value: string,
): Array<{ variable: string; fallback?: string }> {
  const references: Array<{ variable: string; fallback?: string }> = [];
  const matches = value.matchAll(VAR_REFERENCE_REGEX_GLOBAL);

  for (const match of matches) {
    const variable = match[1];
    const fallback = match[2];

    if (variable !== undefined) {
      references.push({
        variable,
        fallback: fallback?.trim(),
      });
    }
  }

  return references;
}

/**
 * Checks if a variable reference was successfully resolved
 *
 * @param resolvedValue - Value after resolution attempt
 * @returns True if variable is still unresolved
 */
function isStillUnresolved(resolvedValue: string): boolean {
  // Check if resolved value still contains var() references
  // Use non-global regex to avoid lastIndex state issues
  return VAR_REFERENCE_REGEX_TEST.test(resolvedValue);
}

/**
 * Creates a unique key for a variable including variant context
 * Extracted to avoid repeated string concatenation in hot path
 *
 * @param name - Variable name
 * @param variantName - Optional variant name
 * @returns Unique key string
 */
function createVariableKey(name: string, variantName?: string): string {
  return variantName !== undefined ? `${name}:${variantName}` : name;
}

/**
 * Detects unresolved variable references in CSS variables
 *
 * Compares original variables with resolved variables to identify
 * var() references that couldn't be resolved.
 *
 * @param originalVariables - Variables before resolution
 * @param resolvedVariables - Variables after resolution attempt
 * @returns Array of unresolved variable references
 */
export function detectUnresolvedVariables(
  originalVariables: Array<CSSVariable>,
  resolvedVariables: Array<CSSVariable>,
): Array<UnresolvedVariable> {
  const unresolved: Array<UnresolvedVariable> = [];

  // Create map of resolved variables for O(1) lookup
  const resolvedMap = new Map<string, CSSVariable>();
  for (const variable of resolvedVariables) {
    const key = createVariableKey(variable.name, variable.variantName);
    resolvedMap.set(key, variable);
  }

  for (const original of originalVariables) {
    // Skip if original value doesn't contain var()
    if (!original.value.includes('var(')) {
      continue;
    }

    // Find corresponding resolved variable
    const key = createVariableKey(original.name, original.variantName);
    const resolved = resolvedMap.get(key);

    // If no resolved version found, variable was likely filtered out
    if (resolved === undefined) {
      continue;
    }

    // Check if resolution failed (still contains var() references)
    if (!isStillUnresolved(resolved.value)) {
      continue;
    }

    // Extract var() references from the resolved value (what's still unresolved)
    const varRefs = extractAllVarReferences(resolved.value);

    for (const { variable: referencedVar, fallback } of varRefs) {
      // Check if this is a self-referential variable (compare to original name)
      const isSelfReferential = referencedVar === original.name;

      const likelyCause = determineLikelyCause(
        referencedVar,
        isSelfReferential,
      );

      unresolved.push({
        variableName: original.name,
        originalValue: original.value,
        referencedVariable: referencedVar,
        fallbackValue: fallback,
        source: original.source,
        variantName: original.variantName,
        selector: original.selector,
        likelyCause,
      });
    }
  }

  return unresolved;
}

/**
 * Groups unresolved variables by their likely cause
 *
 * @param unresolved - Array of unresolved variables
 * @returns Map of cause to unresolved variables
 */
export function groupByLikelyCause(
  unresolved: Array<UnresolvedVariable>,
): Map<UnresolvedCause, Array<UnresolvedVariable>> {
  const grouped = new Map<UnresolvedCause, Array<UnresolvedVariable>>();

  for (const item of unresolved) {
    const existing = grouped.get(item.likelyCause);
    if (existing !== undefined) {
      existing.push(item);
    } else {
      grouped.set(item.likelyCause, [item]);
    }
  }

  return grouped;
}

/**
 * Groups unresolved variables by source
 *
 * @param unresolved - Array of unresolved variables
 * @returns Map of source to unresolved variables
 */
export function groupBySource(
  unresolved: Array<UnresolvedVariable>,
): Map<'theme' | 'root' | 'variant', Array<UnresolvedVariable>> {
  const grouped = new Map<
    'theme' | 'root' | 'variant',
    Array<UnresolvedVariable>
  >();

  for (const item of unresolved) {
    const existing = grouped.get(item.source);
    if (existing !== undefined) {
      existing.push(item);
    } else {
      grouped.set(item.source, [item]);
    }
  }

  return grouped;
}
