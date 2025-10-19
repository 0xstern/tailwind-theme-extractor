/**
 * CSS rule extraction and complexity analysis
 * Detects CSS rules within variant selectors that may conflict with CSS variables
 */

import type { ChildNode, Container, Declaration, Rule } from 'postcss';

import type { Theme } from '../types';

/**
 * Represents a CSS rule override found within a variant selector
 */
export interface CSSRuleOverride {
  /** CSS selector (e.g., ".rounded-lg", "[data-slot='card']") */
  selector: string;
  /** CSS property (e.g., "border-radius", "box-shadow") */
  property: string;
  /** CSS value (e.g., "0", "none", "calc(var(--spacing) * 4)") */
  value: string;
  /** Variant name (e.g., "themeMono", "themeScaled") */
  variantName: string;
  /** Original parent selector (e.g., ".theme-mono .theme-container") */
  originalSelector: string;
  /** Complexity classification */
  complexity: 'simple' | 'complex';
  /** Reason for complexity classification (if complex) */
  reason?: string;
  /** Whether the rule is nested in a media query */
  inMediaQuery?: boolean;
  /** Media query params if nested (e.g., "(min-width: 1024px)") */
  mediaQuery?: string;
}

/**
 * Maps CSS properties to theme namespaces
 */
interface PropertyMapping {
  /** Theme property key (e.g., 'radius', 'shadows') */
  themeProperty: keyof Theme;
  /** Function to extract theme key from selector */
  keyExtractor: (selector: string) => string | null;
}

/**
 * Compiled regex patterns for utility key extraction (avoid recompilation on each call)
 */
const ROUNDED_UTILITY_REGEX = /\.rounded-(xs|sm|md|lg|xl|2xl|3xl|full)/;
const SHADOW_UTILITY_REGEX = /\.shadow-(xs|sm|md|lg|xl|2xl)/;
const TEXT_SHADOW_UTILITY_REGEX = /\.text-shadow-(xs|sm|md|lg|xl)/;
const BLUR_UTILITY_REGEX = /\.blur-(xs|sm|md|lg|xl)/;

/**
 * Compiled regex pattern for dynamic CSS functions
 */
