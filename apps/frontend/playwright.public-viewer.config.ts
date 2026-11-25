import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3196)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/public-roadmap.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `corepack pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:7896',
      ROADFORGE_DEV_API_PROXY: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:7896',
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
