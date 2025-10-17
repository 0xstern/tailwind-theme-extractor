/**
 * Tailwind Theme Extractor
 *
 * Default export - always points to the latest version
 * Currently: Tailwind v4
 *
 * @example
 * ```typescript
 * // Import latest version (currently v4)
 * import { extractTheme } from 'tailwind-theme-extractor';
 *
 * // Or import specific version
 * import { extractTheme } from 'tailwind-theme-extractor/v4';
 *
 * const result = await extractTheme({
 *   filePath: './src/theme.css'
 * });
 * ```
 */

// Export everything from v4 (current latest)
export * from './v4/index';

// Default export
export { extractTheme as default } from './v4/index';
