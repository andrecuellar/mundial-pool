// Registry of Web Push notification types. The `key` is what gets stored
// in notification_preferences.type when a user opts out. Adding a new type
// here is the single source — UI and sender code pull from this list.
export const NOTIFICATION_TYPES = [
  {
    key: 'result_winner',
    label: 'Cuando aciertas una categoría',
    description: 'Aviso post-resolución del cron con los puntos que ganaste.',
    icon: '🏆',
  },
  {
    key: 'lock_reminder',
    label: 'Recordatorio antes del cierre',
    description: 'Un día antes del cierre, si todavía no completaste tus 14 predicciones.',
    icon: '⏰',
  },
  {
    key: 'lock_closed',
    label: 'Cuando se cierra un grupo',
    description: 'Aviso cuando un grupo del que sos miembro acaba de bloquear sus predicciones.',
    icon: '🔒',
  },
  {
    key: 'member_joined',
    label: 'Nuevo miembro a tu grupo',
    description: 'Solo si sos administrador: cuando alguien se une via código de invitación.',
    icon: '👋',
  },
  {
    key: 'pool_deposit_confirmed',
    label: 'Cuando confirman tu aporte al pozo',
    description: 'Aviso cuando el administrador del grupo registra que tu pago llegó.',
    icon: '✅',
  },
  {
    key: 'rank_dethroned',
    label: 'Cuando te superan en el ranking',
    description:
      'Aviso si estabas en el primer puesto de un grupo y alguien te pasó al resolverse una categoría.',
    icon: '📉',
  },
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key']

export const NOTIFICATION_TYPE_KEYS: ReadonlySet<NotificationType> = new Set(
  NOTIFICATION_TYPES.map((t) => t.key),
)
