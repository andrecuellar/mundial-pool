import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin'

export const metadata = {
  title: 'Términos de uso',
  description: 'Reglas de uso de mundial-pool.',
}

export const dynamic = 'force-static'

export default function TermsPage() {
  const contact = [...SUPER_ADMIN_EMAILS][0] ?? 'acuellaravaroma@gmail.com'

  return (
    <>
      <AppHeader user={null} breadcrumb={[{ label: 'Términos de uso' }]} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <BackLink href="/" label="Inicio" className="mb-6" />
        <h1 className="text-3xl font-semibold tracking-tight">Términos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: junio de 2026.</p>

        <div className="mt-6 rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-destructive">mundial-pool NO es una casa de apuestas.</p>
          <p className="mt-2 text-muted-foreground">
            Es una aplicación para que grupos cerrados de amigos lleven el registro de sus
            predicciones del Mundial 2026 y, opcionalmente, de los aportes que cada miembro hace al
            pozo del grupo. La aplicación no procesa pagos, no transfiere dinero, no opera
            comercialmente y no se hace responsable por el dinero que circule entre los miembros.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Avisos que la aplicación muestra en sus pantallas
          </p>
          <p className="mt-3 text-muted-foreground">
            Estos son los textos exactos que verás dentro de la aplicación al usar el pozo. Forman
            parte de estos términos:
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <p className="font-medium text-foreground">En la página de inicio:</p>
              <p className="mt-1 text-muted-foreground">
                "Esto es un pool entre amigos. No es una casa de apuestas. La app solo lleva el
                registro — el dinero lo manejan ustedes fuera de la app y el reparto lo hace cada
                administrador de grupo. Únete solo a grupos de gente que conozcas. No nos hacemos
                responsables por pérdidas, fraudes o disputas entre miembros."
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground">Al ver el QR para aportar al pozo:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>La app no procesa pagos. Lo que mandes va directamente al admin del grupo.</li>
                <li>
                  El reparto del dinero al final del torneo lo hace el admin del grupo, no
                  mundial-pool.
                </li>
                <li>
                  Solo aporta si conoces personalmente al admin y confías en él. No nos hacemos
                  responsables por pérdidas, fraudes ni disputas.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground">Al crear un grupo con pozo activo:</p>
              <p className="mt-1 text-muted-foreground">
                "Al activar el pozo declaras que: solo invitarás a personas que conoces, tú
                resuelves los pagos fuera de la app, y entiendes que mundial-pool no es una casa de
                apuestas ni se hace responsable por pérdidas o disputas entre los miembros del
                grupo."
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground">
                En la administración del pozo (visible solo al creador del grupo):
              </p>
              <p className="mt-1 text-muted-foreground">
                "Tú eres responsable del dinero de este pozo. La app lleva el registro de aportes
                pero no procesa pagos ni reparte premios. Al final del torneo, tú confirmas con cada
                miembro y haces las transferencias por tu cuenta. mundial-pool no es una casa de
                apuestas y no se hace responsable por disputas, fraudes o pérdidas. Tu nombre y
                correo de Google se muestran a los miembros al ver el QR."
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground italic">
            Al usar la aplicación aceptas estos avisos en sus respectivos contextos.
          </p>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold">Aceptación</h2>
            <p className="mt-2 text-muted-foreground">
              Al usar mundial-pool aceptas estos términos. Si no estás de acuerdo, no uses la
              aplicación.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Quién puede usarla</h2>
            <p className="mt-2 text-muted-foreground">
              Debes ser mayor de edad según las leyes del país desde el que accedes. La aplicación
              está pensada para grupos privados de amigos. No la uses si en tu jurisdicción las
              quinielas o pools entre particulares son ilegales.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Cómo funciona el pozo</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>El pozo es opcional y lo activa el creador del grupo.</li>
              <li>
                Todos los aportes y pagos suceden{' '}
                <strong className="text-foreground">fuera de la aplicación</strong>, directamente
                entre los miembros. Nosotros no intermediamos ni custodiamos dinero en ningún
                momento.
              </li>
              <li>
                El creador del grupo (el "administrador") es el responsable de recibir los aportes,
                llevar el registro dentro de la aplicación y repartir el premio al final del torneo.
                La aplicación solo lleva un registro contable que ayuda al administrador, pero no
                ejecuta repartos.
              </li>
              <li>
                Al aportar al pozo le confías tu dinero directamente al administrador del grupo.
                Asegúrate de conocerlo personalmente y confiar en él antes de aportar. Su nombre y
                correo electrónico se muestran al ver el QR de aporte.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Exención de responsabilidad</h2>
            <p className="mt-2 text-muted-foreground">
              mundial-pool se ofrece "tal cual", sin garantías de ningún tipo. No nos hacemos
              responsables por:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Pérdidas de dinero, fraudes o disputas entre miembros de un grupo.</li>
              <li>El uso indebido o malintencionado que el administrador haga del pozo.</li>
              <li>
                Decisiones tomadas a partir de las predicciones, resultados o tablas mostradas.
              </li>
              <li>
                Errores en el cálculo de puntajes derivados de los datos del torneo (provistos por
                API-Football).
              </li>
              <li>Interrupciones del servicio o pérdida de datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Conducta esperada</h2>
            <p className="mt-2 text-muted-foreground">Al usar la aplicación te comprometes a:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Solo unirte y crear grupos con personas que conoces personalmente.</li>
              <li>No usar la aplicación con fines comerciales ni para apuestas profesionales.</li>
              <li>No suplantar a otras personas ni proporcionar información falsa.</li>
              <li>Respetar a los demás miembros de los grupos.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Nos reservamos el derecho de suspender el acceso de cualquier cuenta que abuse de la
              aplicación o cuyo comportamiento ponga en riesgo a otros miembros.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Propiedad intelectual</h2>
            <p className="mt-2 text-muted-foreground">
              mundial-pool y todo su contenido original son propiedad del operador. Los nombres
              "FIFA" y "Mundial 2026" son marcas de sus respectivos dueños y se usan únicamente con
              fines descriptivos. No tenemos afiliación con FIFA.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Cambios al servicio</h2>
            <p className="mt-2 text-muted-foreground">
              Podemos modificar, suspender o discontinuar la aplicación en cualquier momento sin
              previo aviso. Estos términos también pueden actualizarse; los cambios significativos
              se notificarán dentro de la aplicación.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Contacto</h2>
            <p className="mt-2 text-muted-foreground">
              Para cualquier consulta escribe a{' '}
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
