import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: ['**/reservation.spec.ts', '**/site.spec.ts'], fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4322', headless: true, timezoneId: 'America/New_York',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4322 --ignore-lock',
    url: 'http://127.0.0.1:4322/reservation', reuseExistingServer: false,
    env: { ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_SITE_URL: 'http://127.0.0.1:4322', PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '', PRIVATE_RESEND_API_KEY: '', PRIVATE_ADMIN_EMAIL: '', PRIVATE_BOOKING_MAIL_MODE: 'simulation' },
  },
  reporter: 'list',
});
