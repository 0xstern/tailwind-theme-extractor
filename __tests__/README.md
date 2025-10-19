# Test Organization

This document describes the test structure and organization for the tailwind-resolver project.

## Directory Structure

```
__tests__/
└── v4/
    ├── unit/                # Unit tests (isolated component testing)
    │   ├── parser/          # Parser module tests
    │   │   ├── conflict-reporter.test.ts
    │   │   ├── conflict-resolver.test.ts
    │   │   ├── css-rule-extractor.test.ts
    │   │   ├── tailwind-defaults.test.ts
    │   │   └── variable-extractor.test.ts
    │   └── index.test.ts    # Core API tests
    ├── integration/         # Integration tests (feature workflows)
    │   ├── color-scale-resolution.test.ts
    │   ├── complex-css-functions.test.ts
    │   ├── comprehensive-edge-cases.test.ts
    │   ├── conflict-detection-pipeline.test.ts
    │   ├── import-resolution.test.ts
    │   ├── meta-and-keyframes.test.ts
    │   ├── nested-variant.test.ts
    │   ├── shadcn-integration.test.ts
    │   ├── singular-variables.test.ts
    │   └── variant-resolution.test.ts
    ├── e2e/                 # End-to-end tests (complete workflows)
    └── fixtures/            # Shared test fixtures
        └── *.css
```

## Test Categories

### Unit Tests (`__tests__/v4/unit/`)

Unit tests verify individual functions and modules in isolation. They should:

- Test a single function or class
- Mock external dependencies
- Execute quickly (< 100ms per test)
- Focus on edge cases and error handling

**Location Pattern**: `__tests__/v4/unit/{module}/{file}.test.ts`

Example: `src/v4/parser/variable-extractor.ts` → `__tests__/v4/unit/parser/variable-extractor.test.ts`

**Run unit tests:**

```bash
bun run test:unit
```

### Integration Tests (`__tests__/v4/integration/`)

Integration tests verify feature workflows and how multiple modules work together. They should:

- Test complete feature workflows
- Use real dependencies (minimal mocking)
- Verify module interactions
- Test with realistic data

**Location Pattern**: `__tests__/v4/integration/{feature-name}.test.ts`

Example: `color-scale-resolution.test.ts`, `conflict-detection-pipeline.test.ts`

**Run integration tests:**

```bash
bun run test:integration
```

### E2E Tests (`__tests__/v4/e2e/`)

End-to-end tests verify complete user workflows from start to finish. They should:

- Test entire application flows
- Use no mocking
- Verify file I/O, CLI interactions, and plugin behavior
- Test real-world scenarios

**Location Pattern**: `__tests__/v4/e2e/{workflow-name}.test.ts`

Example: `vite-plugin-workflow.test.ts`, `cli-workflow.test.ts`

**Run E2E tests:**

```bash
bun run test:e2e
```

## Test Fixtures

Shared test fixtures are located in `__tests__/v4/fixtures/`. These include:

- CSS theme files
- Sample configurations
- Expected output data

Fixtures should be:

- Minimal but representative
- Well-documented with comments
- Reusable across multiple tests

## Running Tests

```bash
# Run all tests
bun test

# Run specific test categories
bun run test:unit          # Unit tests only (102 tests)
bun run test:integration   # Integration tests only (184 tests)
bun run test:e2e           # E2E tests only

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run a specific test file
bun test path/to/test.ts
```

## Current Test Status

- **Total Tests**: 291
- **Unit Tests**: 102 tests across 5 files
- **Integration Tests**: 184 tests across 10 files
- **E2E Tests**: 0 tests (planned)
- **Execution Time**: ~135ms
- **Pass Rate**: 100%

## Writing Tests

### Test File Template

```typescript
/**
 * {Description of what this test file covers}
 */

import { describe, expect, test } from 'bun:test';

import { functionToTest } from '../../../src/v4/module';

describe('{Feature/Module Name}', () => {
  test('{what it should do}', () => {
    const result = functionToTest(input);
    expect(result).toBe(expected);
  });
});
```

### Naming Conventions

- **Test files**: `{feature-name}.test.ts`
- **Test suites**: Use descriptive names: `describe('Color Scale Resolution', ...)`
- **Test cases**: Start with lowercase verb: `test('resolves standard numeric color scales', ...)`

### Best Practices

1. **One assertion per test** (when possible)
2. **Arrange-Act-Assert pattern**:

   ```typescript
   // Arrange
   const input = '...';

   // Act
   const result = functionToTest(input);

   // Assert
   expect(result).toBe(expected);
   ```

3. **Test behavior, not implementation**
4. **Use descriptive test names** that explain what is being tested
5. **Keep tests independent** - no shared state between tests
6. **Clean up resources** - use try/finally or afterEach for cleanup

### Constants

Define test constants at the top of the file for magic numbers:

```typescript
const EXPECTED_FILE_COUNT = 9;
const MIN_VARIANT_COUNT = 20;
const TIMEOUT_MS = 5000;
```

### Error Testing

Test error cases explicitly:

```typescript
test('throws error when input is invalid', () => {
  expect(() => functionToTest(invalidInput)).toThrow('Expected error message');
});

// For async functions
test('rejects with error for invalid input', async () => {
  await expect(asyncFunction(invalidInput)).rejects.toThrow('Error message');
});
```

## Test Coverage Goals

- **Unit tests**: 80%+ line coverage
- **Integration tests**: Cover all major feature workflows
- **E2E tests**: Cover critical user paths (CLI, Vite plugin)

## Adding New Tests

When adding new functionality:

1. **Write unit tests first** for new functions/modules
2. **Add integration tests** for new features
3. **Add E2E tests** for new user-facing workflows
4. **Update this README** if adding new test categories or patterns

## Continuous Integration

All tests must pass before:

- Merging pull requests
- Publishing new versions
- Deploying to production

The `prepublishOnly` script automatically runs linting and tests before publishing.

## Troubleshooting

### Tests Failing Locally

1. Ensure you're using the correct Bun version
2. Clear any cached dependencies: `rm -rf node_modules && bun install`
3. Check for environment-specific issues (file paths, line endings)

### Flaky Tests

If tests are flaky (passing/failing intermittently):

1. Check for race conditions
2. Ensure proper cleanup in `afterEach`
3. Avoid depending on timing or external services
4. Use deterministic test data

### Debugging Tests

```bash
# Run a single test file with debugging
bun test path/to/test.ts

# Run tests matching a pattern
bun test --grep "pattern to match"
```

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- Project Architecture: `ARCHITECTURE.md`
