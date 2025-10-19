/**
 * CSS rule conflict detection and resolution
 * Analyzes CSS rules against theme variables to detect overrides
 */

import type { Theme } from '../types';
import type { CSSRuleOverride } from './css-rule-extractor';

import { mapPropertyToTheme } from './css-rule-extractor';

/**
 * Represents a conflict between a CSS rule and a theme variable
 */
export interface CSSRuleConflict {
  /** Variant name where conflict occurs */
  variantName: string;
  /** Theme property affected (e.g., 'radius', 'shadows') */
  themeProperty: keyof Theme;
  /** Theme key affected (e.g., 'lg', 'md') */
  themeKey: string;
  /** Value from CSS variable */
  variableValue: string;
  /** Value from CSS rule */
  ruleValue: string;
  /** CSS selector that triggers the rule */
  ruleSelector: string;
  /** Whether we can safely resolve this conflict */
  canResolve: boolean;
  /** Confidence level for resolution */
  confidence: 'high' | 'medium' | 'low';
  /** Original CSS rule override */
  cssRule: CSSRuleOverride;
}

/**
 * Checks if two values have mismatched units
 * @param ruleValue - Value from CSS rule
 * @param variableValue - Value from CSS variable
 * @returns True if units mismatch
 */
function hasUnitMismatch(ruleValue: string, variableValue: string): boolean {
  // Extract units from both values
  const ruleUnit = ruleValue.match(/(px|rem|em|%|vh|vw)$/)?.[1];
  const varUnit = variableValue.match(/(px|rem|em|%|vh|vw)$/)?.[1];

  // If both have units and they differ, it's a mismatch
  if (ruleUnit !== undefined && varUnit !== undefined && ruleUnit !== varUnit) {
    return true;
  }

  return false;
}

/**
 * Calculates confidence level for applying a CSS rule override
 * @param rule - CSS rule override
 * @param variableValue - Current value from theme variable
 * @returns Confidence level
 */
function calculateConfidence(
  rule: CSSRuleOverride,
  variableValue: string,
): 'high' | 'medium' | 'low' {
  // High confidence: Simple static value, no unit mismatches
  if (
    rule.complexity === 'simple' &&
    !hasUnitMismatch(rule.value, variableValue)
  ) {
    return 'high';
  }

  // Medium confidence: Simple but different unit types
  if (rule.complexity === 'simple') {
    return 'medium';
  }

  // Low confidence: Complex rule
  return 'low';
}

/**
 * Detects conflicts between CSS rules and theme variables
 *
 * Analyzes CSS rules extracted from variant selectors and compares them
 * against the theme structure to identify conflicts/overrides.
 *
 * @param cssRules - Array of CSS rule overrides from variants
 * @param variants - Theme variants object
 * @returns Array of detected conflicts
 */
export function detectConflicts(
  cssRules: Array<CSSRuleOverride>,
  variants: Record<string, { selector: string; theme: Theme }>,
): Array<CSSRuleConflict> {
  const conflicts: Array<CSSRuleConflict> = [];

  for (const rule of cssRules) {
    // Map CSS property to theme namespace
    const mapping = mapPropertyToTheme(rule.property);
    if (mapping === null) {
      continue;
    }

    // Extract theme key from selector
    const themeKey = mapping.keyExtractor(rule.selector);
    if (themeKey === null) {
      continue;
    }

    // Find the variant this rule belongs to
    const variant = Object.entries(variants).find(
      ([_key, val]) => val.selector === rule.originalSelector,
    );

    if (variant === undefined) {
      continue;
    }

    const variantData = variant[1];
    const theme = variantData.theme;

    // Check if there's a value in the theme for this property/key
    const themeNamespace = theme[mapping.themeProperty] as Record<
      string,
      unknown
    >;

    const themeValue = themeNamespace[themeKey];
    if (typeof themeValue !== 'string') {
      continue;
    }

    // Found a conflict - CSS rule overrides theme variable
    const canResolve = rule.complexity === 'simple';
    const confidence = calculateConfidence(rule, themeValue);

    conflicts.push({
      variantName: rule.variantName,
      themeProperty: mapping.themeProperty,
      themeKey,
      variableValue: themeValue,
      ruleValue: rule.value,
      ruleSelector: rule.selector,
      canResolve,
      confidence,
      cssRule: rule,
    });
  }

  return conflicts;
}

/**
 * Applies a CSS rule override to a theme object
 *
 * Mutates the theme object to replace variable value with rule value.
 * Only call this for high-confidence, resolvable conflicts.
 *
 * @param theme - Theme object to modify
 * @param conflict - Conflict to apply
 */
export function applyOverride(theme: Theme, conflict: CSSRuleConflict): void {
  const namespace = theme[conflict.themeProperty] as
    | Record<string, unknown>
    | undefined;
  if (namespace !== undefined && typeof namespace === 'object') {
    namespace[conflict.themeKey] = conflict.ruleValue;
  }
}

/**
 * Filters conflicts to only those that can be safely resolved
 * @param conflicts - Array of all conflicts
 * @returns Array of high-confidence, resolvable conflicts
 */
export function filterResolvableConflicts(
  conflicts: Array<CSSRuleConflict>,
): Array<CSSRuleConflict> {
  return conflicts.filter(
    (conflict) => conflict.canResolve && conflict.confidence === 'high',
  );
}

/**
 * Groups conflicts by variant name
 * @param conflicts - Array of conflicts
 * @returns Map of variant name to conflicts
 */
export function groupConflictsByVariant(
  conflicts: Array<CSSRuleConflict>,
): Map<string, Array<CSSRuleConflict>> {
  const grouped = new Map<string, Array<CSSRuleConflict>>();

  for (const conflict of conflicts) {
    const existing = grouped.get(conflict.variantName);
    if (existing !== undefined) {
      existing.push(conflict);
    } else {
      grouped.set(conflict.variantName, [conflict]);
    }
  }

  return grouped;
}
