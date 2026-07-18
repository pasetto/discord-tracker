import { defineConfig } from 'astro/config';

/**
 * Site marketing Syntra — estático, SEO-friendly, separado do app Angular.
 *
 * GitHub Pages (project site):
 * - PUBLIC_SITE_URL=https://pasetto.github.io  (origem, sem path)
 * - PUBLIC_BASE_PATH=/discord-tracker
 *
 * Local/piloto: defaults em `/` e http://localhost:4321.
 *
 * @see https://docs.astro.build/en/reference/configuration-reference/
 */
const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
const basePath = process.env.PUBLIC_BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base: basePath,
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
