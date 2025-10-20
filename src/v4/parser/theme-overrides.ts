/**
 * Theme override system for applying custom theme value overrides
 * Supports both pre-resolution (variable injection) and post-resolution (theme mutation)
 */

import type {
  CSSVariable,
  OverrideConfig,
  OverrideOptions,
  OverrideValue,
  Theme,
  ThemeVariant,
} from '../types';

/**
 * Maximum nesting depth for processing nested override objects
 */
const MAX_NESTING_DEPTH = 10;

/**
 * Cache for memoizing flat path parsing (e.g., 'colors.primary.500' → ['colors', 'primary', '500'])
 */
const flatPathCache = new Map<string, Array<string>>();

/**
 * Cache for memoizing variable name generation (e.g., ['colors', 'primary'] → '--colors-primary')
 */
const variableNameCache = new Map<string, string | null>();

/**
 * Parsed override entry ready for application
 */
export interface ParsedOverride {
  /** Path to the property (e.g., ['colors', 'primary', '500']) */
  path: Array<string>;
  /** The value to override with */
  value: string;
  /** Whether to force-apply this override (ignore confidence levels) */
  force: boolean;
  /** Whether to resolve var() references in this value */
  resolveVars: boolean;
}

/**
 * Normalized form of override value
 */
interface NormalizedOverrideValue {
  value: string;
  force: boolean;
  resolveVars: boolean;
}

/**
 * Resolves a variant name or CSS selector to matching variant names
 *
 * @param selectorOrVariant - Variant name, CSS selector, or special key
 * @param variants - Map of variant names to theme variants
 * @returns Array of matching variant names
 */
export function resolveVariantName(
  selectorOrVariant: string,
  variants: Record<string, ThemeVariant>,
): Array<string> {
  // Special keys
  if (selectorOrVariant === '*') {
    // All variants including default
    return ['default', ...Object.keys(variants)];
  }

  if (selectorOrVariant === 'default' || selectorOrVariant === 'base') {
    return ['default'];
  }

  // Check if it's a direct variant name match
  if (variants[selectorOrVariant] !== undefined) {
    return [selectorOrVariant];
  }

  // Try to find variant by selector match
  const matchingVariants = Object.entries(variants)
    .filter(([_, variantData]) => {
      // Exact match
      if (variantData.selector === selectorOrVariant) {
        return true;
      }

      // Substring match (for compound selectors)
      if (variantData.selector.includes(selectorOrVariant)) {
        return true;
      }

      return false;
    })
    .map(([name]) => name);

  return matchingVariants;
}

/**
 * Normalizes an override value to a consistent format
 *
 * @param value - The raw override value
 * @returns Normalized override value with defaults
 */
function normalizeOverrideValue(value: OverrideValue): NormalizedOverrideValue {
  if (typeof value === 'string') {
    return {
      value,
      force: false,
      resolveVars: true,
    };
  }

  return {
    value: value.value,
    force: value.force ?? false,
    resolveVars: value.resolveVars ?? true,
  };
}

/**
 * Parses a flat path string into an array of keys (memoized)
 *
 * @param path - Dot-separated path string (e.g., 'colors.primary.500')
 * @returns Array of path segments
 */
function parseFlatPath(path: string): Array<string> {
  const cached = flatPathCache.get(path);
  if (cached !== undefined) {
    return cached;
  }

  const segments = path.split('.');
  flatPathCache.set(path, segments);
  return segments;
}

/**
 * Checks if a value is a plain object (not array, not null)
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Checks if a value looks like an OverrideValue object
 *
 * @param value - Value to check
 * @returns True if value has OverrideValue shape
 */
