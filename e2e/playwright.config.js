// @ts-check
const { defineConfig } = require('@playwright/test')

// The stack (suite/compose.yaml) is started beforehand; this only drives a browser against it.
module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1300, height: 820 },
    locale: 'fr-FR',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
})
