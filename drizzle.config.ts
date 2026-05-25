import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for drizzle-kit')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
})