function isOverrideValue(value: unknown): value is OverrideValue {
  if (typeof value === 'string') {
    return true;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  // Check if it has the 'value' property (required for object form)
  return 'value' in value && typeof value.value === 'string';
}

/**
 * Recursively parses nested override config into flat array of parsed overrides
 *
 * @param config - Override configuration (flat or nested)
 * @param currentPath - Current path during recursion
 * @param depth - Current recursion depth
 * @returns Array of parsed overrides
 */
function parseOverrideConfig(
  config: OverrideConfig,
  currentPath: Array<string> = [],
  depth = 0,
): Array<ParsedOverride> {
  const overrides: Array<ParsedOverride> = [];

  // Safety check for maximum nesting depth
  if (depth > MAX_NESTING_DEPTH) {
    return overrides;
  }

  for (const [key, value] of Object.entries(config)) {
    // Check if key contains dots (flat notation)
    if (key.includes('.')) {
      // Flat notation: 'colors.primary.500'
      const path = parseFlatPath(key);

      if (isOverrideValue(value)) {
        const normalized = normalizeOverrideValue(value);
        overrides.push({
          path,
          value: normalized.value,
          force: normalized.force,
          resolveVars: normalized.resolveVars,
        });
      }
      continue;
    }

    // No dots in key - could be nested object or end value
    if (isOverrideValue(value)) {
      // It's a final value
      const normalized = normalizeOverrideValue(value);
      overrides.push({
        path: [...currentPath, key],
        value: normalized.value,
        force: normalized.force,
        resolveVars: normalized.resolveVars,
      });
    } else if (isPlainObject(value)) {
      // It's a nested object - recurse
      const nested = parseOverrideConfig(
        value as OverrideConfig,
        [...currentPath, key],
        depth + 1,
      );
      overrides.push(...nested);
    }
  }

  return overrides;
}

/**
 * Applies a single override to a theme object
 *
 * @param theme - Theme object to mutate
 * @param override - Parsed override to apply
 * @returns True if override was applied, false if path was invalid
 */
function applySingleOverride(theme: Theme, override: ParsedOverride): boolean {
  // Navigate to the target object
  let current = theme as unknown as Record<string, unknown>;

  // Navigate to parent of target
  for (let index = 0; index < override.path.length - 1; index++) {
    const key = override.path[index];

    if (key === undefined) {
      return false;
    }

    const next = current[key];

    if (next === undefined || typeof next !== 'object' || next === null) {
      // Path doesn't exist or is not an object
      return false;
    }

    current = next as Record<string, unknown>;
  }

  // Apply the override to the final key
  const finalKey = override.path[override.path.length - 1];

  if (finalKey === undefined) {
    return false;
  }

  // Check if the target exists (don't create new paths)
  if (!(finalKey in current)) {
    return false;
  }

  current[finalKey] = override.value;
  return true;
}

/**
 * Applies overrides to a single variant theme
 *
 * @param theme - Theme to apply overrides to
 * @param variantName - Name of the variant
 * @param parsedOverrides - Array of parsed overrides
 * @param debug - Enable debug logging
 * @returns Object with logs and counts
 */
function applyOverridesToVariant(
  theme: Theme,
  variantName: string,
  parsedOverrides: Array<ParsedOverride>,
  debug: boolean,
): { logs: Array<string>; appliedCount: number; skippedCount: number } {
  const logs: Array<string> = [];
  let appliedCount = 0;
  let skippedCount = 0;

  for (const override of parsedOverrides) {
    const applied = applySingleOverride(theme, override);

    if (applied) {
      appliedCount++;

      if (debug) {
        logs.push(
          `[Overrides] Applied to '${variantName}': ${override.path.join('.')} = ${override.value}`,
        );
      }
    } else {
      skippedCount++;

      if (debug) {
        logs.push(
          `[Overrides] Skipped (path not found) in '${variantName}': ${override.path.join('.')}`,
        );
      }
    }
  }

  if (debug && (appliedCount > 0 || skippedCount > 0)) {
    logs.push(
      `[Overrides] Summary for '${variantName}': ${appliedCount} applied, ${skippedCount} skipped`,
    );
  }

  return { logs, appliedCount, skippedCount };
}

/**
 * Processes overrides for a single selector/variant entry
 *
 * @param selectorOrVariant - Selector or variant identifier
 * @param config - Override configuration
 * @param baseTheme - Base theme object
 * @param variants - Map of variants
 * @param debug - Enable debug logging
 * @returns Array of log messages
 */
function processSelectorOverrides(
  selectorOrVariant: string,
  config: OverrideConfig,
  baseTheme: Theme,
  variants: Record<string, ThemeVariant>,
  debug: boolean,
): Array<string> {
  const logs: Array<string> = [];

  const variantNames = resolveVariantName(selectorOrVariant, variants);

  if (variantNames.length === 0) {
    if (debug) {
      logs.push(
        `[Overrides] No matching variants found for selector: ${selectorOrVariant}`,
      );
    }
    return logs;
  }

  const parsedOverrides = parseOverrideConfig(config);

  if (parsedOverrides.length === 0) {
    if (debug) {
      logs.push(
        `[Overrides] No valid overrides in config for: ${selectorOrVariant}`,
      );
    }
    return logs;
  }

  // Apply to each matching variant
  for (const variantName of variantNames) {
    const theme =
      variantName === 'default' ? baseTheme : variants[variantName]?.theme;

    if (theme === undefined) {
      continue;
    }

    const result = applyOverridesToVariant(
      theme,
      variantName,
      parsedOverrides,
      debug,
    );
    logs.push(...result.logs);
  }

  return logs;
}

/**
 * Applies theme overrides to a variants map (post-resolution)
 *
 * @param baseTheme - The base/default theme
 * @param variants - Map of variant names to theme variants
 * @param overrides - Override options
 * @param debug - Enable debug logging
 * @returns Array of log messages (for debug mode)
 */
export function applyThemeOverrides(
  baseTheme: Theme,
  variants: Record<string, ThemeVariant>,
  overrides: OverrideOptions,
  debug = false,
): Array<string> {
  const logs: Array<string> = [];

  for (const [selectorOrVariant, config] of Object.entries(overrides)) {
    const selectorLogs = processSelectorOverrides(
      selectorOrVariant,
      config,
      baseTheme,
      variants,
      debug,
    );
    logs.push(...selectorLogs);
  }

  return logs;
}

/**
 * Checks if a selector is valid for pre-resolution injection
 *
 * @param selectorOrVariant - Selector to check
 * @returns True if selector should be processed for injection
 */
function isPreResolutionSelector(selectorOrVariant: string): boolean {
  return (
    selectorOrVariant === '*' ||
    selectorOrVariant === 'default' ||
    selectorOrVariant === 'base'
  );
}

/**
 * Converts an override path to a CSS variable name (memoized)
 *
 * @param path - Override path array
 * @returns CSS variable name or null if invalid
 */
function pathToVariableName(path: Array<string>): string | null {
  // Use path as cache key (stringified for Map lookup)
  const cacheKey = path.join('.');
  const cached = variableNameCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const namespace = path[0];

  if (namespace === undefined) {
    variableNameCache.set(cacheKey, null);
    return null;
  }

  const keys = path.slice(1);
  const variableName = `--${namespace}-${keys.join('-')}`;
  variableNameCache.set(cacheKey, variableName);
  return variableName;
}

/**
 * Processes a single override config for variable injection
 *
 * @param selectorOrVariant - Selector identifier
 * @param config - Override configuration
 * @param variables - Variables array to inject into
 * @param injectedCount - Map to track injection counts
 * @param debug - Enable debug logging
 * @returns Array of log messages
 */
function processVariableInjection(
  selectorOrVariant: string,
  config: OverrideConfig,
  variables: Array<CSSVariable>,
  injectedCount: Map<string, number>,
  debug: boolean,
): Array<string> {
  const logs: Array<string> = [];

  if (!isPreResolutionSelector(selectorOrVariant)) {
    return logs;
  }

  const parsedOverrides = parseOverrideConfig(config);

  for (const override of parsedOverrides) {
    // Only inject if resolveVars is true (otherwise it's a final value)
    if (!override.resolveVars) {
      continue;
    }

    const variableName = pathToVariableName(override.path);

    if (variableName === null) {
      continue;
    }

    // Add synthetic variable
    variables.push({
      name: variableName,
      value: override.value,
      source: 'theme',
    });

    const count = injectedCount.get(selectorOrVariant) ?? 0;
    injectedCount.set(selectorOrVariant, count + 1);

    if (debug) {
      logs.push(
        `[Overrides] Injected variable: ${variableName} = ${override.value}`,
      );
    }
  }

  return logs;
}

/**
 * Injects synthetic CSS variables from overrides (pre-resolution)
 *
 * This allows overrides to participate in the variable resolution pipeline.
 * Useful for injecting external variables that are referenced but not defined.
 *
 * @param variables - Existing CSS variables array
 * @param overrides - Override options
 * @param debug - Enable debug logging
 * @returns Array of log messages (for debug mode)
 */
export function injectVariableOverrides(
  variables: Array<CSSVariable>,
  overrides: OverrideOptions,
  debug = false,
): Array<string> {
  const logs: Array<string> = [];
  const injectedCount = new Map<string, number>();

  for (const [selectorOrVariant, config] of Object.entries(overrides)) {
    const injectionLogs = processVariableInjection(
      selectorOrVariant,
      config,
      variables,
      injectedCount,
      debug,
    );
    logs.push(...injectionLogs);
  }

  if (debug && injectedCount.size > 0) {
    for (const [selector, count] of injectedCount) {
      logs.push(`[Overrides] Injected ${count} variables for '${selector}'`);
    }
  }

  return logs;
}
