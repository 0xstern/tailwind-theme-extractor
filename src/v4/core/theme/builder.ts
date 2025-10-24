/**
 * Theme builder for Tailwind v4 CSS variables
 * Converts raw CSS variables into structured theme objects
 */

import type {
  CSSVariable,
  DeprecationWarning,
  NestingConfig,
  NestingOptions,
  OverrideOptions,
  Theme,
  ThemeColors,
  ThemeFontSizes,
  ThemeVariant,
} from '../../types';
import type { CSSRuleConflict } from '../analysis/conflicts';
import type { UnresolvedVariable } from '../analysis/unresolved';
import type { CSSRuleOverride } from '../extraction/rules';

import {
  applyOverride,
  detectConflicts,
  filterResolvableConflicts,
} from '../analysis/conflicts';
import { detectUnresolvedVariables } from '../analysis/unresolved';
import {
  kebabToCamelCase,
  parseFontSizeLineHeight,
  parseNestedKey,
  parseVariableName,
  variantNameToCamelCase,
} from '../parser/extractor';
import { LRUCache } from '../utils/lru_cache';
import { applyInitialExclusionToTheme } from './filters';
import { applyThemeOverrides, injectVariableOverrides } from './overrides';

/**
 * Compiled regex patterns for performance (avoid recompilation on each call)
 * VAR_REFERENCE_REGEX_GLOBAL uses `g` flag for efficient iteration in loops
 */
const VAR_REFERENCE_REGEX = /var\((--[\w-]+)\)/;
const VAR_REFERENCE_REGEX_GLOBAL = /var\((--[\w-]+)\)/g;
const CSS_FUNCTION_REGEX =
  /(?:calc|min|max|clamp|abs|sign|round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp)\s*\(/;

/**
 * Maximum iterations for resolving nested var() references in CSS functions
 */
const MAX_VAR_RESOLUTION_ITERATIONS = 100;

/**
 * Maximum cache size for variant resolution maps to prevent unbounded memory growth
 * Sized to handle typical projects with multiple variants (base, dark, custom themes, etc.)
 */
const MAX_VARIANT_CACHE_SIZE = 100;

/**
 * Cache for variant resolution maps to avoid redundant map creation
 * Uses LRU eviction to prevent unbounded growth in long-running processes
 * Key format: "variantName|defaultVarsLength|themeVarsLength|rootVarsLength|parentVarsLength|varVarsLength"
 */
const variantResolutionMapCache = new LRUCache<string, Map<string, string>>(
  MAX_VARIANT_CACHE_SIZE,
);

/**
 * Represents a reference from a Tailwind theme variable to a raw CSS variable
 * Used to resolve var() references from @theme to :root/:dark values
 */
interface VariableReference {
  sourceVar: string; // e.g., '--background'
  targetNamespace: string; // e.g., 'color'
  targetKey: string; // e.g., 'background'
  targetProperty: keyof Theme; // e.g., 'colors'
}

/**
 * Extracts CSS variable name from var() function
 * @param value - CSS value that may contain var()
 * @returns Variable name without -- prefix, or null if no var() found
 *
 * @example
 * extractVarReference('var(--background)') // 'background'
 * extractVarReference('oklch(1 0 0)') // null
 */
function extractVarReference(value: string): string | null {
  const match = value.match(VAR_REFERENCE_REGEX);
  return match?.[1] ?? null;
}

/**
 * Recursively resolves var() references to their actual values
 * Preserves CSS functions like calc(), min(), max(), clamp() with substituted values
 * @param value - CSS value that may contain var() references
 * @param variablesMap - Map of variable names to their values for O(1) lookup
 * @param visited - Set of variable names already visited (prevents infinite loops)
 * @returns Resolved value with all var() replaced, or original if can't resolve
 *
 * @example
 * resolveVarReferences('var(--background)', variablesMap) // 'oklch(1 0 0)'
 * resolveVarReferences('calc(var(--radius) - 4px)', variablesMap) // 'calc(0.625rem - 4px)'
 * resolveVarReferences('oklch(1 0 0)', variablesMap) // 'oklch(1 0 0)'
 */
function resolveVarReferences(
  value: string,
  variablesMap: Map<string, string>,
  visited = new Set<string>(),
): string {
  // Check if value contains any CSS function (calc, min, max, clamp, etc.)
  const hasCSSFunction = CSS_FUNCTION_REGEX.test(value);

  // If it has a CSS function, replace all var() references within it
  if (hasCSSFunction) {
    return resolveCSSFunctionVars(value, variablesMap, visited);
  }

  // No CSS function - check if it's a simple var() reference
  return resolveSimpleVarReference(value, variablesMap, visited);
}

/**
 * Resolves var() references within CSS functions like calc()
 * Uses global regex with exec() for better performance in hot path
 * @param value - CSS value containing functions
 * @param variablesMap - Map of variables for resolution
 * @param visited - Set of visited variables to prevent loops
 * @returns Resolved value with var() replaced
 */
function resolveCSSFunctionVars(
  value: string,
  variablesMap: Map<string, string>,
  visited: Set<string>,
): string {
  let result = value;
  let iterations = 0;

  // Keep replacing until no more var() references or we hit iteration limit
  // Use global regex with exec() for better performance
  while (iterations++ < MAX_VAR_RESOLUTION_ITERATIONS) {
    // Reset lastIndex before each iteration to search from the start
    VAR_REFERENCE_REGEX_GLOBAL.lastIndex = 0;
    const varMatch = VAR_REFERENCE_REGEX_GLOBAL.exec(result);
    if (varMatch === null) {
      break;
    }

    const varRef = varMatch[1];
    if (varRef === undefined || visited.has(varRef)) {
      break;
    }

    const referencedValue = variablesMap.get(varRef);
    if (referencedValue === undefined) {
      break;
    }

    visited.add(varRef);
    const resolvedRef = resolveVarReferences(
      referencedValue,
      variablesMap,
      new Set(visited),
    );
    result = result.replace(`var(${varRef})`, resolvedRef);
  }

  return result;
}

/**
 * Resolves a simple var() reference without CSS functions
 * @param value - CSS value
 * @param variablesMap - Map of variables for resolution
 * @param visited - Set of visited variables to prevent loops
 * @returns Resolved value
 */
function resolveSimpleVarReference(
  value: string,
  variablesMap: Map<string, string>,
  visited: Set<string>,
): string {
  const varRef = extractVarReference(value);
  if (varRef === null || visited.has(varRef)) {
    return value;
  }

  const referencedValue = variablesMap.get(varRef);
  if (referencedValue === undefined) {
    return value;
  }

  visited.add(varRef);
  return resolveVarReferences(referencedValue, variablesMap, visited);
}

/**
 * Converts an array of CSS variables to a Map for O(1) lookups
 * Later variables in the array override earlier ones (user vars override defaults)
 * @param variables - Array of CSS variables (defaults first, user vars last)
 * @returns Map of variable name to value
 */
function createVariablesMap(
  variables: Array<CSSVariable>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const variable of variables) {
    map.set(variable.name, variable.value);
  }
  return map;
}

