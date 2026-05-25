import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { runResolution } = await import('../src/server/resolution')
  console.info('Running resolution...')
  const result = await runResolution()
  console.info('Run ID:', result.runId)
  console.info('Summary:')
  for (const [key, value] of Object.entries(result.summary)) {
    console.info(`  ${key}: ${value}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
