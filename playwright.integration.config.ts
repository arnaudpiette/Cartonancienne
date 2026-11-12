import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base, testMatch: '**/reservation.integration.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4323' },
  webServer: [
    { command: 'node tests/support/local-booking-server.mjs', url: 'http://127.0.0.1:55433/health', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4323 --ignore-lock', url: 'http://127.0.0.1:4323/reservation', reuseExistingServer: false,
      env: { ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_SITE_URL: 'http://127.0.0.1:4323', PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55433', PUBLIC_SUPABASE_ANON_KEY: 'local-test-placeholder', PRIVATE_RESEND_API_KEY: '', PRIVATE_ADMIN_EMAIL: 'admin@example.test', PRIVATE_BOOKING_MAIL_MODE: 'simulation', PRIVATE_BOOKING_MAIL_SIMULATE_FAILURES: 'customer,admin' },
    },
  ],
});
