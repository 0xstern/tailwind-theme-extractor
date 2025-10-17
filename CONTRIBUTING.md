# Contributing to Tailwind v4 Theme Extractor

Thank you for your interest in contributing to this project. This document outlines the process and guidelines for contributing.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Run tests to ensure everything is working:
   ```bash
   bun test
   ```

## Development Workflow

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint
bun run lint:fix  # Auto-fix issues
```

### Formatting

```bash
bun run format
bun run format:check  # Check without modifying
```

### Building

```bash
bun run build
```

## Code Standards

This project maintains strict code quality standards:

- **TypeScript**: No `any` types, use explicit typing
- **ESLint**: All rules must pass, zero warnings or errors
- **Prettier**: Consistent formatting with single quotes, 80 character line length
- **Testing**: All new features must include tests
- **Documentation**: Update README.md for user-facing changes

### TypeScript Guidelines

- Use `Array<T>` instead of `T[]`
- Use `import type` for type-only imports
- Prefer nullish coalescing (`??`) over logical OR (`||`)
- Use optional chaining (`?.`) for safe property access
- No magic numbers (except -1, 0, 1)
- Functions should have cyclomatic complexity under 10

### Commit Messages

Follow conventional commit format:

```
type(scope): description

feat(parser): add support for custom color scales
fix(build): resolve sourcemap generation issue
docs(readme): update installation instructions
test(integration): add tests for variant extraction
refactor(types): simplify theme interface structure
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the code standards
3. Add or update tests as needed
4. Ensure all tests pass: `bun test`
5. Ensure linting passes: `bun run lint`
6. Ensure formatting is correct: `bun run format:check`
7. Update documentation if needed
8. Submit a pull request with a clear description

### Pull Request Guidelines

- Keep changes focused and atomic
- Include tests for new features or bug fixes
- Update documentation for user-facing changes
- Ensure CI passes before requesting review
- Link any related issues

## Reporting Issues

When reporting bugs, please include:

- A clear description of the issue
- Steps to reproduce the problem
- Expected vs actual behavior
- Your environment (Node.js/Bun version, OS)
- Minimal reproduction case if possible

## Feature Requests

Feature requests are welcome. Please provide:

- Clear use case and motivation
- Proposed API or implementation approach
- Any alternative solutions considered

## Code Review

All contributions go through code review. Reviewers will check for:

- Code quality and adherence to standards
- Test coverage and quality
- Documentation completeness
- Potential edge cases or issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
