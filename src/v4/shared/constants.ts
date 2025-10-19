/**
 * Shared constants used across CLI, Vite plugin, and file generators
 */

/**
 * Output file names used by the plugin and CLI
 */
export const OUTPUT_FILES = {
  TYPES: 'types.ts',
  THEME: 'theme.ts',
  INDEX: 'index.ts',
} as const;

/**
 * Default output directories based on project structure
 */
export const DEFAULT_OUTPUT_DIRS = {
  WITH_SRC: 'src/generated/tailwindcss',
  WITHOUT_SRC: 'generated/tailwindcss',
} as const;

/**
 * Default interface name for generated theme types
 */
export const DEFAULT_INTERFACE_NAME = 'DefaultTheme';
