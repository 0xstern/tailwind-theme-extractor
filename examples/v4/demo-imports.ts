/**
 * Demo script showing @import resolution
 */

import { extractTheme } from '../../src/v4/index';

async function main(): Promise<void> {
  console.log('Tailwind v4 Theme Extractor - @import Demo\n');

  try {
    // Extract theme from file with imports
    const result = await extractTheme({
      filePath: './examples/v4/main-theme.css',
      resolveImports: true,
    });

    console.log('Theme extracted with imports resolved!\n');

    console.log('Statistics:');
    console.log(`  - Files processed: ${result.files.length}`);
    console.log(`  - Variables extracted: ${result.variables.length}\n`);

    console.log('Processed files:');
    for (const file of result.files) {
      console.log(`  - ${file}`);
    }

    console.log('\nColors (including imported brand colors):');
    for (const [name, value] of Object.entries(result.theme.colors)) {
      if (typeof value === 'string') {
        console.log(`  - ${name}: ${value}`);
      } else {
        const variants = Object.keys(value).length;
        console.log(`  - ${name}: ${variants} variants`);
      }
    }

    console.log('\nFont Sizes with Line Heights:');
    for (const [name, config] of Object.entries(result.theme.fontSize)) {
      if (config.lineHeight !== undefined) {
        console.log(`  - ${name}: ${config.size} / ${config.lineHeight}`);
      } else {
        console.log(`  - ${name}: ${config.size}`);
      }
    }
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