/**
 * Helper type for namespace processors that need additional context
 */
interface ProcessorHelpers {
  fontSizeLineHeights: Map<string, string>;
  nestingConfig?: NestingOptions;
}

/**
 * Maps namespace-specific property names to their nesting config keys in NestingOptions
 * This allows looking up the correct nesting config for each namespace
 */
const NAMESPACE_TO_NESTING_KEY: Record<
  string,
  keyof NestingOptions | undefined
> = {
  color: 'colors',
  shadow: 'shadows',
  'inset-shadow': 'insetShadows',
  'drop-shadow': 'dropShadows',
  'text-shadow': 'textShadows',
  spacing: 'spacing',
  radius: 'radius',
  blur: 'blur',
  perspective: 'perspective',
  aspect: 'aspect',
  ease: 'ease',
  animate: 'animations',
  font: 'fonts',
  text: 'fontSize',
  'font-weight': 'fontWeight',
  tracking: 'tracking',
  leading: 'leading',
  breakpoint: 'breakpoints',
  container: 'containers',
  default: 'defaults',
};

/**
 * Resolves the nesting configuration for a given namespace
 * Falls back to default config if namespace-specific config is not provided
 *
 * @param namespace - The CSS variable namespace (e.g., 'color', 'shadow')
 * @param nestingOptions - The nesting options object
 * @returns The resolved nesting config, or undefined if none specified
 */
function resolveNestingConfig(
  namespace: string,
  nestingOptions?: NestingOptions,
): NestingConfig | undefined {
  if (nestingOptions === undefined) {
    return undefined;
  }

  // Look up the nesting key for this namespace
  const nestingKey = NAMESPACE_TO_NESTING_KEY[namespace];
  if (nestingKey === undefined) {
    return nestingOptions.default;
  }

  // Return namespace-specific config, or fall back to default
  return nestingOptions[nestingKey] ?? nestingOptions.default;
}

/**
 * Configuration for mapping CSS variable namespaces to theme properties
 */
