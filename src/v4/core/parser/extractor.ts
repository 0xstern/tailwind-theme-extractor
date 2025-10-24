/**
 * CSS variable extraction and parsing utilities
 * Extracts variables from `@theme`, :root, and variant selectors
 */

import type { AtRule, ChildNode, Container, Root } from 'postcss';

import type { CSSVariable, DeprecationWarning } from '../../types';
import type { CSSRuleOverride } from '../extraction/rules';

import { extractCSSRules } from '../extraction/rules';
import { LRUCache } from '../utils/lru_cache';

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
 * Compiled regex patterns for performance (avoid recompilation on each call)
 */
const DATA_THEME_REGEX = /\[data-theme\s*=\s*['"]([^'"]+)['"]\]/g;
const DATA_ATTR_REGEX = /\[data-[\w-]+\s*=\s*['"]([^'"]+)['"]\]/;
const CLASS_NAME_REGEX = /\.([a-z][\w-]*)/gi;
const MEDIA_COLOR_SCHEME_REGEX = /prefers-color-scheme:\s*(\w+)/;
const SELF_REFERENTIAL_REGEX = /^var\((--[\w-]+)\)$/;
const FONT_SIZE_LINE_HEIGHT_REGEX = /^(.+)--line-height$/;
const KEBAB_TO_CAMEL_REGEX = /-([a-z0-9])/g;

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
  const varMatch = value.match(SELF_REFERENTIAL_REGEX);
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
  const matches = selector.matchAll(DATA_THEME_REGEX);
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
  const match = selector.match(DATA_ATTR_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts class names from a selector
 * @param selector - CSS selector to parse
 * @returns Array of class names
 */
function extractClassNames(selector: string): Array<string> {
  const classNames: Array<string> = [];
  const matches = selector.matchAll(CLASS_NAME_REGEX);
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
  const match = selector.match(MEDIA_COLOR_SCHEME_REGEX);
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
 * Applies a variant modifier to a CSS selector by appending it as a class
 *
 * For selectors with comma-separated parts or descendant combinators,
 * applies the variant to the first part of each comma-separated selector.
 *
 * @param selector - The base selector
 * @param variantName - The variant name to apply (e.g., 'dark', 'hover')
 * @returns The selector with the variant applied as a class
 *
 * @example
 * applyVariantToSelector('.theme-purple', 'dark') // '.theme-purple.dark'
 * applyVariantToSelector('.theme-purple .container', 'dark') // '.theme-purple.dark .container'
 * applyVariantToSelector('.a, .b', 'dark') // '.a.dark, .b.dark'
 * applyVariantToSelector('.theme-purple .container, .theme-purple [data-popper]', 'dark')
 * // '.theme-purple.dark .container, .theme-purple.dark [data-popper]'
 */
function applyVariantToSelector(selector: string, variantName: string): string {
  // Split by comma for multi-selector strings
  const selectors = selector.split(',').map((s) => s.trim());

  // For each selector, apply the variant to the first part
  const modifiedSelectors = selectors.map((sel) => {
    // Split by whitespace to find the first part (before descendant combinators)
    const parts = sel.split(/\s+/);
    const firstPart = parts[0];

    if (firstPart === undefined || firstPart === '') {
      return sel;
    }

    // Apply variant as a class (e.g., .theme-purple + dark = .theme-purple.dark)
    const modifiedFirstPart = `${firstPart}.${variantName}`;

    // Reconstruct the selector with the modified first part
    if (parts.length === 1) {
      return modifiedFirstPart;
    }

    return [modifiedFirstPart, ...parts.slice(1)].join(' ');
  });

  return modifiedSelectors.join(', ');
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

      // Create valid CSS selector by applying the variant as a class
      // Example: .theme-purple .container + dark = .theme-purple.dark .container
      const compoundSelector = applyVariantToSelector(
        baseSelector,
        nestedVariantName,
      );

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

  // Single pass through all top-level nodes
  root.each((node) => {
    if (node.type === 'atrule') {
      const atRule = node as AtRule;

      if (atRule.name === 'theme') {
        // Extract variables from @theme blocks
        atRule.walkDecls((decl) => {
          if (decl.prop.startsWith('--')) {
            if (!isSelfReferential(decl.prop, decl.value)) {
              // Always include variables, even with 'initial' value
              // The 'initial' values will be used to filter defaults, but we need to track them
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
  // Check cache first
  const cached = parseVariableNameCache.get(variableName);
  if (cached !== undefined) {
    return cached;
  }

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

      const result = {
        namespace,
        key: mapping.key,
        deprecationWarning,
      };
      parseVariableNameCache.set(variableName, result);
      return result;
    }

    // Unknown singular variable
    const result = { namespace, key: 'default' };
    parseVariableNameCache.set(variableName, result);
    return result;
  }

  // Check for multi-word namespaces first
  for (const ns of MULTI_WORD_NAMESPACES) {
    if (name.startsWith(ns + '-')) {
      const result = {
        namespace: ns,
        key: name.slice(ns.length + 1),
      };
      parseVariableNameCache.set(variableName, result);
      return result;
    }
  }

  // Single-word namespace
  const namespace = name.slice(0, firstHyphenIndex);
  const key = name.slice(firstHyphenIndex + 1);

  const result = { namespace, key };
  parseVariableNameCache.set(variableName, result);
  return result;
}

/**
 * Maximum cache size for LRU caches to prevent unbounded memory growth
 * Sized to handle typical theme configurations (hundreds of variables)
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Cache for kebabToCamelCase conversion to avoid redundant regex operations
 * Uses LRU eviction to prevent unbounded growth in long-running processes
 */
const camelCaseCache = new LRUCache<string, string>(MAX_CACHE_SIZE);

/**
 * Cache for parseVariableName to avoid redundant parsing operations
 * Uses LRU eviction to prevent unbounded growth in long-running processes
 */
const parseVariableNameCache = new LRUCache<
  string,
  {
    namespace: string;
    key: string;
    deprecationWarning?: DeprecationWarning;
  } | null
>(MAX_CACHE_SIZE);

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

  const result = str.replace(KEBAB_TO_CAMEL_REGEX, (_, char: string) =>
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
 * Handles consecutive dash processing for camelCase merging
 *
 * @param parts - Array of split parts
 * @param normalizedParts - Array being built
 * @param currentIndex - Current position in parts array
 * @returns New index after processing consecutive dashes
 */
function handleConsecutiveDashesAsCamelCase(
  parts: Array<string>,
  normalizedParts: Array<string>,
  currentIndex: number,
): number {
  // Find next non-empty part
  let nextPartIndex = currentIndex + 1;
  while (nextPartIndex < parts.length && parts[nextPartIndex] === '') {
    nextPartIndex++;
  }

  if (nextPartIndex < parts.length && normalizedParts.length > 0) {
    const nextPart = parts[nextPartIndex];
    if (nextPart !== undefined && nextPart !== '') {
      // Capitalize next part and merge with previous
      const lastIndex = normalizedParts.length - 1;
      const prevPart = normalizedParts[lastIndex] ?? '';
      const capitalizedNext =
        nextPart.charAt(0).toUpperCase() + nextPart.slice(1);
      normalizedParts[lastIndex] = prevPart + capitalizedNext;
      // Return the index we've consumed
      return nextPartIndex;
    }
  }

  return currentIndex;
}

/**
 * Parses a CSS variable key into nested path parts with configurable nesting behavior
 *
 * This function enables configurable nesting depth and dash handling:
 * - No dashes: null (flat key, e.g., "primary" → colors.primary)
 * - One dash: ["red", "500"] → colors.red[500]
 * - Two dashes: ["tooltip", "outline", "50"] → colors.tooltip.outline[50]
 * - Multiple dashes: ["a", "b", "c", "d"] → colors.a.b.c.d
 *
 * With maxDepth configuration (controls nesting levels in result structure):
 * - maxDepth: 0 → 0 nesting levels = completely flat
 *   - "a-b-c-d" → ["aBC D"] (all parts flattened to one key)
 * - maxDepth: 1 → 1 nesting level = one object with final key
 *   - "a-b-c-d" → ["a", "bCD"] (first part as object, rest flattened)
 * - maxDepth: 2 → 2 nesting levels = two nested objects with final key
 *   - "a-b-c-d" → ["a", "b", "cD"] (two parts as nested objects, rest flattened)
 * - maxDepth: Infinity → unlimited nesting (default)
 *   - "a-b-c-d" → ["a", "b", "c", "d"] (every dash creates a level)
 *
 * With flattenMode (controls how parts after maxDepth are flattened):
 * - flattenMode: 'camelcase' (default) → flattens to camelCase
 *   - maxDepth: 2, "a-b-c-d" → ["a", "b", "cD"]
 * - flattenMode: 'literal' → flattens to kebab-case string
 *   - maxDepth: 2, "a-b-c-d" → ["a", "b", "c-d"]
 *
 * Multiple consecutive dashes behavior (configurable):
 * - consecutiveDashes: 'exclude' → "button--primary" → null (excluded from theme)
 * - consecutiveDashes: 'nest' → "button--primary" → ["button", "primary"] (-- as -)
 * - consecutiveDashes: 'camelcase' → "button--primary" → ["buttonPrimary"] (camelCase)
 * - consecutiveDashes: 'literal' → "button--primary" → ["button-", "primary"] (dash preserved)
 *
 * @param key - The variable key to parse
 * @param config - Optional nesting configuration
 * @param config.maxDepth - Maximum nesting depth in result structure (default: Infinity)
 * @param config.consecutiveDashes - How to handle consecutive dashes (default: 'exclude')
 * @param config.flattenMode - How to flatten remaining parts after maxDepth (default: 'camelcase')
 * @returns Object with array of path parts (in camelCase), or null if excluded/flat
 *
 * @example
 * parseNestedKey('primary') // null (flat key)
 * parseNestedKey('red-500') // { parts: ['red', '500'] }
 * parseNestedKey('tooltip-outline-50') // { parts: ['tooltip', 'outline', '50'] }
 * parseNestedKey('blue-50', { maxDepth: 1 }) // { parts: ['blue', '50'] }
 * parseNestedKey('tooltip-outline-50', { maxDepth: 2 }) // { parts: ['tooltip', 'outline', '50'] }
 * parseNestedKey('a-b-c-d', { maxDepth: 2 }) // { parts: ['a', 'b', 'cD'] }
 * parseNestedKey('a-b-c-d', { maxDepth: 2, flattenMode: 'literal' }) // { parts: ['a', 'b', 'c-d'] }
 * parseNestedKey('button--primary', { consecutiveDashes: 'exclude' }) // null (excluded)
 * parseNestedKey('button--primary', { consecutiveDashes: 'nest' }) // { parts: ['button', 'primary'] }
 * parseNestedKey('button--primary', { consecutiveDashes: 'camelcase' }) // { parts: ['buttonPrimary'] }
 * parseNestedKey('button--primary', { consecutiveDashes: 'literal' }) // { parts: ['button-', 'primary'] }
 */
// eslint-disable-next-line complexity
export function parseNestedKey(
  key: string,
  config?: {
    maxDepth?: number;
    consecutiveDashes?: 'exclude' | 'nest' | 'camelcase' | 'literal';
    flattenMode?: 'camelcase' | 'literal';
  },
): {
  parts: Array<string>;
} | null {
  // No dash means flat key
  if (!key.includes('-')) {
    return null;
  }

  const maxDepth = config?.maxDepth ?? Infinity;
  const consecutiveDashMode = config?.consecutiveDashes ?? 'exclude';

  // Check for consecutive dashes (--) and handle based on mode
  const hasConsecutiveDashes = key.includes('--');
  if (hasConsecutiveDashes && consecutiveDashMode === 'exclude') {
    // EXCLUDE mode: skip variables with consecutive dashes entirely
    return null;
  }

  // Special case: maxDepth of 0 means flatten everything according to flattenMode
  if (maxDepth === 0) {
    const flattenMode = config?.flattenMode ?? 'camelcase';
    const flattenedKey =
      flattenMode === 'literal' ? key : kebabToCamelCase(key);
    return { parts: [flattenedKey] };
  }

  // NEST mode: Replace consecutive dashes with single dash before splitting
  let processedKey = key;
  if (hasConsecutiveDashes && consecutiveDashMode === 'nest') {
    processedKey = key.replace(/--+/g, '-');
  }

  // Split on dashes to get all parts
  const parts = processedKey.split('-');
  const normalizedParts: Array<string> = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }

    if (part === '') {
      // Empty part from consecutive dashes (only in CAMELCASE or LITERAL modes)
      if (consecutiveDashMode === 'camelcase') {
        i = handleConsecutiveDashesAsCamelCase(parts, normalizedParts, i);
      } else if (consecutiveDashMode === 'literal') {
        // LITERAL mode: Append dash to previous part
        if (normalizedParts.length > 0) {
          const lastIndex = normalizedParts.length - 1;
          normalizedParts[lastIndex] = (normalizedParts[lastIndex] ?? '') + '-';
        }
      }
      // For NEST mode, we already handled consecutive dashes by replacing them
    } else {
      // Check if we need to flatten remaining parts
      if (normalizedParts.length === maxDepth && i < parts.length - 1) {
        const remaining = parts
          .slice(i)
          .filter((p) => p !== '')
          .join('-');

        // Apply flatten mode: 'camelcase' (default) or 'literal'
        const flattenMode = config?.flattenMode ?? 'camelcase';
        const flattenedKey =
          flattenMode === 'literal' ? remaining : kebabToCamelCase(remaining);

        normalizedParts.push(flattenedKey);
        break;
      }

      normalizedParts.push(kebabToCamelCase(part));
    }
  }

  return { parts: normalizedParts };
}

/**
 * Parses a color key into nested path parts for multi-level nesting
 *
 * This function is a backward-compatible wrapper around parseNestedKey
 * that maintains the original behavior (unlimited depth, literal dashes).
 *
 * @param key - The variable key to check
 * @returns Object with array of path parts (in camelCase), or null if no nesting
 * @deprecated Use parseNestedKey with explicit config instead
 *
 * @example
 * parseColorScale('primary') // null (flat color)
 * parseColorScale('red-500') // { parts: ['red', '500'] }
 * parseColorScale('tooltip-outline-50') // { parts: ['tooltip', 'outline', '50'] }
 * parseColorScale('tooltip--outline-50') // { parts: ['tooltip-', 'outline', '50'] }
 */
export function parseColorScale(key: string): {
  parts: Array<string>;
} | null {
  return parseNestedKey(key, {
    maxDepth: Infinity,
    consecutiveDashes: 'literal',
  });
}

/**
 * Checks if a key represents a font size with line height modifier
 *
 * @param key - The variable key to check
 * @returns Base font size key if it's a line height variant, null otherwise
 */
export function parseFontSizeLineHeight(key: string): string | null {
  // Match pattern like "xs--line-height", "2xl--line-height"
  const match = key.match(FONT_SIZE_LINE_HEIGHT_REGEX);

  if (match === null) {
    return null;
  }

  return match[1] ?? null;
}
