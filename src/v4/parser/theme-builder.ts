/**
 * Theme builder for Tailwind v4 CSS variables
 * Converts raw CSS variables into structured theme objects
 */

import type {
  ColorScale,
  CSSVariable,
  DeprecationWarning,
  Theme,
  ThemeColors,
  ThemeFontSizes,
  ThemeVariant,
} from '../types';
import type { CSSRuleConflict } from './conflict-resolver';
import type { CSSRuleOverride } from './css-rule-extractor';

import {
  applyOverride,
  detectConflicts,
  filterResolvableConflicts,
} from './conflict-resolver';
import {
  kebabToCamelCase,
  parseColorScale,
  parseFontSizeLineHeight,
  parseVariableName,
  variantNameToCamelCase,
} from './variable-extractor';

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
  const match = value.match(/var\((--[\w-]+)\)/);
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
  const hasCSSFunction =
    /(?:calc|min|max|clamp|abs|sign|round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp)\s*\(/.test(
      value,
    );

  // If it has a CSS function, replace all var() references within it
  if (hasCSSFunction) {
    return resolveCSSFunctionVars(value, variablesMap, visited);
  }

  // No CSS function - check if it's a simple var() reference
  return resolveSimpleVarReference(value, variablesMap, visited);
}

/**
 * Resolves var() references within CSS functions like calc()
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
  const MAX_ITERATIONS = 100;
  let result = value;
  let iterations = 0;

  // Keep replacing until no more var() references or we hit iteration limit
  while (iterations++ < MAX_ITERATIONS) {
    const varMatch = result.match(/var\((--[\w-]+)\)/);
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
    processor: (theme, key, value) => {
      processColorVariable(theme.colors, key, value);
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
 * Converts a Theme object back into an array of CSSVariable objects
 * Used to make Tailwind default theme variables available for var() resolution
 *
 * @param theme - Theme object to convert
 * @returns Array of CSSVariable objects with source='theme'
 */
function themeToVariables(theme: Theme): Array<CSSVariable> {
  const variables: Array<CSSVariable> = [];

  // Convert colors
  for (const [key, value] of Object.entries(theme.colors)) {
    if (typeof value === 'string') {
      // Flat color
      variables.push({
        name: `--color-${key}`,
        value,
        source: 'theme',
      });
    } else {
      // Color scale
      for (const [variant, colorValue] of Object.entries(value)) {
        variables.push({
          name: `--color-${key}-${variant}`,
          value: colorValue as string,
          source: 'theme',
        });
      }
    }
  }

  // Convert other theme properties with their namespaces
  const namespaceMap: Array<{
    property: keyof Theme;
    namespace: string;
  }> = [
    { property: 'spacing', namespace: 'spacing' },
    { property: 'fonts', namespace: 'font' },
    { property: 'fontSize', namespace: 'text' },
    { property: 'fontWeight', namespace: 'font-weight' },
    { property: 'tracking', namespace: 'tracking' },
    { property: 'leading', namespace: 'leading' },
    { property: 'breakpoints', namespace: 'breakpoint' },
    { property: 'containers', namespace: 'container' },
    { property: 'radius', namespace: 'radius' },
    { property: 'shadows', namespace: 'shadow' },
    { property: 'insetShadows', namespace: 'inset-shadow' },
    { property: 'dropShadows', namespace: 'drop-shadow' },
    { property: 'textShadows', namespace: 'text-shadow' },
    { property: 'blur', namespace: 'blur' },
    { property: 'perspective', namespace: 'perspective' },
    { property: 'aspect', namespace: 'aspect' },
    { property: 'ease', namespace: 'ease' },
    { property: 'animations', namespace: 'animate' },
    { property: 'defaults', namespace: 'default' },
  ];

  for (const { property, namespace } of namespaceMap) {
    const values = theme[property] as Record<string, unknown>;
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') {
        variables.push({
          name: `--${namespace}-${key}`,
          value,
          source: 'theme',
        });
      } else if (property === 'fontSize' && typeof value === 'object') {
        // Handle font size objects with size and lineHeight
        const fontSize = value as { size: string; lineHeight?: string };
        variables.push({
          name: `--${namespace}-${key}`,
          value: fontSize.size,
          source: 'theme',
        });
        if (fontSize.lineHeight !== undefined) {
          variables.push({
            name: `--${namespace}-${key}--line-height`,
            value: fontSize.lineHeight,
            source: 'theme',
          });
        }
      }
    }
  }

  return variables;
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
 * Builds a single variant theme
 *
 * @param variantName - Name of the variant
 * @param selector - CSS selector for the variant
 * @param varVars - Variables specific to this variant
 * @param variantGroups - Map of all variant groups
 * @param dedupedThemeVars - Deduplicated theme variables
 * @param dedupedRootVars - Deduplicated root variables
 * @param defaultVariables - Variables from default theme
 * @param emptyKeyframes - Empty keyframes map
 * @param deprecationWarnings - Array to collect warnings
 * @param referenceMap - Reference map for variable resolution
 * @returns Theme variant object
 */