interface NamespaceMapping {
  property: keyof Theme;
  processor?: (
    theme: Theme,
    key: string,
    value: string,
    helpers: ProcessorHelpers,
  ) => void;
}

/**
 * Maps CSS variable namespaces to theme properties and processors
 * Centralized configuration for all namespace handling
 */
const NAMESPACE_MAP: Record<string, NamespaceMapping> = {
  color: {
    property: 'colors',
    processor: (theme, key, value, helpers) => {
      const config = resolveNestingConfig('color', helpers.nestingConfig);
      processColorVariable(theme.colors, key, value, config);
    },
  },
  text: {
    property: 'fontSize',
    processor: (theme, key, value, helpers) => {
      processFontSizeVariable(
        theme.fontSize,
        helpers.fontSizeLineHeights,
        key,
        value,
      );
    },
  },
  default: {
    property: 'defaults',
    processor: (theme, key, value) => {
      theme.defaults[kebabToCamelCase(key)] = value;
    },
  },
  // Simple mappings without custom processors
  spacing: { property: 'spacing' },
  font: { property: 'fonts' },
  'font-weight': { property: 'fontWeight' },
  tracking: { property: 'tracking' },
  leading: { property: 'leading' },
  breakpoint: { property: 'breakpoints' },
  container: { property: 'containers' },
  radius: { property: 'radius' },
  shadow: { property: 'shadows' },
  'inset-shadow': { property: 'insetShadows' },
  'drop-shadow': { property: 'dropShadows' },
  'text-shadow': { property: 'textShadows' },
  blur: { property: 'blur' },
  perspective: { property: 'perspective' },
  aspect: { property: 'aspect' },
  ease: { property: 'ease' },
  animate: { property: 'animations' },
};

/**
 * Creates an empty theme object with all properties initialized
 *
 * @returns Empty theme with all properties as empty objects
 */
function createEmptyTheme(): Theme {
  return {
    colors: {},
    spacing: {},
    fonts: {},
    fontSize: {},
    fontWeight: {},
    tracking: {},
    leading: {},
    breakpoints: {},
    containers: {},
    radius: {},
    shadows: {},
    insetShadows: {},
    dropShadows: {},
    textShadows: {},
    blur: {},
    perspective: {},
    aspect: {},
    ease: {},
    animations: {},
    defaults: {},
    keyframes: {},
  };
}

/**
 * Builds reference map from @theme variables with var() values
 *
 * @param themeVariables - Variables from @theme blocks
 * @returns Map of variable references for resolution
 */
function buildReferenceMap(
  themeVariables: Array<CSSVariable>,
): Map<string, VariableReference> {
  const referenceMap = new Map<string, VariableReference>();

  for (const variable of themeVariables) {
    const varRef = extractVarReference(variable.value);
    if (varRef === null) {
      continue;
    }

    // Parse the @theme variable's name (e.g., --color-background)
    const parsed = parseVariableName(variable.name);
    if (parsed === null) {
      continue;
    }

    const mapping = NAMESPACE_MAP[parsed.namespace];
    if (mapping === undefined) {
      continue;
    }

    // Check if the referenced variable itself has a valid namespace
    // If it does, don't create a reference mapping - let it be processed normally
    // Example: --radius-lg: var(--radius) should NOT create a reference
    // because --radius itself is a valid variable (maps to radius.base via singular mapping)
    const referencedParsed = parseVariableName(varRef);
    if (
      referencedParsed !== null &&
      NAMESPACE_MAP[referencedParsed.namespace] !== undefined
    ) {
      // The referenced variable has a valid namespace, skip creating reference
      continue;
    }

    // Only create reference for variables without valid namespaces
    // Example: --color-background: var(--background) creates reference
    // because --background has no valid namespace
    referenceMap.set(varRef, {
      sourceVar: varRef,
      targetNamespace: parsed.namespace,
      targetKey: parsed.key,
      targetProperty: mapping.property,
    });
  }

  return referenceMap;
}

/**
 * Groups variant variables by variant name
 *
 * @param variantVariables - Variables from variant selectors
 * @returns Map of variant name to selector and variables
 */
function groupVariantVariables(
  variantVariables: Array<CSSVariable>,
): Map<string, { selector: string; variables: Array<CSSVariable> }> {
  const variantGroups = new Map<
    string,
    { selector: string; variables: Array<CSSVariable> }
  >();

  for (const variable of variantVariables) {
    if (variable.variantName === undefined || variable.selector === undefined) {
      continue;
    }

    if (!variantGroups.has(variable.variantName)) {
      variantGroups.set(variable.variantName, {
        selector: variable.selector,
        variables: [],
      });
    }

    variantGroups.get(variable.variantName)?.variables.push(variable);
  }

  return variantGroups;
}

