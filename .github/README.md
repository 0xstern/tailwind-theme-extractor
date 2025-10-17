# GitHub Configuration

This directory contains GitHub-specific configuration for automated workflows, issue templates, and project management.

## Workflows

### CI (`workflows/ci.yml`)
Runs on all pull requests and pushes to main:
- Lints code with ESLint
- Checks formatting with Prettier
- Runs test suite
- Builds the project
- Type checks with TypeScript
- Reports bundle sizes

### Autofix (`workflows/autofix.yml`)
Automatically fixes formatting and linting issues:
- Runs Prettier formatting
- Applies ESLint auto-fixes
- Commits changes via autofix.ci

### Release (`workflows/release.yml`)
Handles NPM publishing:
- Runs full test suite
- Builds production artifacts
- Publishes to NPM with provenance
- Triggered by commits starting with `chore(release):`

## Issue Templates

### Bug Report (`ISSUE_TEMPLATE/bug_report.yml`)
Structured template for bug reports with required fields:
- Bug description
- Minimal reproduction
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Usage method (Vite/CLI/Runtime)

### Feature Request (`ISSUE_TEMPLATE/feature_request.yml`)
Template for feature suggestions:
- Problem description
- Proposed solution
- Alternatives considered
- Additional context

### Configuration (`ISSUE_TEMPLATE/config.yml`)
- Disables blank issues
- Links to Discussions for questions
- Links to documentation

## Other Files

### Pull Request Template (`pull_request_template.md`)
Standard PR template with:
- Change description
- Type of change checklist
- Testing checklist
- Documentation checklist
- Related issues

### Funding (`FUNDING.yml`)
GitHub Sponsors and custom funding links

### Security Policy (`SECURITY.md`)
Security vulnerability reporting guidelines

## Setup Requirements

### Secrets
Configure these in GitHub repository settings:

1. **NPM_TOKEN** (required for releases)
   - Generate at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Required scopes: publish packages

### Branch Protection (Recommended)

For the `main` branch:
- Require pull request reviews
- Require status checks to pass:
  - Test & Lint
  - Bundle Size
- Require branches to be up to date
- Require linear history

## Usage

### Running Workflows Locally

Test workflows before pushing:

```bash
# Install act (GitHub Actions local runner)
brew install act

# Run CI workflow
act pull_request

# Run specific job
act pull_request -j test
```

### Manual Release

To publish a new version:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit with message: `chore(release): v0.1.0`
4. Push to main
5. Release workflow will publish to NPM automatically

### Autofix Usage

The autofix workflow runs automatically on PRs. To trigger manually:

```bash
git commit --allow-empty -m "trigger autofix"
git push
```

Changes will be committed automatically by the autofix.ci bot.

## Maintenance

### Updating Actions

Keep GitHub Actions up to date:

```bash
# Check for outdated actions
gh extension install mheap/gh-action-upgrade

# Upgrade actions
gh action-upgrade
```

### Monitoring

- Check workflow runs: https://github.com/0xstern/tailwind-theme-extractor/actions
- Review security alerts: https://github.com/0xstern/tailwind-theme-extractor/security
- Monitor Dependabot PRs for dependency updates
