# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Do not** open a public issue
2. Email: mrsirstern@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You can expect:

- Initial response within 48 hours
- Regular updates on progress
- Credit in the security advisory (if desired)

## Security Best Practices

When using this library:

1. **Keep dependencies updated**: Regularly update to the latest version
2. **Review generated files**: Check generated TypeScript files before committing
3. **Validate CSS input**: Ensure CSS files come from trusted sources
4. **Enable debug mode cautiously**: Debug mode logs file paths and may expose sensitive information

## Known Security Considerations

- The library parses CSS files and resolves `@import` statements
- File system access is required for CSS parsing
- Generated TypeScript files should be reviewed before deployment
