/**
 * Demo script showing how to use the theme extractor
 */

import { extractTheme } from '../../src/v4/index';

const JSON_INDENT_SPACES = 2;

// eslint-disable-next-line complexity
async function main(): Promise<void> {
  console.log('Tailwind v4 Theme Extractor Demo\n');

  try {
    // Extract theme from the example CSS file
    const result = await extractTheme({
      filePath: './examples/v4/basic-theme.css',
      resolveImports: true,
    });

    console.log('Theme extracted successfully!\n');

    // Display statistics
    console.log('Statistics:');
    console.log(`  - Files processed: ${result.files.length}`);
    console.log(`  - Variables extracted: ${result.variables.length}\n`);

    // Display colors
    console.log('Colors:');
    for (const [name, value] of Object.entries(result.theme.colors)) {
      if (typeof value === 'string') {
        console.log(`  - ${name}: ${value}`);
      } else {
        console.log(`  - ${name}:`);
        for (const [variant, color] of Object.entries(value)) {
          console.log(`    - ${variant}: ${color}`);
        }
      }
    }

    // Display fonts
    if (Object.keys(result.theme.fonts).length > 0) {
      console.log('\nFonts:');
      for (const [name, value] of Object.entries(result.theme.fonts)) {
        console.log(`  - ${name}: ${value}`);
      }
    }

    // Display breakpoints
    if (Object.keys(result.theme.breakpoints).length > 0) {
      console.log('\nBreakpoints:');
      for (const [name, value] of Object.entries(result.theme.breakpoints)) {
        console.log(`  - ${name}: ${value}`);
      }
    }

    // Display shadows
    if (Object.keys(result.theme.shadows).length > 0) {
      console.log('\nShadows:');
      for (const [name, value] of Object.entries(result.theme.shadows)) {
        console.log(`  - ${name}: ${value}`);
      }
    }

    // Display animations
    if (Object.keys(result.theme.animations).length > 0) {
      console.log('\nAnimations:');
      for (const [name, value] of Object.entries(result.theme.animations)) {
        console.log(`  - ${name}: ${value}`);
      }
    }

    // Example usage in a chart library context
    console.log('\nExample usage with charts:');
    console.log('```javascript');
    console.log('const chartColors = [');
    if (
      result.theme.colors.primary !== undefined &&
      typeof result.theme.colors.primary !== 'string'
    ) {
      console.log(`  '${result.theme.colors.primary[500]}',`);
    }
    if (
      result.theme.colors.secondary !== undefined &&
      typeof result.theme.colors.secondary !== 'string'
    ) {
      console.log(`  '${result.theme.colors.secondary[500]}',`);
    }
    console.log('];');
    console.log('```');

    // Show raw JSON output
    console.log('\nFull theme object:');
    console.log(JSON.stringify(result.theme, null, JSON_INDENT_SPACES));
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}

main().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
