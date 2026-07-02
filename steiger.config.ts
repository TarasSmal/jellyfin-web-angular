import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/**'],
    rules: {
      // Slices start life with a single segment; don't force premature splitting.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
