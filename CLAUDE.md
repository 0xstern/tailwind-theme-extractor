# Claude Code Configuration

This document provides guidelines for Claude Code when working on this project.

## Runtime Environment

- **Package Manager**: Use Bun instead of Node.js/npm
- **Running Scripts**: Use `bun run <script>` for package.json scripts
- **Built-in APIs**: Prefer Bun's built-in APIs (`Bun.serve()`, `bun:sqlite`, `WebSocket`)

## Common Commands

```bash
bun test          # Run tests
bun build         # Build the project
```

## Code Standards

### Enterprise Quality

- Zero tolerance for bugs, performance-first design
- Handle all errors gracefully, no floating promises
- Use structured logging with telemetry
- Write self-documenting code with consistent patterns

### TypeScript Rules

This project enforces strict TypeScript standards via ESLint:

- **No `any` types**: Use explicit types (`@typescript-eslint/no-explicit-any: error`)
- **Type-only imports**: Use `import type` for types (`@typescript-eslint/consistent-type-imports`)
- **Array types**: Use generic syntax `Array<T>` instead of `T[]`
- **Nullish coalescing**: Prefer `??` over `||` for null/undefined checks
- **Optional chaining**: Use `?.` for safe property access
- **Readonly by default**: Mark class properties as `readonly` when possible
- **Explicit accessibility**: Use `public`/`private`/`protected` on class members
- **No magic numbers**: Define constants for numeric literals (except -1, 0, 1)
- **Type parameter naming**: Must be `T` or `T[A-Z][A-Za-z]+` (e.g., `TData`, `TResponse`)

### Code Safety

- **No unsafe operations**: Forbidden patterns:
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-call`
- **Promise handling**: Always await or properly handle promises
  - `@typescript-eslint/no-floating-promises: error`
  - `@typescript-eslint/no-misused-promises: error`
- **Boolean expressions**: Strict boolean checks, no truthy/falsy shortcuts for strings

### Code Style

This project uses Prettier with the following configuration:

- **Quotes**: Single quotes (`'hello'`)
- **Line length**: 80 characters max
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Trailing commas**: Always (including function arguments)
- **Arrow functions**: Always use parentheses (`(x) => x`)
- **Bracket spacing**: Enabled (`{ foo: 'bar' }`)

### Import Organization

Imports are automatically sorted by Prettier with strict ordering:

1. External type imports (e.g., `import type {} from 'hono'`)
2. External scoped type imports (e.g., `import type {} from '@hono/zod-openapi'`)
3. Monorepo type imports (e.g., `import type {} from '@0xstern/...'`)
4. Internal type imports (e.g., `import type {} from '@/...'`)
5. Relative type imports (e.g., `import type {} from './types'`)
6. Node.js built-in modules
7. External value imports (third-party packages)
8. Monorepo value imports
9. Internal value imports (alias-based)
10. Relative value imports

**Always use separate type imports**: `import type { Foo } from './types'`

### JSDoc

- Use JSDoc for public APIs
- Focus on "why" not "what"
- Document parameters and return values
- ESLint will warn if missing `@param` or `@returns`

### Complexity

- Maximum cyclomatic complexity: 10 (`complexity: warn`)
- Console statements: Warn only (use structured logging in production)

## Git Commits

When creating commits:

- **Focus on business impact**, not implementation details
- **Format**: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`
  - Example: `feat(theme): add CSS variable resolution for Tailwind v4`
- **Never mention AI assistance** in commit messages

## Testing

Test files (`.test.ts`, `.spec.ts`) have relaxed rules:

- `any` types allowed
- Unsafe operations permitted
- No function length limits

## File Structure

- Source code: `src/`
- Ignored: `dist/`, `node_modules/`, `.DS_Store`
- Import alias: `@` maps to `./src`

## Additional Notes

- Prefer TypeScript strict mode settings
- All code must pass ESLint and Prettier checks before committing
- Use path aliases (`@/`) for cleaner imports
- Follow existing patterns in the codebase for consistency
