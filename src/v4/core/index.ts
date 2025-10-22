/**
 * Parser module barrel export
 * Maintains public API compatibility
 */

// Main parsing entry point
export { parseCSS } from './parser/css';

// Tailwind defaults
export {
  loadTailwindDefaults,
  mergeThemes,
  clearDefaultThemeCache,
} from './theme/defaults';

// Initial keyword filtering (public API)
export type { InitialExclusion } from './theme/filters';
export {
  extractInitialExclusions,
  filterDefaultsByExclusions,
  filterThemeByExclusions,
  matchesExclusion,
  applyInitialExclusionToTheme,
} from './theme/filters';

// Types re-exported for internal use
export type { CSSRuleConflict } from './analysis/conflicts';
export type { UnresolvedVariable } from './analysis/unresolved';
export type { CSSRuleOverride } from './extraction/rules';
