/**
 * Benchmarks for variable extraction performance
 * Tests the hot paths optimized with regex caching and memoization
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { bench, group, run } from 'mitata';

import {
  kebabToCamelCase,
  parseColorScale,
  parseFontSizeLineHeight,
  parseVariableName,
  variantNameToCamelCase,
} from '../../src/v4/core/parser/extractor';

// Realistic test data based on shadcn and Tailwind defaults
const colorVariables = [
  '--color-red-50',
  '--color-red-100',
  '--color-red-500',
  '--color-blue-500',
  '--color-primary',
  '--color-background',
  '--color-foreground',
  '--color-tooltip-outline-50',
  '--color-brand-500-hover',
];

const fontSizeVariables = [
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  '--text-xs--line-height',
  '--text-2xl--line-height',
];

const variantNames = [
  'dark',
  'theme-mono',
  'theme-rounded-none',
  'theme-mono.dark',
  'theme-mono.dark.hover',
  'compact.dark',
];

const kebabCaseStrings = [
  'tooltip-outline',
  'my-custom-color',
  'border-radius',
  'background-color',
  'font-family',
  'text-shadow',
  'drop-shadow',
];

// Benchmark parseVariableName (heavily used in theme building)
group('parseVariableName', () => {
  bench('single color variable', () => {
    parseVariableName('--color-red-500');
  });

  bench('complex color variable', () => {
    parseVariableName('--color-tooltip-outline-50');
  });

  bench('font size variable', () => {
    parseVariableName('--text-xl');
  });

  bench('line height variable', () => {
    parseVariableName('--text-xl--line-height');
  });

  bench('multi-word namespace', () => {
    parseVariableName('--text-shadow-lg');
  });

  bench('batch: 100 variables (cached)', () => {
    for (let i = 0; i < 100; i++) {
      parseVariableName(colorVariables[i % colorVariables.length]!);
    }
  });

  bench('batch: 100 variables (mixed)', () => {
    for (let i = 0; i < 100; i++) {
      const vars = [...colorVariables, ...fontSizeVariables];
      parseVariableName(vars[i % vars.length]!);
    }
  });
});

// Benchmark parseColorScale
group('parseColorScale', () => {
  bench('simple color scale', () => {
    parseColorScale('red-500');
  });

  bench('complex color name', () => {
    parseColorScale('tooltip-outline-50');
  });

  bench('color with suffix', () => {
    parseColorScale('brand-500-hover');
  });

  bench('non-scale color (null case)', () => {
    parseColorScale('primary');
  });

  bench('batch: 50 color scales', () => {
    const scales = [
      'red-50',
      'red-100',
      'red-200',
      'red-300',
      'red-400',
      'red-500',
      'red-600',
      'red-700',
      'red-800',
      'red-900',
      'red-950',
    ];
    for (let i = 0; i < 50; i++) {
      parseColorScale(scales[i % scales.length]!);
    }
  });
});

// Benchmark parseFontSizeLineHeight
group('parseFontSizeLineHeight', () => {
  bench('line height variant', () => {
    parseFontSizeLineHeight('xl--line-height');
  });

  bench('regular font size (null case)', () => {
    parseFontSizeLineHeight('xl');
  });

  bench('batch: 50 font size checks', () => {
    for (let i = 0; i < 50; i++) {
      parseFontSizeLineHeight(
        fontSizeVariables[i % fontSizeVariables.length]!.replace('--text-', ''),
      );
    }
  });
});

// Benchmark kebabToCamelCase (heavily cached)
group('kebabToCamelCase', () => {
  bench('simple conversion', () => {
    kebabToCamelCase('tooltip-outline');
  });

  bench('complex conversion', () => {
    kebabToCamelCase('my-custom-background-color');
  });

  bench('batch: 100 conversions (cached)', () => {
    for (let i = 0; i < 100; i++) {
      kebabToCamelCase(kebabCaseStrings[i % kebabCaseStrings.length]!);
    }
  });

  bench('batch: 100 conversions (varied)', () => {
    for (let i = 0; i < 100; i++) {
      kebabToCamelCase(`custom-prop-${i}-name`);
    }
  });
});

// Benchmark variantNameToCamelCase
group('variantNameToCamelCase', () => {
  bench('simple variant', () => {
    variantNameToCamelCase('dark');
  });

  bench('compound variant (2 levels)', () => {
    variantNameToCamelCase('theme-mono.dark');
  });

  bench('compound variant (3 levels)', () => {
    variantNameToCamelCase('theme-mono.dark.hover');
  });

  bench('batch: 50 variant conversions', () => {
    for (let i = 0; i < 50; i++) {
      variantNameToCamelCase(variantNames[i % variantNames.length]!);
    }
  });
});

// Realistic workload simulation
group('realistic workload', () => {
  bench('process 242 Tailwind color variables', () => {
    // 22 color scales * 11 stops each = 242 variables
    const colorScales = [
      'red',
      'orange',
      'amber',
      'yellow',
      'lime',
      'green',
      'emerald',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'fuchsia',
      'pink',
      'rose',
      'slate',
      'gray',
      'zinc',
      'neutral',
      'stone',
    ];
    const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    for (const color of colorScales) {
      for (const stop of stops) {
        parseVariableName(`--color-${color}-${stop}`);
        parseColorScale(`${color}-${stop}`);
        kebabToCamelCase(color);
      }
    }
  });

  bench('process shadcn theme (100+ variables)', () => {
    const variables = [
      ...colorVariables,
      ...fontSizeVariables,
      '--spacing-4',
      '--spacing-8',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--shadow-sm',
      '--shadow-md',
      '--font-sans',
      '--font-mono',
      '--font-weight-normal',
      '--font-weight-bold',
    ];

    for (let i = 0; i < 100; i++) {
      const variable = variables[i % variables.length]!;
      parseVariableName(variable);

      const key = variable.replace(/^--[^-]+-/, '');
      if (key.includes('--line-height')) {
        parseFontSizeLineHeight(key);
      } else if (/^\d+/.test(key.split('-').pop() ?? '')) {
        parseColorScale(key);
      }
      kebabToCamelCase(key);
    }
  });

  bench('process 15 theme variants', () => {
    const variants = [
      'dark',
      'theme-mono',
      'theme-mono.dark',
      'theme-rounded-none',
      'theme-rounded-none.dark',
      'theme-radius-xs',
      'theme-radius-sm',
      'theme-radius-md',
      'theme-radius-lg',
      'theme-radius-xl',
      'theme-font-normal',
      'theme-font-compact',
      'theme-font-comfortable',
      'compact.dark',
      'comfortable.dark',
    ];

    for (const variant of variants) {
      variantNameToCamelCase(variant);
    }
  });
});

await run();