/**
 * Separates variables by source in a single pass
 *
 * @param variables - Array of CSS variables
 * @returns Object with theme, root, and variant variables separated
 */
function separateVariablesBySource(variables: Array<CSSVariable>): {
  themeVariables: Array<CSSVariable>;
  rootVariables: Array<CSSVariable>;
  variantVariables: Array<CSSVariable>;
} {
  const themeVariables: Array<CSSVariable> = [];
  const rootVariables: Array<CSSVariable> = [];
  const variantVariables: Array<CSSVariable> = [];

  for (const variable of variables) {
    if (variable.source === 'theme') {
      themeVariables.push(variable);
    } else if (variable.source === 'root') {
      rootVariables.push(variable);
    } else {
      // Must be 'variant' - the only remaining option
      variantVariables.push(variable);
    }
  }

  return { themeVariables, rootVariables, variantVariables };
}

/**
 * Deduplicates variables by name, keeping last occurrence
 *
 * @param vars - Array of CSS variables
 * @returns Deduplicated array
 */
function deduplicateByName(vars: Array<CSSVariable>): Array<CSSVariable> {
  const map = new Map<string, CSSVariable>();
  for (const v of vars) {
    map.set(v.name, v);
  }
  return Array.from(map.values());
}

/**
 * Collects parent variant variables for nested variants
 *
 * @param variantName - Variant name (may be nested like "compact.dark")
 * @param variantGroups - Map of variant groups
 * @returns Array of parent variant variables
 */
function collectParentVariantVariables(
  variantName: string,
  variantGroups: Map<
    string,
    { selector: string; variables: Array<CSSVariable> }
  >,
): Array<CSSVariable> {
  const parentVariantVars: Array<CSSVariable> = [];

  if (!variantName.includes('.')) {
    return parentVariantVars;
  }

  const parts = variantName.split('.');
  for (const part of parts) {
    const parentGroup = variantGroups.get(part);
    if (parentGroup !== undefined) {
      parentVariantVars.push(...parentGroup.variables);
    }
  }

  return parentVariantVars;
}

/**
 * Configuration for building a variant theme
 */
interface VariantBuildConfig {
  /** Variant name (e.g., "dark", "compact") */
  variantName: string;
  /** CSS selector for the variant (e.g., ".dark") */
  selector: string;
  /** Variables specific to this variant */
  variables: Array<CSSVariable>;
  /** Map of all variant groups for parent resolution */
  variantGroups: Map<
    string,
    { selector: string; variables: Array<CSSVariable> }
  >;
  /** Base variables for resolution */
  baseVars: {
    /** Deduplicated theme variables */
    theme: Array<CSSVariable>;
    /** Deduplicated root variables */
    root: Array<CSSVariable>;
    /** Variables from default Tailwind theme */
    defaults: Array<CSSVariable>;
  };
  /** Context for theme building */
  context: {
    /** Keyframes map (usually empty for variants) */
    keyframes: Map<string, string>;
    /** Array to collect deprecation warnings */
    warnings: Array<DeprecationWarning>;
    /** Reference map for variable resolution */
    references: Map<string, VariableReference>;
    /** Optional nesting configuration */
    nestingConfig?: NestingOptions;
  };
}

/**
 * Builds a single variant theme using structured configuration
 *
 * @param config - Variant build configuration
 * @returns Theme variant object
 */
function buildVariantTheme(config: VariantBuildConfig): ThemeVariant {
  const parentVariantVars = collectParentVariantVariables(
    config.variantName,
    config.variantGroups,
  );

  // Build arrays using concat for better performance than spreading
  // Concat creates a new array without intermediate allocations
  const allVariablesForMap = config.baseVars.defaults
    .concat(config.baseVars.theme)
    .concat(config.baseVars.root)
    .concat(parentVariantVars)
    .concat(config.variables);

  const variantVariablesMap = createVariablesMap(allVariablesForMap);

  const variantThemeVariables = config.baseVars.theme
    .concat(parentVariantVars)
    .concat(config.variables);

  return {
    selector: config.selector,
    theme: buildTheme(
      variantThemeVariables,
      config.context.keyframes,
      config.context.warnings,
      config.context.references,
      variantVariablesMap,
      config.context.nestingConfig,
    ),
  };
}

