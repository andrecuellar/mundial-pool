/**
 * Corta una promesa que se cuelga. Necesario porque las lecturas server (DB via
 * postgres.js, auth via fetch a Supabase) NO tienen timeout propio: bajo Fluid
 * Compute la instancia se congela entre requests y los sockets del pool mueren
 * sin que postgres.js se entere. La siguiente query escribe a un socket zombi y
 * se cuelga hasta que Vercel mata la función (~60s) → pantalla de error.
 *
 * Con esto, un cuelgue falla en `ms` y el error boundary de la ruta reintenta
 * con conexión fresca, en vez de dejar la app muerta un minuto.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Timeout tras ${ms}ms: ${label}`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
