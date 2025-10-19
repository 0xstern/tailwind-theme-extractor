/**
 * CSS variable extraction and parsing utilities
 * Extracts variables from `@theme`, :root, and variant selectors
 */

import type { AtRule, ChildNode, Container, Root } from 'postcss';

import type { CSSVariable, DeprecationWarning } from '../types';
import type { CSSRuleOverride } from './css-rule-extractor';

import { extractCSSRules } from './css-rule-extractor';

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
 * Extracts data-theme attribute values from a selector
 * @param selector - CSS selector to parse
 * @returns Array of data-theme values
 */
function extractDataThemeValues(selector: string): Array<string> {
  const values: Array<string> = [];
  const matches = selector.matchAll(/\[data-theme\s*=\s*['"]([^'"]+)['"]\]/g);
  for (const match of matches) {
    if (match[1] !== undefined) {
      values.push(match[1]);
    }
  }
  return values;
}

/**
 * Extracts data attribute value from a selector (if no data-theme found)
 * @param selector - CSS selector to parse
 * @returns Data attribute value or null
 */
function extractDataAttributeValue(selector: string): string | null {
  const match = selector.match(/\[data-[\w-]+\s*=\s*['"]([^'"]+)['"]\]/);
  return match?.[1] ?? null;
}

/**
 * Extracts class names from a selector
 * @param selector - CSS selector to parse
 * @returns Array of class names
 */
function extractClassNames(selector: string): Array<string> {
  const classNames: Array<string> = [];
  const matches = selector.matchAll(/\.([a-z][\w-]*)/gi);
  for (const match of matches) {
    if (match[1] !== undefined) {
      classNames.push(match[1]);
    }
  }
  return classNames;
}

/**
 * Extracts media query color scheme preference
 * @param selector - CSS selector to parse
 * @returns Color scheme preference or null
 */
