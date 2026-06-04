import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { ClientErrorReporter } from '@/components/app-shell/client-error-reporter'
import { NavigationProgress } from '@/components/app-shell/navigation-progress'
import { ThemeProvider } from '@/components/app-shell/theme-provider'
import { ServiceWorkerRegistration } from '@/components/notifications/sw-registration'
import { InstallAppLink } from '@/components/pwa/install-app-link'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const SITE_URL = 'https://mundial-pool.vercel.app'
const SITE_TITLE = 'mundial-pool · El pool del Mundial 2026 entre amigos'
const SITE_DESCRIPTION =
  'Predice solo lo que importa del Mundial 2026: 48 selecciones, 14 categorías, sin partidos aburridos. Pool entre amigos, no casa de apuestas.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · mundial-pool',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'mundial-pool',
  keywords: [
    'Mundial 2026',
    'World Cup 2026',
    'pool',
    'pollas',
    'predicciones',
    'quiniela',
    'fútbol',
    'futbol',
  ],
  authors: [{ name: 'mundial-pool' }],
  creator: 'mundial-pool',
  publisher: 'mundial-pool',
  appleWebApp: {
    capable: true,
    title: 'mundial-pool',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    alternateLocale: ['es_MX', 'es_AR', 'es_ES', 'es_PE'],
    siteName: 'mundial-pool',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}

export const viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <NavigationProgress />
            {children}
            <footer className="mt-auto border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6">
              <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
                <span>mundial-pool · Mundial 2026 entre amigos</span>
                <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <InstallAppLink />
                  <Link
                    href="/privacy"
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Política de privacidad
                  </Link>
                  <Link
                    href="/terms"
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Términos de uso
                  </Link>
                </nav>
              </div>
            </footer>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
        <ClientErrorReporter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