function buildVariantTheme(
  variantName: string,
  selector: string,
  varVars: Array<CSSVariable>,
  variantGroups: Map<
    string,
    { selector: string; variables: Array<CSSVariable> }
  >,
  dedupedThemeVars: Array<CSSVariable>,
  dedupedRootVars: Array<CSSVariable>,
  defaultVariables: Array<CSSVariable>,
  emptyKeyframes: Map<string, string>,
  deprecationWarnings: Array<DeprecationWarning>,
  referenceMap: Map<string, VariableReference>,
): ThemeVariant {
  const parentVariantVars = collectParentVariantVariables(
    variantName,
    variantGroups,
  );

  const variantVariablesMap = createVariablesMap([
    ...defaultVariables,
    ...dedupedThemeVars,
    ...dedupedRootVars,
    ...parentVariantVars,
    ...varVars,
  ]);

  const variantThemeVariables = [
    ...dedupedThemeVars,
    ...parentVariantVars,
    ...varVars,
  ];

  return {
    selector,
    theme: buildTheme(
      variantThemeVariables,
      emptyKeyframes,
      deprecationWarnings,
      referenceMap,
      variantVariablesMap,
    ),
  };
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

    const variantSpecificVariables = [
      ...defaultVariables,
      ...dedupedThemeVars,
      ...dedupedRootVars,
      ...parentVariantVars,
      ...variantVars,
    ];
    resolveMap = createVariablesMap(variantSpecificVariables);
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
 * @param defaultTheme - Optional Tailwind default theme for var() resolution
 * @returns Object with base theme, variants, deprecation warnings, and conflicts
 */
export function buildThemes(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  cssRules: Array<CSSRuleOverride>,
  defaultTheme?: Theme | null,
): {
  theme: Theme;
  variants: Record<string, ThemeVariant>;
  deprecationWarnings: Array<DeprecationWarning>;
  cssConflicts: Array<CSSRuleConflict>;
  variables: Array<CSSVariable>;
} {
  const { themeVariables, rootVariables, variantVariables } =
    separateVariablesBySource(variables);

  const dedupedThemeVars = deduplicateByName(themeVariables);
  const dedupedRootVars = deduplicateByName(rootVariables);

  const defaultVariables =
    defaultTheme !== undefined && defaultTheme !== null
      ? themeToVariables(defaultTheme)
      : [];

  const allVariables = [
    ...defaultVariables,
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
  );

  const variants: Record<string, ThemeVariant> = {};
  const variantGroups = groupVariantVariables(variantVariables);
  const emptyKeyframes = new Map<string, string>();

  for (const [variantName, { selector, variables: varVars }] of variantGroups) {
    const camelVariantName = variantNameToCamelCase(variantName);
    variants[camelVariantName] = buildVariantTheme(
      variantName,
      selector,
      varVars,
      variantGroups,
      dedupedThemeVars,
      dedupedRootVars,
      defaultVariables,
      emptyKeyframes,
      deprecationWarnings,
      referenceMap,
    );
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
      defaultVariables,
      dedupedThemeVars,
      dedupedRootVars,
      allVariablesMap,
    ),
  );

  return {
    theme,
    variants,
    deprecationWarnings: uniqueWarnings,
    cssConflicts,
    variables: resolvedVariables,
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
    (theme[mapping.property] as Record<string, string>)[key] = resolvedValue;
  }
}

/**
 * Builds a structured Theme object from raw CSS variables
 *
 * @param variables - Array of CSS variables to build theme from
 * @param keyframes - Map of keyframe name to CSS string
 * @param deprecationWarnings - Array to collect deprecation warnings
 * @param referenceMap - Map of var() references to resolve
 * @param allVariablesMap - Map of all variables for O(1) recursive resolution
 * @returns Structured theme object matching Tailwind v4 namespaces
 */
function buildTheme(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  deprecationWarnings: Array<DeprecationWarning>,
  referenceMap: Map<string, VariableReference>,
  allVariablesMap: Map<string, string>,
): Theme {
  const theme = createEmptyTheme();
  const fontSizeLineHeights = new Map<string, string>();
  const helpers: ProcessorHelpers = { fontSizeLineHeights };

  for (const variable of variables) {
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
 * Processes a color variable and adds it to the colors object
 * Handles both flat colors (e.g., "white") and color scales (e.g., "red-500")
 *
 * @param colors - The colors object to add to
 * @param key - The variable key (without namespace prefix)
 * @param value - The CSS value
 */
function processColorVariable(
  colors: ThemeColors,
  key: string,
  value: string,
): void {
  const colorScale = parseColorScale(key);

  if (colorScale !== null) {
    // It's a color scale variant (e.g., "red-500")
    const { colorName, variant } = colorScale;

    if (
      colors[colorName] === undefined ||
      typeof colors[colorName] === 'string'
    ) {
      // Initialize as a ColorScale object
      colors[colorName] = {} as ColorScale;
    }

    // Try to use numeric key if the variant is purely numeric
    const numericVariant = parseInt(variant, 10);
    const variantKey =
      !isNaN(numericVariant) && numericVariant.toString() === variant
        ? numericVariant
        : variant;

    (colors[colorName] as ColorScale)[variantKey] = value;
  } else {
    // It's a flat color (e.g., "white", "black", or custom like "primary")
    // Convert to camelCase for consistency
    const camelKey: string = kebabToCamelCase(key);
    colors[camelKey] = value;
  }
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
