/**
 * CSS variable extraction and parsing utilities
 * Extracts variables from `@theme`, :root, and variant selectors
 */

import type { AtRule, Root } from 'postcss';

import type { CSSVariable, DeprecationWarning } from '../types';

/**
 * Singular variable mappings for deprecated Tailwind v4 variables
 */
const SINGULAR_VARIABLE_MAPPINGS: Record<
  string,
  { key: string; replacement: string }
> = {
  spacing: { key: 'base', replacement: '--spacing-base' },
  blur: { key: 'default', replacement: '--blur-sm or --blur-md' },
  shadow: { key: 'default', replacement: '--shadow-sm or --shadow-md' },
  radius: { key: 'default', replacement: '--radius-sm or --radius-md' },
};

/**
 * Multi-word CSS variable namespaces that need special parsing
 */
const MULTI_WORD_NAMESPACES = [
  'text-shadow',
  'inset-shadow',
  'drop-shadow',
  'font-weight',
] as const;

/**
 * Checks if a CSS variable is self-referential (e.g., --font-sans: var(--font-sans))
 *
 * Self-referential variables create circular dependencies and should be ignored
 * to allow Tailwind default values to be used instead.
 *
 * @param name - The variable name (e.g., '--font-sans')
 * @param value - The variable value
 * @returns true if the variable references itself
 *
 * @example
 * isSelfReferential('--font-sans', 'var(--font-sans)') // true
 * isSelfReferential('--color-primary', 'var(--background)') // false
 */
function isSelfReferential(name: string, value: string): boolean {
  // Match var(--variable-name) pattern
  const varMatch = value.match(/^var\((--[\w-]+)\)$/);
  if (varMatch === null) {
    return false;
  }

  const referencedVar = varMatch[1];
  return referencedVar === name;
}

/**
 * Extracts variant name from CSS selector
 *
 * Patterns supported:
 * - [data-theme='dark'] → 'dark'
 * - [data-theme="blue"] → 'blue'
 * - [data-slot='select-trigger'] → 'select-trigger'
 * - .midnight → 'midnight'
 * - .dark → 'dark'
 * - `@media` (prefers-color-scheme: dark) → 'dark'
 *
 * @param selector - The CSS selector to extract variant name from
 * @returns The variant name or null if not a recognized pattern
 */
export function extractVariantName(selector: string): string | null {
  // Match [data-theme='value'] or [data-theme="value"] (highest priority)
  const dataThemeMatch = selector.match(
    /\[data-theme\s*=\s*['"]([^'"]+)['"]\]/,
  );
  if (dataThemeMatch?.[1] !== undefined) {
    return dataThemeMatch[1];
  }

  // Match any [data-*='value'] attribute selector (e.g., [data-slot='select-trigger'])
  const dataAttrMatch = selector.match(
    /\[data-[\w-]+\s*=\s*['"]([^'"]+)['"]\]/,
  );
  if (dataAttrMatch?.[1] !== undefined) {
    return dataAttrMatch[1];
  }

  // Match .classname (like .dark, .midnight, .theme-default)
  const classMatch = selector.match(/\.([a-z][\w-]*)/i);
  if (classMatch?.[1] !== undefined) {
    return classMatch[1];
  }

  // Match `@media` (prefers-color-scheme: dark)
  const mediaMatch = selector.match(/prefers-color-scheme:\s*(\w+)/);
  if (mediaMatch?.[1] !== undefined) {
    return mediaMatch[1];
  }

  return null;
}

/**
 * Extracts CSS variables and keyframes from `@theme,` :root, and variant blocks in a PostCSS AST
 *
 * Supports:
 * - Base theme: `@theme` and :root
 * - Variants: any selector with CSS variables (e.g., [data-theme='dark'], .midnight)
 * - Keyframes: `@keyframes` rules
 *
 * @param root - The PostCSS root node to extract variables from
 * @returns Object with extracted CSS variables and keyframes
 */
export function extractVariables(root: Root): {
  variables: Array<CSSVariable>;
  keyframes: Map<string, string>;
} {
  const variables: Array<CSSVariable> = [];
  const keyframes = new Map<string, string>();
  const processedMediaInRules = new Set<AtRule>();

  // Single pass through all top-level nodes
  root.each((node) => {
    if (node.type === 'atrule') {
      const atRule = node as AtRule;

      if (atRule.name === 'theme') {
        // Extract variables from @theme blocks
        atRule.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) {
            if (!isSelfReferential(decl.prop, decl.value)) {
              variables.push({
                name: decl.prop,
                value: decl.value,
                source: 'theme',
              });
            }
          }
        });

        // Extract keyframes nested inside @theme blocks
        atRule.walkAtRules('keyframes', (keyframesRule) => {
          if (keyframesRule.params !== '') {
            keyframes.set(keyframesRule.params, keyframesRule.toString());
          }
        });
      } else if (atRule.name === 'media') {
        // Extract variables from @media blocks
        const variantName = extractVariantName(atRule.params);

        if (variantName !== null) {
          atRule.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              if (!isSelfReferential(decl.prop, decl.value)) {
                variables.push({
                  name: decl.prop,
                  value: decl.value,
                  source: 'variant',
                  selector: `@media ${atRule.params}`,
                  variantName,
                });
              }
            }
          });
        }
      } else if (atRule.name === 'keyframes') {
        // Extract @keyframes rules
        if (atRule.params !== '') {
          keyframes.set(atRule.params, atRule.toString());
        }
      }
    } else if (node.type === 'rule') {
      const rule = node;

      if (rule.selector === ':root') {
        // Extract variables from :root blocks
        rule.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) {
            if (!isSelfReferential(decl.prop, decl.value)) {
              variables.push({
                name: decl.prop,
                value: decl.value,
                source: 'root',
              });
            }
          }
        });
      } else {
        // Extract variables from variant selectors
        const variantName = extractVariantName(rule.selector);

        if (variantName !== null) {
          // Walk declarations directly in this rule
          rule.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              if (!isSelfReferential(decl.prop, decl.value)) {
                variables.push({
                  name: decl.prop,
                  value: decl.value,
                  source: 'variant',
                  selector: rule.selector,
                  variantName,
                });
              }
            }
          });

          // Check for media queries nested inside this rule
          rule.walkAtRules('media', (mediaRule) => {
            processedMediaInRules.add(mediaRule);

            mediaRule.walkDecls((decl) => {
              if (decl.prop.startsWith('--')) {
                if (!isSelfReferential(decl.prop, decl.value)) {
                  variables.push({
                    name: decl.prop,
                    value: decl.value,
                    source: 'variant',
                    selector: `${rule.selector} @media ${mediaRule.params}`,
                    variantName,
                  });
                }
              }
            });
          });
        }
      }
    }
  });

  return { variables, keyframes };
}

