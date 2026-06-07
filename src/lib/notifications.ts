// Helper centralizado para pedir el permiso de notificaciones que cubre
// el caso del "Quieter Notification UI" de Chrome — cuando el browser
// resuelve el prompt con 'default' sin mostrar nada accionable al user.
// Sin esta detección, el flujo silenciosamente falla y el user no sabe
// por qué no le llegan notificaciones.

export type PermissionResult =
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'silent_block' } // Chrome Quieter UI bloqueó sin preguntar
  | { kind: 'unsupported' }

export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { kind: 'unsupported' }
  }
  const before = Notification.permission
  if (before === 'granted') return { kind: 'granted' }
  if (before === 'denied') return { kind: 'denied' }

  let result: NotificationPermission
  try {
    result = await Notification.requestPermission()
  } catch {
    return { kind: 'silent_block' }
  }
  if (result === 'granted') return { kind: 'granted' }
  if (result === 'denied') return { kind: 'denied' }
  // result === 'default' después de llamar requestPermission ⇒ Quieter UI:
  // Chrome (u otros) decidieron NO mostrar el prompt al user. El user no
  // hizo nada — simplemente no vio nada. Caso crítico de diagnóstico.
  return { kind: 'silent_block' }
}

// Convierte el VAPID public key base64-URL a Uint8Array para que el
// PushManager pueda usarlo. Helper compartido entre todos los puntos de
// suscripción.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// Suscribe al Web Push y postea al backend. Idempotente: si ya hay
// suscripción válida, la reusa. Devuelve true si el endpoint quedó
// registrado server-side.
export async function ensurePushSubscription(vapidPublicKey: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
    }
    const json = sub.toJSON()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    })
    return res.ok
  } catch (e) {
    console.warn('push subscription failed', e)
    return false
  }
}
