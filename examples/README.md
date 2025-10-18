# Examples

This directory contains example CSS theme files and demonstration scripts for the Tailwind Theme Resolver.

## CSS Theme Files

### `basic-theme.css`

A complete example theme demonstrating all supported Tailwind v4 namespaces:

- Color definitions with scales (primary, secondary, tertiary)
- Font families and sizes with line heights
- Spacing and border radius
- Shadows and animations
- Breakpoints

**Use case**: Starting point for building your own custom theme.

### `main-theme.css` + `base-colors.css`

Demonstrates the `@import` resolution feature:

- `main-theme.css` - Main theme file that imports base colors
- `base-colors.css` - Shared color definitions

**Use case**: Organizing themes across multiple files for better maintainability.

## Demo Scripts

### `demo.ts`

Complete feature demonstration showing:

- Theme resolution from CSS files
- Accessing all theme namespaces
- Statistics about resolved variables
- Example usage with chart libraries

**Run it:**

```bash
bun run examples/v4/demo.ts
```

**Output includes:**

- File statistics (files processed, variables resolved)
- All colors with their values
- Font definitions
- Breakpoints, shadows, and animations
- Example usage code snippet
- Full theme object as JSON

### `demo-imports.ts`

Focused demonstration of `@import` resolution:

- Multi-file theme processing
- Tracking which files were processed
- Accessing imported theme values

**Run it:**

```bash
bun run examples/v4/demo-imports.ts
```

**Output includes:**

- List of processed files
- Colors from both main and imported files
- Font sizes with line heights

## Creating Your Own Theme

1. Start with `basic-theme.css` as a template
2. Modify the CSS variables to match your design system
3. Use the demo scripts to test your theme resolution
4. Integrate the resolved theme into your application

## Key Features Demonstrated

- **Complete namespace coverage** - All Tailwind v4 theme namespaces
- **@import resolution** - Recursive import processing
- **Color scales** - Numeric variants (50-900) and custom scales
- **Font sizes** - With automatic line height parsing
- **Type safety** - Full TypeScript support for theme objects
- **Error handling** - Graceful error reporting

## Integration Examples

### Chart Libraries

```typescript
import { resolveTheme } from 'tailwind-theme-resolver';

const { theme } = await resolveTheme({
  filePath: './examples/v4/basic-theme.css',
});

// Use in Chart.js, Recharts, etc.
const colors = [
  theme.colors.primary[500],
  theme.colors.secondary[500],
  theme.colors.tertiary[500],
];
```

### Canvas Rendering

```typescript
const { theme } = await resolveTheme({
  filePath: './theme.css',
});

// Use in canvas where CSS variables aren't accessible
ctx.fillStyle = theme.colors.primary[600];
ctx.font = `${theme.fontSize.xl.size} ${theme.fonts.sans}`;
```

### Build Tools

```typescript
// Generate theme tokens at build time
const { theme, variants } = await resolveTheme({
  filePath: './src/theme.css',
  resolveImports: true,
});

// Export as JSON for other tools
await Bun.write('./dist/theme.json', JSON.stringify(theme, null, 2));
```

## Additional Resources

- See `__tests__/v4/` for comprehensive test examples and edge cases
- Check the main README.md for complete API documentation
- Review TypeScript type definitions in `src/v4/types.ts`
