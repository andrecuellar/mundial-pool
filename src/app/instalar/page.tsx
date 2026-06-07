import type { Metadata } from 'next'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { InstallarClient } from './instalar-client'

export const metadata: Metadata = {
  title: 'Instala mundial-pool en Android',
  description:
    'Bajá el .apk de mundial-pool para Android y dejá las notificaciones del Mundial 2026 listas.',
}

export const dynamic = 'force-static'

export default function InstalarPage() {
  return (
    <>
      <AppHeader user={null} breadcrumb={[{ label: 'Instalar' }]} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <BackLink href="/" label="Inicio" className="mb-6" />

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Bajá mundial-pool para Android
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Versión .apk para Android. Te llegan las notificaciones del Mundial 2026 como app nativa
          — recordatorios de cierre, confirmación de pago al pozo, y cuando ganes puntos.
        </p>

        <InstallarClient />

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Cómo instalar</h2>
          <ol className="mt-4 space-y-4">
            <li className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">1. Bajá el archivo</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Toca el botón "Descargar APK". El archivo pesa ~1 MB. Si tu navegador pregunta si
                quieres "Mantener" el archivo, decí que sí.
              </p>
            </li>

            <li className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">
                2. Permití instalar desde fuentes desconocidas
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Android te va a pedir permitir que tu navegador (Chrome / Drive / Telegram /
                WhatsApp) instale aplicaciones. Permitilo.
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-primary">
                  ¿No te aparece el botón? Toca acá según tu marca
                </summary>
                <div className="mt-2 space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground">Samsung / One UI:</strong> Ajustes →
                    Biometría y seguridad → Instalar aplicaciones desconocidas → habilita el
                    navegador que usaste.
                  </p>
                  <p>
                    <strong className="text-foreground">Xiaomi / MIUI / HyperOS:</strong> Ajustes →
                    Protección de privacidad → Permisos especiales → Instalar apps desconocidas →
                    habilita el navegador. Si MIUI te pide deshabilitar "Optimización MIUI",
                    hacelo temporalmente.
                  </p>
                  <p>
                    <strong className="text-foreground">Otras marcas:</strong> Ajustes → Apps →
                    Permisos especiales → Instalar apps desconocidas.
                  </p>
                </div>
              </details>
            </li>

            <li className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">3. Si te sale "No se instaló" → Play Protect</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Es el antivirus de Google bloqueando apps que no vengan del Play Store. Lo
                desactivás un minuto y prendés de nuevo después:
              </p>
              <ol className="mt-2 ml-4 list-decimal space-y-0.5 text-xs text-muted-foreground leading-relaxed">
                <li>Abre Play Store → tu foto de perfil arriba a la derecha.</li>
                <li>"Play Protect" → ícono de engranaje.</li>
                <li>Desactivá "Buscar amenazas de seguridad".</li>
                <li>Vuelvé al .apk e instalá.</li>
                <li>Después de instalar, regresá y prendé Play Protect de nuevo.</li>
              </ol>
            </li>

            <li className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">4. Abrí la app y aceptá las notificaciones</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Cuando abras mundial-pool desde el launcher, vas a ver la pantalla de bienvenida.
                Tocá <strong className="text-foreground">"Iniciar"</strong>. Android te va a
                preguntar si querés recibir notificaciones —{' '}
                <strong className="text-foreground">decí que SÍ</strong> para enterarte de cuándo
                cierran las predicciones y cuándo ganás puntos.
              </p>
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Preguntas frecuentes</h2>
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">¿Es seguro?</summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Sí. La app es la misma versión web que usás en{' '}
              <a className="underline" href="https://mundial-pool.vercel.app">
                mundial-pool.vercel.app
              </a>{' '}
              empaquetada como APK. No accede a tus contactos, ubicación ni archivos. El único
              permiso que pide es notificaciones, y solo si vos decís que sí.
            </p>
          </details>
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              ¿Por qué no está en Play Store?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Es un proyecto entre amigos sin fines comerciales. Pagar la cuenta de desarrollador
              ($25 USD) no se justifica para algo que dura unas semanas.
            </p>
          </details>
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              ¿Puedo usar la versión web en lugar del .apk?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Sí, andá a{' '}
              <a className="underline" href="/login">
                mundial-pool.vercel.app/login
              </a>{' '}
              desde Chrome. Las notificaciones funcionan igual si las activás, aunque a veces
              Chrome bloquea el prompt automático en sitios nuevos — la app nativa lo hace más
              fácil.
            </p>
          </details>
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">¿Tengo iPhone?</summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              No hay versión para iOS — Apple cobra $99 USD al año por publicar. Usá la web
              directo desde Safari. Si querés que se sienta como app, en Safari tocá Compartir →
              "Añadir a inicio".
            </p>
          </details>
        </section>
      </main>
    </>
  )
}
