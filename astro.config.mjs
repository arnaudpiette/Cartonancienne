import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: vercel(),
  integrations: [sitemap()],
  image: { service: { entrypoint: 'astro/assets/services/sharp' } }
});
