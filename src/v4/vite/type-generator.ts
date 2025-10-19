/**
 * Generates TypeScript type definitions from resolved theme
 */

import type {
  ParseResult,
  RuntimeGenerationOptions,
  TailwindResult,
  Theme,
} from '../types';

const JSON_INDENT_SPACES = 2;

/**
 * Converts TailwindResult to ParseResult format for compatibility with generator functions
 * This allows us to use the same generator logic for both runtime and build-time results
 *
 * @param result - TailwindResult from resolveTheme()
 * @returns ParseResult format expected by generators
 */
function convertToParseResult(result: TailwindResult): ParseResult {
  const { variants, selectors, ...rest } = result;

  // Extract the default theme
  const theme = variants.default as Theme;

  // Build variants object in ParseResult format
  const parseResultVariants: Record<
    string,
    { theme: Theme; selector: string }
  > = {};

  for (const [key, value] of Object.entries(variants)) {
    if (key === 'default') continue; // Skip default, it's the base theme

    parseResultVariants[key] = {
      theme: value as Theme,
      selector: selectors[key] ?? '',
    };
  }

  return {
    theme,
    variants: parseResultVariants,
    ...rest,
  };
}

/**
 * Property configurations for theme type generation
 * Single source of truth for all theme properties and their type generators
 */
interface PropertyConfig {
  key: keyof Theme;
  generator: (value: Record<string, unknown>) => string;
}

/**
 * Centralized property configurations used across type generation
 */
