/**
 * Tailwind Theme Resolver
 *
 * Default export - always points to the latest version
 * Currently: Tailwind v4
 *
 * @example
 * ```typescript
 * // Import latest version (currently v4)
 * import { resolveTheme } from 'tailwind-resolver';
 *
 * // Or import specific version
 * import { resolveTheme } from 'tailwind-resolver/v4';
 *
 * const result = await resolveTheme({
 *   filePath: './src/theme.css'
 * });
 * ```
 */

// Export everything from v4 (current latest)
export * from './v4/index';

// Default export
export { resolveTheme as default } from './v4/index';
