import { spawnSync } from 'node:child_process'

if (!process.env.ALLOY_WEB_API_URL) {
    console.error('Set ALLOY_WEB_API_URL to a running Alloy Web API, e.g. http://localhost:4001')
    process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', 'test/projection-ground-truth.test.js'], {
    stdio: 'inherit',
    env: process.env
})

process.exit(result.status ?? 1)