const THEME_PROPERTY_CONFIGS: Array<PropertyConfig> = [
  {
    key: 'colors',
    generator: (v) => generateColorTypes(v as Theme['colors']),
  },
  {
    key: 'fontSize',
    generator: (v) => generateFontSizeTypes(v as Theme['fontSize']),
  },
  {
    key: 'fonts',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'fontWeight',
    generator: (v) =>
      generateMixedRecordType(v as Record<string, string | number>),
  },
  {
    key: 'spacing',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'breakpoints',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'containers',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'radius',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'shadows',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'insetShadows',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'dropShadows',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'textShadows',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'blur',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'perspective',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'aspect',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'ease',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'animations',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'tracking',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'leading',
    generator: (v) =>
      generateMixedRecordType(v as Record<string, string | number>),
  },
  {
    key: 'defaults',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
  {
    key: 'keyframes',
    generator: (v) => generateRecordType(v as Record<string, string>),
  },
] as const;

/**
 * Escapes a string value for use in TypeScript string literals
 *
 * @param value - The string to escape
 * @returns Escaped string safe for use in TypeScript code
 */
function escapeStringLiteral(value: string): string {
  // Early return if no escaping needed (most common case for CSS values)
  if (!/[\\'\n]/.test(value)) {
    return value;
  }

  return value
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\n/g, '\\n'); // Escape newlines
}

/**
 * Generate TypeScript type declarations file (types.ts)
 * This file contains only the theme interface definition
 *
 * Internal function - accepts ParseResult format
 *
 * @param result - The parsed theme result
 * @param interfaceName - Name of the generated interface
 * @param sourceFile - Path to the source CSS file for documentation
 * @returns TypeScript type declaration string
 */
function generateTypeDeclarationsInternal(
  result: ParseResult,
  interfaceName: string = 'DefaultTheme',
  sourceFile?: string,
): string {
  const typeDefinitions: Array<string> = [];

  // Strong warning header
  typeDefinitions.push('/**');
  typeDefinitions.push(' * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY');
  typeDefinitions.push(' *');
  typeDefinitions.push(
    ' * This file is automatically generated by tailwind-resolver.',
  );
  typeDefinitions.push(
    ' * Any manual changes will be overwritten on the next build.',
  );
  typeDefinitions.push(' *');
  typeDefinitions.push(` * Generated at: ${new Date().toISOString()}`);
  typeDefinitions.push(' *');
  if (sourceFile !== undefined) {
    typeDefinitions.push(` * To modify: Edit ${sourceFile}`);
  } else {
    typeDefinitions.push(' * To modify: Edit your theme CSS file');
  }
  typeDefinitions.push(
    ' * To regenerate: Save your theme CSS file or restart the dev server',
  );
  typeDefinitions.push(' */');
  typeDefinitions.push('');
  typeDefinitions.push('/* eslint-disable */');
  typeDefinitions.push('// @ts-nocheck');
  typeDefinitions.push('// @generated');
  typeDefinitions.push('');

  // Main theme interface - use centralized property configs
  typeDefinitions.push(`export interface ${interfaceName} {`);
  for (const { key, generator } of THEME_PROPERTY_CONFIGS) {
    const value = result.theme[key] as Record<string, unknown>;
    const typeString = generator(value);
    typeDefinitions.push(`  ${key}: ${typeString};`);
  }
  typeDefinitions.push('}');
  typeDefinitions.push('');

  // Generate variant interfaces for each theme variant
  const variantInterfaces: Array<string> = [];
  if (Object.keys(result.variants).length > 0) {
    typeDefinitions.push('/**');
    typeDefinitions.push(' * Theme variant interfaces');
    typeDefinitions.push(' */');
    for (const [variantName, variantData] of Object.entries(result.variants)) {
      const safeExportName = toSafeIdentifier(variantName);
      const variantTypeName = `${safeExportName.charAt(0).toUpperCase()}${safeExportName.slice(1)}`;

      // Generate interface for this specific variant's theme structure
      typeDefinitions.push(`export interface ${variantTypeName} {`);
      for (const { key, generator } of THEME_PROPERTY_CONFIGS) {
        const value = variantData.theme[key] as Record<string, unknown>;
        if (hasKeys(value)) {
          const typeString = generator(value);
          typeDefinitions.push(`  ${key}: ${typeString};`);
        }
      }
      typeDefinitions.push('}');
      typeDefinitions.push('');

      variantInterfaces.push(variantTypeName);
    }
  }

  // Generate master Tailwind interface that matches ParseResult structure
  typeDefinitions.push('/**');
  typeDefinitions.push(
    ' * Master Tailwind interface matching the structure returned by resolveTheme()',
  );
  typeDefinitions.push(
    ' * This provides full type safety for all resolved theme data',
  );
  typeDefinitions.push(' */');
  typeDefinitions.push('export interface Tailwind {');
  typeDefinitions.push(
    `  /** Theme variants (default, dark, custom themes, etc.) */`,
  );
  typeDefinitions.push('  variants: {');

  // Add default variant first
  typeDefinitions.push(`    default: ${interfaceName};`);

  // Then add other variants
  for (const [variantName] of Object.entries(result.variants)) {
    const safeExportName = toSafeIdentifier(variantName);
    const variantTypeName = `${safeExportName.charAt(0).toUpperCase()}${safeExportName.slice(1)}`;
    typeDefinitions.push(`    ${safeExportName}: ${variantTypeName};`);
  }
  typeDefinitions.push('  };');

  typeDefinitions.push(`  /** CSS selectors for each variant */`);
  typeDefinitions.push('  selectors: {');
  typeDefinitions.push(`    default: ':root';`);
  for (const [variantName, variantData] of Object.entries(result.variants)) {
    const safeExportName = toSafeIdentifier(variantName);
    const selectorValue = escapeStringLiteral(variantData.selector);
    typeDefinitions.push(`    ${safeExportName}: '${selectorValue}';`);
  }
  typeDefinitions.push('  };');

  typeDefinitions.push(`  /** List of CSS files that were processed */`);
  typeDefinitions.push('  files: Array<string>;');

  typeDefinitions.push(`  /** Raw CSS variables */`);
  typeDefinitions.push(
    '  variables: Array<{ name: string; value: string; source: string; selector?: string; variantName?: string }>;',
  );

  typeDefinitions.push('}');
  typeDefinitions.push('');

  return typeDefinitions.join('\n');
}

function generateMixedRecordType(obj: Record<string, string | number>): string {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return '{}';
  }

  const props = entries
    .map(([key, value]) => {
      const safeKey = isValidIdentifier(key) ? key : `'${key}'`;
      if (typeof value === 'number') {
        return `${safeKey}: ${value}`;
      }
      return `${safeKey}: '${value}'`;
    })
    .join(';\n  ');

  return `{\n  ${props}\n}`;
}

