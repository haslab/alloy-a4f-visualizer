import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './test/browser',
    workers: 1,
    timeout: 30000,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        browserName: 'chromium',
        channel: process.env.E2E_CHANNEL || 'chrome',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'npm run demo',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI
    }
})