/**
 * Creates a cache key for variant resolution map
 *
 * @param variantName - Name of the variant
 * @param defaultVarsLen - Length of default variables array
 * @param themeVarsLen - Length of theme variables array
 * @param rootVarsLen - Length of root variables array
 * @param parentVarsLen - Length of parent variant variables array
 * @param varVarsLen - Length of variant-specific variables array
 * @returns Cache key string
 */
function createVariantCacheKey(
  variantName: string,
  defaultVarsLen: number,
  themeVarsLen: number,
  rootVarsLen: number,
  parentVarsLen: number,
  varVarsLen: number,
): string {
  return `${variantName}|${defaultVarsLen}|${themeVarsLen}|${rootVarsLen}|${parentVarsLen}|${varVarsLen}`;
}

/**
 * Gets or creates a cached variant resolution map
 *
 * @param cacheKey - Cache key for the resolution map
 * @param variables - Variables to create map from if not cached
 * @returns Cached or newly created variables map
 */
function getOrCreateVariantResolutionMap(
  cacheKey: string,
  variables: Array<CSSVariable>,
): Map<string, string> {
  const cached = variantResolutionMapCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const map = createVariablesMap(variables);
  variantResolutionMapCache.set(cacheKey, map);
  return map;
}

/**
 * Logs debug messages to console
 *
 * @param logs - Array of log messages
 * @param debug - Whether debug logging is enabled
 */
function logDebugMessages(logs: Array<string>, debug: boolean): void {
  if (!debug) {
    return;
  }

  for (const log of logs) {
    console.log(log);
  }
}

/**
 * Resolves a single variable value with appropriate context
 *
 * @param variable - Variable to resolve
 * @param variantGroups - Map of variant groups
 * @param defaultVariables - Variables from default theme
 * @param dedupedThemeVars - Deduplicated theme variables
 * @param dedupedRootVars - Deduplicated root variables
 * @param allVariablesMap - Map of all base variables
 * @returns Resolved CSS variable
 */
function resolveVariable(
  variable: CSSVariable,
  variantGroups: Map<
    string,
    { selector: string; variables: Array<CSSVariable> }
  >,
  defaultVariables: Array<CSSVariable>,
  dedupedThemeVars: Array<CSSVariable>,
  dedupedRootVars: Array<CSSVariable>,
  allVariablesMap: Map<string, string>,
): CSSVariable {
  let resolveMap: Map<string, string>;

  if (variable.source === 'variant' && variable.variantName !== undefined) {
    const variantGroup = variantGroups.get(variable.variantName);
    const variantVars = variantGroup?.variables ?? [];
    const parentVariantVars = collectParentVariantVariables(
      variable.variantName,
      variantGroups,
    );

    // Create cache key based on array lengths
    const cacheKey = createVariantCacheKey(
      variable.variantName,
      defaultVariables.length,
      dedupedThemeVars.length,
      dedupedRootVars.length,
      parentVariantVars.length,
      variantVars.length,
    );

    // Build variables array using concat for better performance
    const variantSpecificVariables = defaultVariables
      .concat(dedupedThemeVars)
      .concat(dedupedRootVars)
      .concat(parentVariantVars)
      .concat(variantVars);

    resolveMap = getOrCreateVariantResolutionMap(
      cacheKey,
      variantSpecificVariables,
    );
  } else {
    resolveMap = allVariablesMap;
  }

  const resolvedValue = resolveVarReferences(variable.value, resolveMap);
  return {
    ...variable,
    value: resolvedValue,
  };
}

/**
 * Builds structured Theme objects from raw CSS variables and keyframes
 *
 * Separates base theme from variants (e.g., dark mode, custom themes)
 * Resolves var() references from @theme to :root/:variant values
 * Detects and applies CSS rule overrides when safe to do so
 *
 * @param variables - Array of CSS variables resolved from parsing
 * @param keyframes - Map of keyframe name to CSS string
 * @param cssRules - Array of CSS rule overrides from variant selectors
 * @param defaultVariables - Optional original CSS variables from Tailwind defaults (preserves variable names for resolution)
 * @param overrides - Optional theme value overrides
 * @param nestingConfig - Optional nesting configuration for parsing variable keys
 * @param debug - Enable debug logging for overrides
 * @returns Object with base theme, variants, deprecation warnings, and conflicts
 */