function generateColorTypes(colors: Theme['colors']): string {
  const entries = Object.entries(colors);

  if (entries.length === 0) {
    return '{}';
  }

  const colorProps = entries
    .map(([key, value]) => {
      const safeKey = isValidIdentifier(key) ? key : `'${key}'`;

      if (typeof value === 'string') {
        return `${safeKey}: '${value}'`;
      }

      // Color scale object
      const scaleEntries = Object.entries(value)
        .map(([variant, color]) => {
          const safeVariant = isValidIdentifier(variant)
            ? variant
            : `'${variant}'`;
          return `${safeVariant}: '${color}'`;
        })
        .join('; ');

      return `${safeKey}: { ${scaleEntries} }`;
    })
    .join(';\n  ');

  return `{\n  ${colorProps}\n}`;
}

function generateFontSizeTypes(fontSize: Theme['fontSize']): string {
  const entries = Object.entries(fontSize);

  if (entries.length === 0) {
    return '{}';
  }

  const fontSizeProps = entries
    .map(([key, config]) => {
      const safeKey = isValidIdentifier(key) ? key : `'${key}'`;

      if (config.lineHeight !== undefined) {
        return `${safeKey}: { size: '${config.size}'; lineHeight: '${config.lineHeight}' }`;
      }

      return `${safeKey}: { size: '${config.size}'; lineHeight?: undefined }`;
    })
    .join(';\n  ');

  return `{\n  ${fontSizeProps}\n}`;
}

function generateRecordType(obj: Record<string, string>): string {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return '{}';
  }

  const props = entries
    .map(([key, value]) => {
      const safeKey = isValidIdentifier(key) ? key : `'${key}'`;
      return `${safeKey}: '${escapeStringLiteral(value)}'`;
    })
    .join(';\n  ');

  return `{\n  ${props}\n}`;
}

function isValidIdentifier(str: string): boolean {
  // Check if string is a valid JavaScript identifier
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Converts a string to a safe JavaScript identifier
 * Handles kebab-case by converting to camelCase
 * Ensures the result is a valid JavaScript identifier
 *
 * @param str - The string to convert
 * @returns A safe JavaScript identifier
 */
function toSafeIdentifier(str: string): string {
  // If already valid, return as-is
  if (isValidIdentifier(str)) {
    return str;
  }

  // Convert kebab-case to camelCase
  const camelCase = str.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );

  // If now valid, return
  if (isValidIdentifier(camelCase)) {
    return camelCase;
  }

  // Handle edge cases: starts with number, contains special chars, etc.
  // Prefix with underscore if starts with number
  let safe = camelCase.replace(/^(\d)/, '_$1');

  // Replace any remaining invalid characters with underscore
  safe = safe.replace(/[^a-zA-Z0-9_$]/g, '_');

  return safe;
}

/**
 * Checks if a theme property has any keys
 *
 * @param obj - The object to check
 * @returns True if the object has any keys, false otherwise
 */
function hasKeys(obj: Record<string, unknown> | undefined): boolean {
  return obj !== undefined && Object.keys(obj).length > 0;
}

/**
 * Removes empty objects and arrays from a theme object
 * Returns a new object with only non-empty properties
 *
 * @param theme - The theme object to clean
 * @returns Theme object with empty properties removed
 */
function removeEmptyProperties(theme: Theme): Partial<Theme> {
  const cleaned: Partial<Theme> = {};

  // Use centralized property configs
  for (const { key } of THEME_PROPERTY_CONFIGS) {
    const value = theme[key];
    if (hasKeys(value as Record<string, unknown>)) {
      // Type assertion needed due to TypeScript's union type limitations
      (cleaned as Record<string, unknown>)[key] = value;
    }
  }

  return cleaned;
}

/**
 * Generates variant and selector objects for runtime export
 *
 * @param result - Parse result containing theme data
 * @returns Object with variants and selectors maps
 */