function extractMediaColorScheme(selector: string): string | null {
  const match = selector.match(/prefers-color-scheme:\s*(\w+)/);
  return match?.[1] ?? null;
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
 * - [data-theme='compact'].dark → 'compact.dark' (compound selectors for same element)
 * - .theme-default .theme-container → 'theme-default' (descendant selectors - only first)
 *
 * @param selector - The CSS selector to extract variant name from
 * @returns The variant name or null if not a recognized pattern
 */
export function extractVariantName(selector: string): string | null {
  // For selectors with spaces (descendant/child/sibling combinators),
  // only extract from the first part (the actual variant)
  // Example: ".theme-default .theme-container" → only use ".theme-default"
  const firstPart = selector.split(/[\s>+~]/)[0]?.trim() ?? '';

  const variants: Array<string> = [];

  // Extract data-theme attributes
  variants.push(...extractDataThemeValues(firstPart));

  // Extract other data attributes if no data-theme found
  if (variants.length === 0) {
    const dataAttr = extractDataAttributeValue(firstPart);
    if (dataAttr !== null) {
      variants.push(dataAttr);
    }
  }

  // Extract class names
  variants.push(...extractClassNames(firstPart));

  // Extract media query preference (check full selector)
  const mediaScheme = extractMediaColorScheme(selector);
  if (mediaScheme !== null) {
    variants.push(mediaScheme);
  }

  // Return combined variant name or null
  return variants.length > 0 ? variants.join('.') : null;
}

/**
 * Recursively processes nested @variant at-rules to create compound variants
 *
 * @param container - The PostCSS container to process (Rule or AtRule)
 * @param baseVariantName - The base variant name to prepend
 * @param baseSelector - The base selector for tracking
 * @param variables - Array to push extracted variables into
 */
function processNestedVariants(
  container: Container<ChildNode>,
  baseVariantName: string,
  baseSelector: string,
  variables: Array<CSSVariable>,
): void {
  // Process @variant at-rules nested in this container
  container.walkAtRules('variant', (variantRule) => {
    const nestedVariantName = variantRule.params.trim();
    if (nestedVariantName !== '') {
      // Create compound variant name (e.g., "theme-mono.dark" or "theme-mono.dark.hover")
      const compoundVariantName = `${baseVariantName}.${nestedVariantName}`;
      const compoundSelector = `${baseSelector} @variant ${nestedVariantName}`;

      // Extract direct declarations in this @variant (not in nested @variant blocks)
      variantRule.each((child) => {
        if (child.type === 'decl') {
          const decl = child;
          if (decl.prop.startsWith('--')) {
            if (!isSelfReferential(decl.prop, decl.value)) {
              variables.push({
                name: decl.prop,
                value: decl.value,
                source: 'variant',
                selector: compoundSelector,
                variantName: compoundVariantName,
              });
            }
          }
        }
      });

      // Recursively process nested @variant blocks inside this @variant
      processNestedVariants(
        variantRule,
        compoundVariantName,
        compoundSelector,
        variables,
      );
    }
  });
}

/**
 * Extracts CSS variables, keyframes, and CSS rules from a PostCSS AST
 *
 * Supports:
 * - Base theme: `@theme` and :root
 * - Variants: any selector with CSS variables (e.g., [data-theme='dark'], .midnight)
 * - Keyframes: `@keyframes` rules
 * - Nested @variant blocks: creates compound variants with recursive support
 *   (e.g., .theme-mono @variant dark @variant hover → theme-mono.dark.hover)
 * - CSS Rules: Direct style rules within variants (e.g., .rounded-lg { border-radius: 0; })
 *
 * @param root - The PostCSS root node to extract variables from
 * @returns Object with extracted CSS variables, keyframes, and CSS rules
 */
export function extractVariables(root: Root): {
  variables: Array<CSSVariable>;
  keyframes: Map<string, string>;
  cssRules: Array<CSSRuleOverride>;
} {
  const variables: Array<CSSVariable> = [];
  const keyframes = new Map<string, string>();
  const cssRules: Array<CSSRuleOverride> = [];
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
          // Walk declarations directly in this rule (not nested in at-rules)
          // Use rule.each() instead of rule.walkDecls() to only get direct children
          rule.each((child) => {
            if (child.type === 'decl') {
              const decl = child;
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
            }
          });

          // Extract CSS rules from this variant
          const rules = extractCSSRules(rule, variantName);
          cssRules.push(...rules);

          // Process nested @variant at-rules recursively
          processNestedVariants(rule, variantName, rule.selector, variables);

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

  return { variables, keyframes, cssRules };
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
 * Cache for kebabToCamelCase conversion to avoid redundant regex operations
 */
const camelCaseCache = new Map<string, string>();

/**
 * Converts kebab-case to camelCase with memoization for performance
 *
 * This function is called frequently during theme building (for every color key,
 * font size, etc.), so results are cached to avoid redundant regex operations.
 *
 * @param str - The kebab-case string to convert
 * @returns The camelCase version
 *
 * @example
 * kebabToCamelCase('tooltip-outline') // 'tooltipOutline'
 * kebabToCamelCase('my-custom-color') // 'myCustomColor'
 */
export function kebabToCamelCase(str: string): string {
  const cached = camelCaseCache.get(str);
  if (cached !== undefined) {
    return cached;
  }

  const result = str.replace(/-([a-z0-9])/g, (_, char: string) =>
    char.toUpperCase(),
  );
  camelCaseCache.set(str, result);
  return result;
}

/**
 * Converts variant names with dots and kebab-case to camelCase
 *
 * Handles compound variant names (e.g., "theme-mono.dark" → "themeMonoDark")
 * by converting each segment to camelCase and joining them together.
 *
 * @param variantName - The variant name to convert (may contain dots)
 * @returns The camelCase version
 *
 * @example
 * variantNameToCamelCase('theme-mono') // 'themeMono'
 * variantNameToCamelCase('theme-mono.dark') // 'themeMonoDark'
 * variantNameToCamelCase('theme-rounded-none.dark.hover') // 'themeRoundedNoneDarkHover'
 */
export function variantNameToCamelCase(variantName: string): string {
  // Split by dots, convert each part to camelCase, then join
  const parts = variantName.split('.');
  const camelParts = parts.map((part) => kebabToCamelCase(part));

  // Join parts with capital first letter (except the first part)
  if (camelParts.length === 1) {
    return camelParts[0] ?? '';
  }

  const firstPart = camelParts[0] ?? '';
  const restParts = camelParts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return firstPart + restParts.join('');
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
