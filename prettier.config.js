/**
 * Centralized Prettier configuration for the 0xstern monorepo.
 * Packages can import and extend this as needed.
 *
 * @type {import("prettier").Config}
 */
const config = {
  // Use single quotes instead of double quotes.
  // e.g. 'hello world'
  singleQuote: true,

  // Add spaces inside brackets.
  // e.g. { foo: 'bar' }
  bracketSpacing: true,

  // Add trailing commas wherever possible (including function arguments).
  // This is the strictest option and helps with version control diffs.
  trailingComma: 'all',

  // Always include parentheses around a sole arrow function parameter.
  // e.g. (x) => x * 2
  arrowParens: 'always',

  // Set the line length to 80 characters.
  printWidth: 80,

  // Set the tab width to 2 spaces.
  tabWidth: 2,

  // Require semicolons at the end of statements.
  semi: true,

  // --- Import Sorting Plugin Options ---
  // Add the plugin
  plugins: ['@ianvs/prettier-plugin-sort-imports'],

  // A list of regular expressions that match your desired import order.
  // The empty strings "" are used to create the line breaks between groups.
  importOrder: [
    '', // Isolate the top block
    '<TYPES>^[a-z]', // External types (e.g., 'hono')
    '<TYPES>^@[a-z]', // External scoped types (e.g., '@hono/zod-openapi')
    '',
    '<TYPES>^@0xstern/', // Monorepo types
    '',
    '<TYPES>^@/', // Internal alias types
    '<TYPES>^[./]', // Internal relative types
    '',
    '<BUILTIN_MODULES>', // Node.js built-in modules (just in case)
    '',
    '<THIRD_PARTY_MODULES>', // All external value imports
    '',
    '^@0xstern/', // Monorepo values
    '',
    '^@/', // Internal alias values
    '^[./]', // Internal relative values
  ],

  // This ensures that `import type {}` is always treated as a type-only import.
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
};

export default config;