/**
 * Parses a CSS variable name and extracts the namespace and key
 *
 * Examples:
 * - --color-red-500 → { namespace: 'color', key: 'red-500' }
 * - --spacing-4 → { namespace: 'spacing', key: '4' }
 * - --font-sans → { namespace: 'font', key: 'sans' }
 * - --spacing → { namespace: 'spacing', key: 'base' } (singular variable)
 * - --blur → { namespace: 'blur', key: 'default' } (singular variable)
 *
 * @param variableName - The CSS variable name (including the -- prefix)
 * @returns Object containing the namespace, key, and optional deprecation warning
 */
export function parseVariableName(variableName: string): {
  namespace: string;
  key: string;
  deprecationWarning?: DeprecationWarning;
} | null {
  // Remove the -- prefix
  const PREFIX_LENGTH = 2;
  const name = variableName.startsWith('--')
    ? variableName.slice(PREFIX_LENGTH)
    : variableName;

  // Split by first hyphen to get namespace and rest
  const firstHyphenIndex = name.indexOf('-');

  // Handle singular variables (no suffix after namespace)
  if (firstHyphenIndex === -1) {
    const namespace = name;
    const mapping = SINGULAR_VARIABLE_MAPPINGS[namespace];

    if (mapping !== undefined) {
      const deprecationWarning: DeprecationWarning = {
        variable: variableName,
        message: `Singular variable '${variableName}' is deprecated in Tailwind v4`,
        replacement: mapping.replacement,
      };

      return {
        namespace,
        key: mapping.key,
        deprecationWarning,
      };
    }

    // Unknown singular variable
    return { namespace, key: 'default' };
  }

  // Check for multi-word namespaces first
  for (const ns of MULTI_WORD_NAMESPACES) {
    if (name.startsWith(ns + '-')) {
      return {
        namespace: ns,
        key: name.slice(ns.length + 1),
      };
    }
  }

  // Single-word namespace
  const namespace = name.slice(0, firstHyphenIndex);
  const key = name.slice(firstHyphenIndex + 1);

  return { namespace, key };
}

/**
 * Converts kebab-case to camelCase
 *
 * @param str - The kebab-case string to convert
 * @returns The camelCase version
 *
 * @example
 * kebabToCamelCase('tooltip-outline') // 'tooltipOutline'
 * kebabToCamelCase('my-custom-color') // 'myCustomColor'
 */
export function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Checks if a key represents a color scale variant with flexible naming
 *
 * This function handles complex color names and variants:
 * - Simple: "red-500" → { colorName: "red", variant: "500" }
 * - Complex: "tooltip-outline-50" → { colorName: "tooltipOutline", variant: "50" }
 * - With suffix: "brand-500-hover" → { colorName: "brand", variant: "500-hover" }
 *
 * @param key - The variable key to check
 * @returns Object with camelCase colorName and variant (string), or null if no variant
 */
export function parseColorScale(key: string): {
  colorName: string;
  variant: string;
} | null {
  // Match pattern: everything up to last dash followed by digits (and optional suffix)
  // Examples:
  // - "red-500" → ["red", "500"]
  // - "tooltip-outline-50" → ["tooltip-outline", "50"]
  // - "brand-500-hover" → ["brand", "500-hover"]
  const match = key.match(/^(.+?)-(\d+(?:-.+)?)$/);

  if (match === null) {
    return null;
  }

  const colorNameKebab = match[1];
  const variant = match[2];

  if (colorNameKebab === undefined || variant === undefined) {
    return null;
  }

  // Convert kebab-case to camelCase for the color name
  const colorName = kebabToCamelCase(colorNameKebab);

  return { colorName, variant };
}

/**
 * Checks if a key represents a font size with line height modifier
 *
 * @param key - The variable key to check
 * @returns Base font size key if it's a line height variant, null otherwise
 */
export function parseFontSizeLineHeight(key: string): string | null {
  // Match pattern like "xs--line-height", "2xl--line-height"
  const match = key.match(/^(.+)--line-height$/);

  if (match === null) {
    return null;
  }

  return match[1] ?? null;
}
