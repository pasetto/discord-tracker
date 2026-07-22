import { defineConfig } from 'vitest/config';

/**
 * Unit tests do workspace `site` (motion + pricing helpers).
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});

// Keep Vitest specs out of `astro check` type roots when editors share tsconfig.
