const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 300000,
  expect: { timeout: 5000 },
  reporter: [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:5000',
    viewport: { width: 1600, height: 1400 },
    actionTimeout: 5000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});