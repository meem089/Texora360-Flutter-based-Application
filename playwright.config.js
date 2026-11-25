import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  screenshot: 'on',
  video: 'on',
  trace: 'on-first-retry',

  reporter: [
    ['html', { open: 'never' }]
  ],

  use: {
    baseURL: 'http://localhost:63095',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
    headless: false,
    viewport: null,
    launchOptions: {
      args: ['--start-maximized'],
      slowMo: 1000 
    }
  },

  projects: [
    {
      name: 'chromium',
      use: {
        viewport: null,
      },
    },
  ],
});