export function buildThemes(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  cssRules: Array<CSSRuleOverride>,
  defaultVariables?: Array<CSSVariable>,
  overrides?: OverrideOptions,
  nestingConfig?: NestingOptions,
  debug = false,
): {
  theme: Theme;
  variants: Record<string, ThemeVariant>;
  deprecationWarnings: Array<DeprecationWarning>;
  cssConflicts: Array<CSSRuleConflict>;
  variables: Array<CSSVariable>;
  unresolvedVariables: Array<UnresolvedVariable>;
} {
  // Step 1: Inject variable overrides (pre-resolution)
  // This allows overrides to participate in variable resolution
  if (overrides !== undefined) {
    const logs = injectVariableOverrides(variables, overrides, debug);
    logDebugMessages(logs, debug);
  }

  const { themeVariables, rootVariables, variantVariables } =
    separateVariablesBySource(variables);

  const dedupedThemeVars = deduplicateByName(themeVariables);
  const dedupedRootVars = deduplicateByName(rootVariables);

  // Use original default variables if provided (preserves variable names)
  // This is critical for var() resolution when nesting transforms keys
  const dedupedDefaultVars = defaultVariables
    ? deduplicateByName(defaultVariables)
    : [];

  const allVariables = [
    ...dedupedDefaultVars,
    ...dedupedThemeVars,
    ...dedupedRootVars,
  ];

  const allVariablesMap = createVariablesMap(allVariables);
  const referenceMap = buildReferenceMap(dedupedThemeVars);
  const deprecationWarnings: Array<DeprecationWarning> = [];

  const baseVariables = [...dedupedThemeVars, ...dedupedRootVars];
  const theme = buildTheme(
    baseVariables,
    keyframes,
    deprecationWarnings,
    referenceMap,
    allVariablesMap,
    nestingConfig,
  );

  const variants: Record<string, ThemeVariant> = {};
  const variantGroups = groupVariantVariables(variantVariables);
  const emptyKeyframes = new Map<string, string>();

  for (const [variantName, { selector, variables: varVars }] of variantGroups) {
    const camelVariantName = variantNameToCamelCase(variantName);
    variants[camelVariantName] = buildVariantTheme({
      variantName,
      selector,
      variables: varVars,
      variantGroups,
      baseVars: {
        theme: dedupedThemeVars,
        root: dedupedRootVars,
        defaults: dedupedDefaultVars,
      },
      context: {
        keyframes: emptyKeyframes,
        warnings: deprecationWarnings,
        references: referenceMap,
        nestingConfig,
      },
    });
  }

  const uniqueWarnings = Array.from(
    new Map(deprecationWarnings.map((w) => [w.variable, w])).values(),
  );

  const cssConflicts = detectConflicts(cssRules, variants);
  const resolvableConflicts = filterResolvableConflicts(cssConflicts);

  for (const conflict of resolvableConflicts) {
    const camelVariantName = variantNameToCamelCase(conflict.variantName);
    const variant = variants[camelVariantName];
    if (variant !== undefined) {
      applyOverride(variant.theme, conflict);
    }
  }

  const resolvedVariables = variables.map((variable) =>
    resolveVariable(
      variable,
      variantGroups,
      dedupedDefaultVars,
      dedupedThemeVars,
      dedupedRootVars,
      allVariablesMap,
    ),
  );

  // Detect unresolved variable references
  const unresolvedVariables = detectUnresolvedVariables(
    variables,
    resolvedVariables,
  );

  // Step 2: Apply theme overrides (post-resolution)
  // This mutates the theme objects directly
  if (overrides !== undefined) {
    const logs = applyThemeOverrides(theme, variants, overrides, debug);
    logDebugMessages(logs, debug);
  }

  return {
    theme,
    variants,
    deprecationWarnings: uniqueWarnings,
    cssConflicts,
    variables: resolvedVariables,
    unresolvedVariables,
  };
}

/**
 * Processes a variable through a reference mapping
 *
 * @param theme - Theme object to update
 * @param reference - Variable reference with target info
 * @param resolvedValue - Resolved CSS value
 * @param helpers - Helper context for processors
 */
function processReferencedVariable(
  theme: Theme,
  reference: VariableReference,
  resolvedValue: string,
  helpers: ProcessorHelpers,
): void {
  const mapping = NAMESPACE_MAP[reference.targetNamespace];
  if (mapping === undefined) {
    return;
  }

  if (mapping.processor !== undefined) {
    mapping.processor(theme, reference.targetKey, resolvedValue, helpers);
  } else {
    (theme[reference.targetProperty] as Record<string, string>)[
      reference.targetKey
    ] = resolvedValue;
  }
}

/**
 * Processes a normal namespaced variable
 *
 * @param theme - Theme object to update
 * @param variable - CSS variable to process
 * @param resolvedValue - Resolved CSS value
 * @param helpers - Helper context for processors
 * @param deprecationWarnings - Array to collect warnings
 */