function buildVariantsAndSelectors(result: ParseResult): {
  variantsObj: Record<string, unknown>;
  selectorsObj: Record<string, string>;
} {
  const variantsObj: Record<string, unknown> = {
    default: result.theme,
  };
  const selectorsObj: Record<string, string> = {
    default: ':root',
  };

  if (Object.keys(result.variants).length > 0) {
    for (const [variantName, variantData] of Object.entries(result.variants)) {
      const safeExportName = toSafeIdentifier(variantName);
      const cleanedTheme = removeEmptyProperties(variantData.theme);
      variantsObj[safeExportName] = cleanedTheme;
      selectorsObj[safeExportName] = variantData.selector;
    }
  }

  return { variantsObj, selectorsObj };
}

/**
 * Generates individual variant exports for convenience
 *
 * @param result - Parse result containing variant data
 * @param interfaceName - Name of the default theme interface
 * @returns Array of export lines
 */
function generateVariantExports(
  result: ParseResult,
  interfaceName: string,
): Array<string> {
  const lines: Array<string> = [];

  lines.push('/**');
  lines.push(' * Convenience exports for individual variants');
  lines.push(' */');
  lines.push(
    `export const ${interfaceName.charAt(0).toLowerCase()}${interfaceName.slice(1)} = variants.default;`,
  );

  if (Object.keys(result.variants).length > 0) {
    for (const [variantName] of Object.entries(result.variants)) {
      const safeExportName = toSafeIdentifier(variantName);
      lines.push(
        `export const ${safeExportName} = variants.${safeExportName};`,
      );
    }
  }

  return lines;
}

/**
 * Generate TypeScript runtime file (theme.ts)
 * This file contains the runtime theme objects matching the Tailwind interface structure
 *
 * Internal function - accepts ParseResult format
 *
 * @param result - The parsed theme result
 * @param interfaceName - Name of the generated interface for type annotations
 * @param runtimeOptions - Controls what gets exported in the runtime file
 * @returns TypeScript runtime file string
 */
