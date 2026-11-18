import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: vercel(),
  integrations: [sitemap({ filter: (page) => !/\/(admin|login|api|oeuf-alchimique)(\/|$)/.test(page) })],
  image: { service: { entrypoint: 'astro/assets/services/sharp' } }
});