const DYNAMIC_VALUE_REGEX = /var\(|calc\(|min\(|max\(|clamp\(/;

/**
 * Compiled regex patterns for pseudo-selectors
 */
const PSEUDO_CLASS_REGEX = /:hover|:focus/;
const PSEUDO_ELEMENT_REGEX = /::(before|after)/;

/**
 * CSS property to theme namespace mappings
 */
const PROPERTY_MAPPINGS: Record<string, PropertyMapping> = {
  'border-radius': {
    themeProperty: 'radius',
    keyExtractor: extractRoundedUtilityKey,
  },
  'box-shadow': {
    themeProperty: 'shadows',
    keyExtractor: extractShadowUtilityKey,
  },
  'text-shadow': {
    themeProperty: 'textShadows',
    keyExtractor: extractTextShadowUtilityKey,
  },
  filter: {
    themeProperty: 'blur',
    keyExtractor: extractBlurUtilityKey,
  },
  padding: {
    themeProperty: 'spacing',
    keyExtractor: extractSpacingUtilityKey,
  },
  'padding-block': {
    themeProperty: 'spacing',
    keyExtractor: extractSpacingUtilityKey,
  },
  'padding-inline': {
    themeProperty: 'spacing',
    keyExtractor: extractSpacingUtilityKey,
  },
  gap: {
    themeProperty: 'spacing',
    keyExtractor: extractSpacingUtilityKey,
  },
};

/**
 * Extracts rounded utility key from selector
 * @param selector - CSS selector (e.g., ".rounded-lg", ".rounded-xs")
 * @returns Theme key (e.g., "lg", "xs") or null
 */
function extractRoundedUtilityKey(selector: string): string | null {
  const match = selector.match(ROUNDED_UTILITY_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts shadow utility key from selector
 * @param selector - CSS selector (e.g., ".shadow-lg", ".shadow-xs")
 * @returns Theme key (e.g., "lg", "xs") or null
 */
function extractShadowUtilityKey(selector: string): string | null {
  const match = selector.match(SHADOW_UTILITY_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts text shadow utility key from selector
 * @param selector - CSS selector (e.g., ".text-shadow-lg")
 * @returns Theme key or null
 */
function extractTextShadowUtilityKey(selector: string): string | null {
  const match = selector.match(TEXT_SHADOW_UTILITY_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts blur utility key from selector
 * @param selector - CSS selector (e.g., ".blur-sm")
 * @returns Theme key or null
 */
function extractBlurUtilityKey(selector: string): string | null {
  const match = selector.match(BLUR_UTILITY_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts spacing utility key from selector or data attribute
 * @param _selector - CSS selector (unused - placeholder for future expansion)
 * @returns Theme key or null
 */
function extractSpacingUtilityKey(_selector: string): string | null {
  // For now, return null - spacing is typically not overridden via direct selectors
  // This is a placeholder for future expansion
  return null;
}

/**
 * Maps CSS property to theme namespace
 * @param property - CSS property name
 * @returns Property mapping or null if not mapped
 */
export function mapPropertyToTheme(property: string): PropertyMapping | null {
  return PROPERTY_MAPPINGS[property] ?? null;
}

/**
 * Maximum number of declarations before a rule is considered complex
 */
const MAX_SIMPLE_DECLARATIONS = 3;

/**
 * Checks if selector has pseudo-classes
 * @param selector - CSS selector to check
 * @returns True if selector contains pseudo-classes
 */
function hasPseudoClasses(selector: string): boolean {
  return PSEUDO_CLASS_REGEX.test(selector);
}

/**
 * Checks if selector has pseudo-elements
 * @param selector - CSS selector to check
 * @returns True if selector contains pseudo-elements
 */
function hasPseudoElements(selector: string): boolean {
  return PSEUDO_ELEMENT_REGEX.test(selector);
}

/**
 * Checks if value contains dynamic CSS functions
 * @param value - CSS value to check
 * @returns True if value contains dynamic functions
 */
function hasDynamicValue(value: string): boolean {
  return DYNAMIC_VALUE_REGEX.test(value);
}

/**
 * Checks if selector has complex combinators
 * @param selector - CSS selector to check
 * @returns Object with complexity status and reason
 */
function hasComplexCombinators(selector: string): {
  isComplex: boolean;
  reason?: string;
} {
  const selectorParts = selector.split(',').map((s) => s.trim());
  for (const part of selectorParts) {
    // Check for specific combinators first (before generic whitespace check)
    // Has child combinator (>)
    if (part.includes('>')) {
      return { isComplex: true, reason: 'Child combinator' };
    }
    // Has sibling combinator (~, +)
    if (part.includes('~') || part.includes('+')) {
      return { isComplex: true, reason: 'Sibling combinator' };
    }
    // Has descendant combinator (space) - check last to avoid false positives
    if (/\s+/.test(part.trim())) {
      return { isComplex: true, reason: 'Descendant selector' };
    }
  }
  return { isComplex: false };
}

/**
 * Classifies rule complexity based on various factors
 * @param rule - PostCSS Rule node
 * @param decl - PostCSS Declaration node
 * @param inMediaQuery - Whether rule is nested in media query
 * @returns Complexity classification with reason
 */
function classifyRuleComplexity(
  rule: Rule,
  decl: Declaration,
  inMediaQuery: boolean,
): {
  complexity: 'simple' | 'complex';
  reason?: string;
} {
  // Check for @apply directives (complex - needs Tailwind processing)
  if (decl.value.includes('@apply')) {
    return {
      complexity: 'complex',
      reason: '@apply directive requires Tailwind processing',
    };
  }

  // Check for pseudo-classes (complex - context-dependent)
  if (hasPseudoClasses(rule.selector)) {
    return { complexity: 'complex', reason: 'Pseudo-class selectors' };
  }

  // Check for pseudo-elements
  if (hasPseudoElements(rule.selector)) {
    return { complexity: 'complex', reason: 'Pseudo-element selectors' };
  }

  // Check for dynamic values (var(), calc(), etc.)
  if (hasDynamicValue(decl.value)) {
    return { complexity: 'complex', reason: 'Dynamic CSS function values' };
  }

  // Check for media query nesting (can be handled, but flagged for awareness)
  if (inMediaQuery) {
    return { complexity: 'complex', reason: 'Nested in media query' };
  }

  // Check for multiple property declarations in same rule
  let declCount = 0;
  rule.walkDecls(() => {
    declCount++;
  });
  if (declCount > MAX_SIMPLE_DECLARATIONS) {
    return {
      complexity: 'complex',
      reason: 'Multiple property declarations (>3)',
    };
  }

  // Check for complex selectors (combinators, multiple classes)
  const combinatorCheck = hasComplexCombinators(rule.selector);
  if (combinatorCheck.isComplex) {
    return { complexity: 'complex', reason: combinatorCheck.reason };
  }

  // Simple: static value, no pseudo-classes, no complex selectors
  return { complexity: 'simple' };
}

/**
 * Checks if a declaration is a CSS variable (starts with --)
 * @param decl - PostCSS Declaration node
 * @returns True if it's a CSS variable
 */
function isCSSVariable(decl: Declaration): boolean {
  return decl.prop.startsWith('--');
}

/**
 * Extracts CSS rules from a PostCSS Rule node that's a variant selector
 *
 * Processes:
 * - Direct CSS rules (e.g., .rounded-lg { border-radius: 0; })
 * - Rules nested in media queries
 * - Classifies complexity (simple vs complex)
 *
 * @param rule - PostCSS Rule node (variant selector)
 * @param variantName - Variant name (e.g., "themeMono")
 * @returns Array of CSS rule overrides
 */
export function extractCSSRules(
  rule: Rule,
  variantName: string,
): Array<CSSRuleOverride> {
  const cssRules: Array<CSSRuleOverride> = [];

  // Process direct rules (not in media queries)
  processRuleChildren(rule, variantName, rule.selector, cssRules, false);

  // Process rules nested in media queries
  rule.walkAtRules('media', (mediaRule) => {
    processRuleChildren(
      mediaRule,
      variantName,
      rule.selector,
      cssRules,
      true,
      mediaRule.params,
    );
  });

  return cssRules;
}

/**
 * Processes children of a container (Rule or AtRule) to extract CSS rules
 *
 * @param container - PostCSS container (Rule or AtRule)
 * @param variantName - Variant name
 * @param originalSelector - Original parent selector
 * @param cssRules - Array to push extracted rules into
 * @param inMediaQuery - Whether processing media query children
 * @param mediaQuery - Media query params if applicable
 */
function processRuleChildren(
  container: Container<ChildNode>,
  variantName: string,
  originalSelector: string,
  cssRules: Array<CSSRuleOverride>,
  inMediaQuery: boolean,
  mediaQuery?: string,
): void {
  container.each((child) => {
    if (child.type !== 'rule') {
      return;
    }

    const nestedRule = child as Rule;

    // Process declarations in this nested rule
    nestedRule.walkDecls((decl) => {
      // Skip CSS variables - they're handled by variable-extractor
      if (isCSSVariable(decl)) {
        return;
      }

      // Check if this property maps to a theme namespace
      const mapping = mapPropertyToTheme(decl.prop);
      if (mapping === null) {
        return;
      }

      // Classify complexity
      const { complexity, reason } = classifyRuleComplexity(
        nestedRule,
        decl,
        inMediaQuery,
      );

      const override: CSSRuleOverride = {
        selector: nestedRule.selector,
        property: decl.prop,
        value: decl.value,
        variantName,
        originalSelector,
        complexity,
        reason,
      };

      if (inMediaQuery && mediaQuery !== undefined) {
        override.inMediaQuery = true;
        override.mediaQuery = mediaQuery;
      }

      cssRules.push(override);
    });
  });
}

/**
 * Filters CSS rules to only include those that can be safely resolved
 * @param rules - Array of CSS rule overrides
 * @returns Filtered array of simple, resolvable rules
 */
export function filterResolvableRules(
  rules: Array<CSSRuleOverride>,
): Array<CSSRuleOverride> {
  return rules.filter((rule) => rule.complexity === 'simple');
}

/**
 * Groups CSS rules by variant name
 * @param rules - Array of CSS rule overrides
 * @returns Map of variant name to rules
 */
export function groupRulesByVariant(
  rules: Array<CSSRuleOverride>,
): Map<string, Array<CSSRuleOverride>> {
  const grouped = new Map<string, Array<CSSRuleOverride>>();

  for (const rule of rules) {
    const existing = grouped.get(rule.variantName);
    if (existing !== undefined) {
      existing.push(rule);
    } else {
      grouped.set(rule.variantName, [rule]);
    }
  }

  return grouped;
}