function processNamespacedVariable(
  theme: Theme,
  variable: CSSVariable,
  resolvedValue: string,
  helpers: ProcessorHelpers,
  deprecationWarnings: Array<DeprecationWarning>,
): void {
  const parsed = parseVariableName(variable.name);
  if (parsed === null) {
    return;
  }

  const { namespace, key, deprecationWarning } = parsed;

  // Collect deprecation warning if present
  if (deprecationWarning !== undefined) {
    deprecationWarnings.push(deprecationWarning);
  }

  // Look up namespace mapping
  const mapping = NAMESPACE_MAP[namespace];
  if (mapping === undefined) {
    return;
  }

  if (mapping.processor !== undefined) {
    mapping.processor(theme, key, resolvedValue, helpers);
  } else {
    // Check if nesting config is provided for this namespace
    const config = resolveNestingConfig(namespace, helpers.nestingConfig);

    // Use processNestedVariable for all namespaces (with or without config)
    // When config is undefined, parseNestedKey uses unlimited nesting by default
    processNestedVariable(
      theme[mapping.property] as Record<string, unknown>,
      key,
      resolvedValue,
      config,
    );
  }
}

/**
 * Builds a structured Theme object from raw CSS variables
 *
 * This function processes variables in order, respecting CSS cascade rules.
 * When an `initial` value is encountered, it removes matching properties
 * from the theme being built, allowing later declarations to override.
 *
 * @param variables - Array of CSS variables to build theme from
 * @param keyframes - Map of keyframe name to CSS string
 * @param deprecationWarnings - Array to collect deprecation warnings
 * @param referenceMap - Map of var() references to resolve
 * @param allVariablesMap - Map of all variables for O(1) recursive resolution
 * @param nestingConfig - Optional nesting configuration for parsing variable keys
 * @returns Structured theme object matching Tailwind v4 namespaces
 */
function buildTheme(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  deprecationWarnings: Array<DeprecationWarning>,
  referenceMap: Map<string, VariableReference>,
  allVariablesMap: Map<string, string>,
  nestingConfig?: NestingOptions,
): Theme {
  const theme = createEmptyTheme();
  const fontSizeLineHeights = new Map<string, string>();
  const helpers: ProcessorHelpers = { fontSizeLineHeights, nestingConfig };

  for (const variable of variables) {
    // Handle 'initial' values by removing matching properties from theme
    // This respects CSS cascade order: initial overrides earlier values
    if (variable.value.trim() === 'initial') {
      const parsed = parseVariableName(variable.name);
      if (parsed !== null) {
        const { namespace, key } = parsed;
        const isWildcard = key.endsWith('-*') || key === '*';
        const exclusion = {
          pattern: variable.name,
          namespace,
          keyPattern: key,
          isWildcard,
        };
        applyInitialExclusionToTheme(theme, exclusion);
      }
      continue;
    }

    const resolvedValue = resolveVarReferences(variable.value, allVariablesMap);
    const reference = referenceMap.get(variable.name);

    // If this variable name exists in the reference map, use the mapping
    // to determine where it should be placed in the theme structure.
    // For example: --background (from :root or .dark) maps to colors.background
    // because @theme had: --color-background: var(--background)
    if (reference !== undefined) {
      processReferencedVariable(theme, reference, resolvedValue, helpers);
      continue;
    }

    processNamespacedVariable(
      theme,
      variable,
      resolvedValue,
      helpers,
      deprecationWarnings,
    );
  }

  // Merge line heights into font sizes
  for (const [key, lineHeight] of fontSizeLineHeights) {
    if (theme.fontSize[key] !== undefined) {
      theme.fontSize[key].lineHeight = lineHeight;
    }
  }

  // Add keyframes to theme
  for (const [name, css] of keyframes) {
    theme.keyframes[name] = css;
  }

  return theme;
}

/**
 * Navigates through nested structure, creating objects as needed
 * Handles conflicts where scalar values need to become nested
 *
 * @param target - Starting object
 * @param parts - Array of path parts to navigate
 * @returns The deepest nested object
 */
function navigateNestedStructure(
  target: Record<string, unknown>,
  parts: Array<string>,
): Record<string, unknown> {
  let current: Record<string, unknown> = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }

    // Handle conflict: scalar value exists, but we need to nest deeper
    if (typeof current[part] === 'string') {
      // Move scalar value to DEFAULT key
      const existingValue = current[part] as string;
      current[part] = { DEFAULT: existingValue };
    } else if (current[part] === undefined) {
      // Initialize as nested object
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  return current;
}

