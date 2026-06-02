import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { NavigationProgress } from '@/components/app-shell/navigation-progress'
import { ThemeProvider } from '@/components/app-shell/theme-provider'
import { ServiceWorkerRegistration } from '@/components/notifications/sw-registration'
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

export const metadata: Metadata = {
  title: 'mundial-pool',
  description: 'El pool del Mundial 2026 entre amigos',
  appleWebApp: {
    capable: true,
    title: 'mundial-pool',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
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
                <nav className="flex items-center gap-4">
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
      </body>
    </html>
  )
}
