# Test Organization

Test structure and organization for the tailwind-resolver project.

---

## Directory Structure

```
test/
└── v4/
    ├── analysis/            # Analysis module tests
    │   ├── conflicts_test.ts
    │   └── unresolved_test.ts
    ├── cli/                 # CLI tests
    │   └── index_test.ts
    ├── core/                # Core parser tests
    │   ├── css_test.ts
    │   ├── extractor_test.ts
    │   └── imports_test.ts
    ├── extraction/          # Extraction module tests
    │   └── rules_test.ts
    ├── integration/         # Integration tests (feature workflows)
    │   ├── color_scale_resolution_test.ts
    │   ├── complex_css_functions_test.ts
    │   ├── conflict_detection_pipeline_test.ts
    │   ├── edge_cases_test.ts
    │   ├── import_resolution_test.ts
    │   ├── initial_keyword_test.ts
    │   ├── meta_and_keyframes_test.ts
    │   ├── nested_variant_test.ts
    │   ├── override_system_test.ts
    │   ├── shadcn_integration_test.ts
    │   ├── singular_variables_test.ts
    │   ├── unresolved_detection_pipeline_test.ts
    │   ├── variant_resolution_test.ts
    │   └── vite_plugin_integration_test.ts
    ├── reporting/           # Reporting module tests
    │   ├── conflicts_test.ts
    │   └── unresolved_test.ts
    ├── shared/              # Shared utilities tests
    │   ├── file_generator_test.ts
    │   ├── spacing_helper_test.ts
    │   ├── type_generator_test.ts
    │   └── utils_test.ts
    ├── theme/               # Theme builder tests
    │   ├── builder_test.ts
    │   ├── defaults_test.ts
    │   ├── filters_test.ts
    │   └── overrides_test.ts
    ├── vite/                # Vite plugin tests
    │   └── plugin_test.ts
    ├── fixtures/            # Shared test fixtures
    │   └── *.css            # All fixture files use snake_case
    ├── utils/               # Test utilities
    └── index_test.ts        # Core API tests
```

---

## Test Categories

### Unit Tests

Unit tests verify individual functions and modules in isolation.

**Requirements:**

- Test a single function or class
- Mock external dependencies
- Execute quickly (&lt; 100ms per test)
- Focus on edge cases and error handling

**Location Pattern**: `test/v4/{module}/{file}_test.ts`

Example: `src/v4/core/parser/extractor.ts` → `test/v4/core/extractor_test.ts`

**Run unit tests:**

```bash
bun run test:unit
```

### Integration Tests

Integration tests verify feature workflows and how multiple modules work together.

**Requirements:**

- Test complete feature workflows
- Use real dependencies (minimal mocking)
- Verify module interactions
- Test with realistic data

**Location Pattern**: `test/v4/integration/{feature_name}_test.ts`

Example: `color_scale_resolution_test.ts`, `conflict_detection_pipeline_test.ts`

**Run integration tests:**

```bash
bun run test:integration
```

### E2E Tests

End-to-end tests verify complete user workflows from start to finish.

**Requirements:**

- Test entire application flows
- Use no mocking
- Verify file I/O, CLI interactions, and plugin behavior
- Test real-world scenarios

**Location Pattern**: `test/v4/e2e/{workflow_name}_test.ts`

Example: `vite_plugin_workflow_test.ts`, `cli_workflow_test.ts`

**Run E2E tests:**

```bash
bun run test:e2e
```

---

## Test Fixtures

Shared test fixtures are located in `test/v4/fixtures/`.

**Fixture Requirements:**

- Minimal but representative
- Well-documented with comments
- Reusable across multiple tests

---

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

---

## Current Test Status

- **Total Tests**: 703
- **Test Files**: 33 files
- **Execution Time**: ~500ms
- **Pass Rate**: 100%

---

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

- **Test files**: `{feature_name}_test.ts` (snake_case with `_test` suffix)
- **Fixture files**: `{fixture_name}.css` (snake_case)
- **Test suites**: Use descriptive names: `describe('Color Scale Resolution', ...)`
- **Test cases**: Start with lowercase verb: `test('resolves standard numeric color scales', ...)`

### Best Practices

**1. One assertion per test** (when possible)

**2. Arrange-Act-Assert pattern:**

```typescript
// Arrange
const input = '...';

// Act
const result = functionToTest(input);

// Assert
expect(result).toBe(expected);
```

**3. Test behavior, not implementation**

**4. Use descriptive test names** that explain what is being tested

**5. Keep tests independent** - no shared state between tests

**6. Clean up resources** - use try/finally or afterEach for cleanup

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

---

## Test Coverage Goals

- **Unit tests**: 80%+ line coverage
- **Integration tests**: Cover all major feature workflows
- **E2E tests**: Cover critical user paths (CLI, Vite plugin)

---

## Adding New Tests

When adding new functionality:

1. **Write unit tests first** for new functions/modules
2. **Add integration tests** for new features
3. **Add E2E tests** for new user-facing workflows
4. **Update this README** if adding new test categories or patterns

---

## Continuous Integration

All tests must pass before:

- Merging pull requests
- Publishing new versions
- Deploying to production

The `prepublishOnly` script automatically runs linting and tests before publishing.

---

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

---

## References

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Project architecture