// eslint-disable-next-line complexity
function generateRuntimeFileInternal(
  result: ParseResult,
  interfaceName: string = 'DefaultTheme',
  runtimeOptions: RuntimeGenerationOptions = {
    variants: true,
    selectors: true,
    files: false,
    variables: false,
  },
): string {
  const lines: Array<string> = [];

  // Header
  lines.push('/**');
  lines.push(' * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY');
  lines.push(' *');
  lines.push(' * This file is automatically generated by tailwind-resolver.');
  lines.push(' * Any manual changes will be overwritten on the next build.');
  lines.push(' *');
  lines.push(` * Generated at: ${new Date().toISOString()}`);
  lines.push(' *');
  lines.push(' * To modify: Edit your theme CSS file');
  lines.push(
    ' * To regenerate: Save your theme CSS file or restart the dev server',
  );
  lines.push(' */');
  lines.push('');
  lines.push('/* eslint-disable */');
  lines.push('// @ts-nocheck');
  lines.push('// @generated');
  lines.push('');

  // Import types for annotations
  lines.push(`import type { Tailwind, ${interfaceName} } from './types';`);
  lines.push('');

  // Build variants and selectors
  const { variantsObj, selectorsObj } = buildVariantsAndSelectors(result);

  // Conditionally export variants
  if (runtimeOptions.variants === true) {
    lines.push('/**');
    lines.push(' * Theme variants (default, dark, custom themes, etc.)');
    lines.push(' */');
    lines.push(
      `export const variants = ${JSON.stringify(variantsObj, null, JSON_INDENT_SPACES)} as Tailwind['variants'];`,
    );
    lines.push('');
  }

  // Conditionally export selectors
  if (runtimeOptions.selectors === true) {
    lines.push('/**');
    lines.push(' * CSS selectors for each theme variant');
    lines.push(' */');
    lines.push(
      `export const selectors = ${JSON.stringify(selectorsObj, null, JSON_INDENT_SPACES)} as Tailwind['selectors'];`,
    );
    lines.push('');
  }

  // Conditionally export files
  if (runtimeOptions.files === true) {
    lines.push('/**');
    lines.push(' * List of CSS files that were processed');
    lines.push(' */');
    lines.push(
      `export const files: Array<string> = ${JSON.stringify(result.files, null, JSON_INDENT_SPACES)};`,
    );
    lines.push('');
  }

  // Conditionally export variables
  if (runtimeOptions.variables === true) {
    lines.push('/**');
    lines.push(' * Raw CSS variables');
    lines.push(' */');
    lines.push(
      `export const variables: Array<{ name: string; value: string; source: string; selector?: string; variantName?: string }> = ${JSON.stringify(result.variables, null, JSON_INDENT_SPACES)};`,
    );
    lines.push('');
  }

  // Export master tailwind object if any parts are enabled
  const hasAnyExport =
    (runtimeOptions.variants ?? false) ||
    (runtimeOptions.selectors ?? false) ||
    (runtimeOptions.files ?? false) ||
    (runtimeOptions.variables ?? false);

  if (hasAnyExport) {
    lines.push('/**');
    lines.push(' * Master Tailwind object matching resolveTheme() structure');
    lines.push(' * Use this for full compatibility with runtime API');
    lines.push(' */');
    lines.push('export const tailwind = {');

    if (runtimeOptions.variants === true) {
      lines.push('  variants,');
    }
    if (runtimeOptions.selectors === true) {
      lines.push('  selectors,');
    }
    if (runtimeOptions.files === true) {
      lines.push('  files,');
    }
    if (runtimeOptions.variables === true) {
      lines.push('  variables,');
    }

    lines.push('} as const;');
    lines.push('');
    lines.push('export default tailwind;');
    lines.push('');
  }

  // Export individual variant constants for convenience (only if variants are enabled)
  if (runtimeOptions.variants === true) {
    const variantExports = generateVariantExports(result, interfaceName);
    lines.push(...variantExports);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Public wrapper for generateTypeDeclarationsInternal that accepts both result types
 * Converts TailwindResult to ParseResult format if needed
 *
 * @param result - Either TailwindResult (from resolveTheme) or ParseResult (from parseCSS)
 * @param interfaceName - Name of the generated interface
 * @param sourceFile - Path to the source CSS file for documentation
 * @returns TypeScript type declaration string
 */
export function generateTypeDeclarations(
  result: TailwindResult | ParseResult,
  interfaceName: string = 'DefaultTheme',
  sourceFile?: string,
): string {
  // Check if it's a TailwindResult by looking for the new structure
  const isTailwindResult = 'variants' in result && 'default' in result.variants;

  if (isTailwindResult) {
    // Convert TailwindResult to ParseResult
    const parseResult = convertToParseResult(result as TailwindResult);
    return generateTypeDeclarationsInternal(
      parseResult,
      interfaceName,
      sourceFile,
    );
  }

  // It's already a ParseResult
  return generateTypeDeclarationsInternal(
    result as ParseResult,
    interfaceName,
    sourceFile,
  );
}

/**
 * Public wrapper for generateRuntimeFileInternal that accepts both result types
 * Converts TailwindResult to ParseResult format if needed
 *
 * @param result - Either TailwindResult (from resolveTheme) or ParseResult (from parseCSS)
 * @param interfaceName - Name of the generated interface for type annotations
 * @param runtimeOptions - Controls what gets exported in the runtime file
 * @returns TypeScript runtime file string
 */
export function generateRuntimeFile(
  result: TailwindResult | ParseResult,
  interfaceName: string = 'DefaultTheme',
  runtimeOptions: RuntimeGenerationOptions = {
    variants: true,
    selectors: true,
    files: false,
    variables: false,
  },
): string {
  // Check if it's a TailwindResult by looking for the new structure
  const isTailwindResult = 'variants' in result && 'default' in result.variants;

  if (isTailwindResult) {
    // Convert TailwindResult to ParseResult
    const parseResult = convertToParseResult(result as TailwindResult);
    return generateRuntimeFileInternal(
      parseResult,
      interfaceName,
      runtimeOptions,
    );
  }

  // It's already a ParseResult
  return generateRuntimeFileInternal(
    result as ParseResult,
    interfaceName,
    runtimeOptions,
  );
}
