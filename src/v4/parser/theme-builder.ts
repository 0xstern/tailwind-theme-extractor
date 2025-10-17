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

import {
  kebabToCamelCase,
  parseColorScale,
  parseFontSizeLineHeight,
  parseVariableName,
} from './variable-extractor';

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
 * Builds structured Theme objects from raw CSS variables and keyframes
 *
 * Separates base theme from variants (e.g., dark mode, custom themes)
 *
 * @param variables - Array of CSS variables extracted from parsing
 * @param keyframes - Map of keyframe name to CSS string
 * @returns Object with base theme, variants, and deprecation warnings
 */
export function buildThemes(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
): {
  theme: Theme;
  variants: Record<string, ThemeVariant>;
  deprecationWarnings: Array<DeprecationWarning>;
} {
  // Separate variables by source
  const baseVariables = variables.filter(
    (v) => v.source === 'theme' || v.source === 'root',
  );
  const variantVariables = variables.filter((v) => v.source === 'variant');

  // Collect deprecation warnings
  const deprecationWarnings: Array<DeprecationWarning> = [];

  // Build base theme
  const theme = buildTheme(baseVariables, keyframes, deprecationWarnings);

  // Build variants
  const variants: Record<string, ThemeVariant> = {};

  // Group variant variables by variant name
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

  // Build theme for each variant (variants don't get separate keyframes)
  const emptyKeyframes = new Map<string, string>();
  for (const [variantName, { selector, variables: varVars }] of variantGroups) {
    variants[variantName] = {
      selector,
      theme: buildTheme(varVars, emptyKeyframes, deprecationWarnings),
    };
  }

  return { theme, variants, deprecationWarnings };
}

/**
 * Builds a structured Theme object from raw CSS variables
 *
 * @param variables - Array of CSS variables extracted from parsing
 * @param keyframes - Map of keyframe name to CSS string
 * @param deprecationWarnings - Array to collect deprecation warnings
 * @returns Structured theme object matching Tailwind v4 namespaces
 */
function buildTheme(
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  deprecationWarnings: Array<DeprecationWarning>,
): Theme {
  const theme = createEmptyTheme();

  // Temporary storage for font size line heights
  const fontSizeLineHeights = new Map<string, string>();
  const helpers: ProcessorHelpers = { fontSizeLineHeights };

  for (const variable of variables) {
    const parsed = parseVariableName(variable.name);

    if (parsed === null) {
      continue;
    }

    const { namespace, key, deprecationWarning } = parsed;

    // Collect deprecation warning if present
    if (deprecationWarning !== undefined) {
      deprecationWarnings.push(deprecationWarning);
    }

    // Look up namespace mapping
    const mapping = NAMESPACE_MAP[namespace];

    if (mapping !== undefined) {
      if (mapping.processor !== undefined) {
        // Use custom processor for complex cases
        mapping.processor(theme, key, variable.value, helpers);
      } else {
        // Simple assignment for standard properties
        (theme[mapping.property] as Record<string, string>)[key] =
          variable.value;
      }
    }
    // Unknown namespaces are silently skipped
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
