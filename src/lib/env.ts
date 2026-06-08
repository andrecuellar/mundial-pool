import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  FOOTBALL_API_PROVIDER: z
    .enum(['api-football', 'football-data', 'thesportsdb', 'mock'])
    .default('mock'),
  FOOTBALL_API_KEY: z.string().min(1).optional(),
  FOOTBALL_API_BASE_URL: z.string().url().optional(),
  RESOLUTION_CRON_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  // mailto: or https:// URL — el protocolo Web Push exige un contacto del
  // operador del sitio para abuse reports. Sin default hardcodeado (el
  // valor está en Vercel env vars como Sensitive).
  VAPID_SUBJECT: z.string().min(1).optional(),
  // Emails de los superadmins separados por coma. Si no se setea, el panel
  // /admin queda inaccesible para todos los users (404). Antes era una
  // constante hardcodeada en el código fuente.
  SUPER_ADMIN_EMAILS: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)

export type Env = z.infer<typeof schema>
