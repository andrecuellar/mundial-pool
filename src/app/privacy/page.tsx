import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin'

export const metadata = {
  title: 'Política de privacidad',
  description: 'Cómo mundial-pool maneja tus datos personales.',
}

export const dynamic = 'force-static'

export default function PrivacyPage() {
  const contact = [...SUPER_ADMIN_EMAILS][0] ?? 'acuellaravaroma@gmail.com'

  return (
    <>
      <AppHeader user={null} breadcrumb={[{ label: 'Política de privacidad' }]} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <BackLink href="/" label="Inicio" className="mb-6" />
        <h1 className="text-3xl font-semibold tracking-tight">Política de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: junio de 2026.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold">Quiénes somos</h2>
            <p className="mt-2 text-muted-foreground">
              mundial-pool es un pool privado de predicciones del Mundial 2026 hecho para grupos de
              amigos. No somos una casa de apuestas, no procesamos pagos ni operamos comercialmente.
              La aplicación está disponible en{' '}
              <a className="underline" href="https://mundial-pool.vercel.app">
                https://mundial-pool.vercel.app
              </a>{' '}
              y está operada por un particular como proyecto personal.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Datos que recolectamos</h2>
            <p className="mt-2 text-muted-foreground">
              Para que puedas usar la aplicación recolectamos únicamente:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Correo electrónico</strong> y, si te autenticas
                con Google, tu <strong className="text-foreground">nombre</strong> y
                <strong className="text-foreground"> foto de perfil</strong> pública. Los usamos
                para identificarte dentro de los grupos.
              </li>
              <li>
                <strong className="text-foreground">Tus predicciones</strong> del Mundial 2026.
              </li>
              <li>
                <strong className="text-foreground">El grupo al que perteneces</strong> y tu rol
                (creador o miembro).
              </li>
              <li>
                <strong className="text-foreground">Registros de aportes al pozo</strong> que el
                administrador del grupo registra manualmente. La aplicación no procesa pagos: los
                pagos suceden fuera de la aplicación entre los miembros del grupo.
              </li>
              <li>
                <strong className="text-foreground">Datos técnicos básicos</strong> generados por la
                infraestructura: dirección IP, tipo de navegador y logs de errores. Los usamos solo
                para diagnosticar problemas.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              No recolectamos información financiera, números de tarjeta ni datos sensibles.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Cómo usamos tus datos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Para autenticarte y darte acceso a tus grupos.</li>
              <li>Para mostrar tu nombre, foto y predicciones a los demás miembros del grupo.</li>
              <li>Para calcular puntajes y la tabla de líderes después de cada partido.</li>
              <li>Para enviarte notificaciones push si las activaste voluntariamente.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              No vendemos ni compartimos tus datos con terceros con fines comerciales o
              publicitarios.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Servicios de terceros</h2>
            <p className="mt-2 text-muted-foreground">
              Para operar la aplicación nos apoyamos en estos proveedores, que procesan algunos
              datos en nuestro nombre:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Supabase</strong> — autenticación y base de
                datos.
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong> — hosting y entrega de la
                aplicación.
              </li>
              <li>
                <strong className="text-foreground">Google</strong> — solo si decides iniciar sesión
                con tu cuenta de Google.
              </li>
              <li>
                <strong className="text-foreground">API-Football</strong> — proveedor de datos
                oficiales del Mundial (no recibe datos personales tuyos).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Visibilidad dentro de la aplicación</h2>
            <p className="mt-2 text-muted-foreground">
              Tu nombre, foto y predicciones son visibles para los demás miembros de los grupos a
              los que te unas. Si eres el creador de un grupo, tu nombre y correo electrónico se
              muestran a los miembros al ver el QR de aporte al pozo para que sepan a quién le están
              enviando dinero.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Tus derechos</h2>
            <p className="mt-2 text-muted-foreground">
              Puedes solicitar en cualquier momento que eliminemos tu cuenta y todos los datos
              asociados escribiéndonos a{' '}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              . Atenderemos la solicitud en un plazo razonable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Retención y seguridad</h2>
            <p className="mt-2 text-muted-foreground">
              Conservamos tus datos mientras tu cuenta esté activa. Los datos están almacenados en
              infraestructura cifrada gestionada por Supabase y Vercel. No podemos garantizar
              seguridad absoluta — al usar la aplicación aceptas que ningún sistema en línea es 100%
              seguro.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Cambios a esta política</h2>
            <p className="mt-2 text-muted-foreground">
              Podemos actualizar esta política. Si los cambios son significativos te avisaremos
              dentro de la aplicación.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Contacto</h2>
            <p className="mt-2 text-muted-foreground">
              Para cualquier pregunta sobre privacidad escribe a{' '}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
