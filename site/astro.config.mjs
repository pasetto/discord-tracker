import { defineConfig } from 'astro/config';

/**
 * Site marketing Syntra — estático, SEO-friendly, separado do app Angular.
 * @see https://docs.astro.build/en/reference/configuration-reference/
 */
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://syntra.app',
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
