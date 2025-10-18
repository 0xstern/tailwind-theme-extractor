# Tests

This directory contains the test suite for the Tailwind Theme Resolver, organized using Bun's test framework.

## Structure

```
__tests__/
├── v4/                             # Tailwind v4 tests
│   ├── index.test.ts               # Unit tests for main API
│   ├── integration.test.ts         # Integration tests with complex edge cases
│   ├── singular-variables.test.ts  # Deprecated singular variable tests
│   ├── meta-and-keyframes.test.ts  # Meta variables and keyframes tests
│   ├── tailwind-defaults.test.ts   # Tailwind default theme tests
│   └── parser/
│       └── variable-resolver.test.ts  # Unit tests for parser utilities
├── fixtures/                       # Test fixture CSS files (shared)
│   ├── main.css                    # Master test file
│   ├── base-theme.css              # Complete theme
│   ├── dark-mode.css               # Dark mode variant
│   ├── custom-themes.css           # Custom theme variants
│   ├── media-queries.css           # Media query variants
│   ├── overrides.css               # CSS cascade edge cases
│   └── imports-level1/2/3.css      # Nested import chain
└── README.md                       # This file
```

Tests are organized by Tailwind version for future-proofing (v4, future v5, etc.).

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test __tests__/v4/index.test.ts

# Run with watch mode
bun test --watch

# Run with coverage (if configured)
bun test --coverage
```

## Test Coverage

### Unit Tests

- **`v4/index.test.ts`**: Core API functionality
  - Theme resolution from `@theme` and `:root`
  - Color scale parsing
  - Variant resolution
  - Import resolution
  - Error handling

- **`v4/singular-variables.test.ts`**: Deprecated variable patterns
  - Detection of singular variables (`--spacing`, `--blur`, etc.)
  - Deprecation warning generation
  - Fallback value resolution with default keys

- **`v4/meta-and-keyframes.test.ts`**: Meta variables and animations
  - `--default-*` meta variable resolution
  - `@keyframes` animation resolution
  - Integration with theme object

- **`v4/tailwind-defaults.test.ts`**: Default theme integration
  - Tailwind default theme loading
  - Theme merging behavior
  - User overrides

- **`v4/parser/variable-resolver.test.ts`**: Parser utilities
  - Variant name resolution from selectors
  - Variable name parsing
  - kebab-case to camelCase conversion
  - Color scale parsing
  - Font size line height parsing

### Integration Tests

- **`v4/integration.test.ts`**: Comprehensive edge case testing
  - 9 CSS files with 3-level deep nested imports
  - 200+ CSS variables resolution
  - 20+ theme variants
  - All Tailwind v4 namespaces
  - Complex color naming (multi-word, camelCase, custom variants)
  - Multiple selector patterns
  - CSS cascade behavior
  - Edge cases (special characters, long values, etc.)

## Test Results

**106 tests passing** across 6 files

**Execution time**: ~40ms

## Test Fixtures

Complex test files located in `__tests__/fixtures/`:

- `main.css` - Master file importing everything
- `base-theme.css` - Complete theme with all namespaces
- `dark-mode.css` - Dark mode variant overrides
- `custom-themes.css` - 8 different theme variants
- `media-queries.css` - Media query-based variants
- `overrides.css` - CSS cascade and override edge cases
- `imports-level1/2/3.css` - 3-level nested import chain

## Writing New Tests

Follow these conventions:

1. **Location**: Place tests in `__tests__/v4/` (or future version directories)
2. **Naming**: Use `*.test.ts` suffix
3. **Organization**: Group related tests in `describe()` blocks
4. **Assertions**: Use Bun's Jest-compatible `expect()` API
5. **Imports**: Import from `../../src/v4/index` (adjust path as needed)

Example:

```typescript
import { describe, expect, test } from 'bun:test';

describe('My Feature', () => {
  test('does something', () => {
    expect(true).toBe(true);
  });
});
```

## CI/CD

Tests run automatically on:

- Pull requests
- Commits to main branch
- Pre-commit hooks (if configured)

The test suite uses Bun's built-in test runner for maximum speed and compatibility.