/**
 * Sets value on the final key, handling numeric keys and conflicts
 *
 * @param current - The object to set the value on
 * @param lastPart - The final key part
 * @param value - The value to set
 */
function setFinalValue(
  current: Record<string, unknown>,
  lastPart: string,
  value: string,
): void {
  // Try to use numeric key if the last part is purely numeric
  const numericValue = parseInt(lastPart, 10);
  const finalKey =
    !isNaN(numericValue) && numericValue.toString() === lastPart
      ? numericValue
      : lastPart;

  // Handle conflict: nested object exists, but we're setting a scalar
  const existing = current[finalKey];
  if (
    existing !== undefined &&
    typeof existing === 'object' &&
    existing !== null &&
    !Array.isArray(existing)
  ) {
    // Nested object already exists, move scalar to DEFAULT
    (current[finalKey] as Record<string, unknown>).DEFAULT = value;
  } else {
    // No conflict, set normally
    current[finalKey] = value;
  }
}

/**
 * Processes a variable with nested structure (used for all namespaces that support nesting)
 * Handles both flat values and nested structures based on parseNestedKey result
 *
 * @param target - The target object to add to (e.g., colors, shadows, spacing)
 * @param key - The variable key (without namespace prefix)
 * @param value - The CSS value
 * @param config - Optional nesting configuration
 * @param config.maxDepth - Maximum nesting depth before flattening
 * @param config.consecutiveDashes - How to handle consecutive dashes
 * @param config.flattenMode - How to flatten remaining parts after maxDepth
 *
 * @example
 * processNestedVariable(colors, 'red-500', '#ef4444') // colors.red[500] = '#ef4444'
 * processNestedVariable(shadows, 'lg-hover', '0 10px 15px...') // shadows.lg.hover = '...'
 * processNestedVariable(spacing, 'xs', '0.5rem', { maxDepth: 1 }) // spacing.xs = '0.5rem'
 */
function processNestedVariable(
  target: Record<string, unknown>,
  key: string,
  value: string,
  config?: {
    maxDepth?: number;
    consecutiveDashes?: 'exclude' | 'nest' | 'camelcase' | 'literal';
    flattenMode?: 'camelcase' | 'literal';
  },
): void {
  const parsed = parseNestedKey(key, config);

  if (parsed !== null) {
    // It's a nested value (e.g., "red-500", "tooltip-outline-dark")
    const { parts } = parsed;

    // Navigate/create nested structure for all parts except the last
    const current = navigateNestedStructure(target, parts);

    // Set the value on the last part
    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      setFinalValue(current, lastPart, value);
    }
  } else {
    // It's a flat value (e.g., "white", "black", or custom like "primary")
    // Convert to camelCase for consistency
    const camelKey: string = kebabToCamelCase(key);
    target[camelKey] = value;
  }
}

/**
 * Processes a color variable and adds it to the colors object
 * Handles both flat colors (e.g., "white") and nested color scales (e.g., "red-500", "tooltip-outline-dark")
 *
 * @param colors - The colors object to add to
 * @param key - The variable key (without namespace prefix)
 * @param value - The CSS value
 * @param config - Optional nesting configuration
 * @param config.maxDepth - Maximum nesting depth before flattening
 * @param config.consecutiveDashes - How to handle consecutive dashes
 * @param config.flattenMode - How to flatten remaining parts after maxDepth
 */
function processColorVariable(
  colors: ThemeColors,
  key: string,
  value: string,
  config?: {
    maxDepth?: number;
    consecutiveDashes?: 'exclude' | 'nest' | 'camelcase' | 'literal';
    flattenMode?: 'camelcase' | 'literal';
  },
): void {
  processNestedVariable(colors, key, value, config);
}

/**
 * Processes a font size variable and handles line height companions
 * Font sizes can have companion variables like "--text-xl--line-height"
 *
 * @param fontSize - The font size object to add to
 * @param lineHeights - Map storing line height values temporarily
 * @param key - The variable key (without namespace prefix)
 * @param value - The CSS value
 */
function processFontSizeVariable(
  fontSize: ThemeFontSizes,
  lineHeights: Map<string, string>,
  key: string,
  value: string,
): void {
  const lineHeightKey = parseFontSizeLineHeight(key);

  if (lineHeightKey !== null) {
    // It's a line height companion variable
    lineHeights.set(lineHeightKey, value);
  } else {
    // It's a font size variable
    fontSize[key] ??= {
      size: value,
    };
  }
}
