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
    description: 'A 3 días y a 1 día del cierre, si todavía no completaste tus 14 predicciones.',
    icon: '⏰',
  },
  {
    key: 'lock_closed',
    label: 'Cuando se cierra un grupo',
    description: 'Aviso cuando un grupo del que eres miembro acaba de bloquear sus predicciones.',
    icon: '🔒',
  },
  {
    key: 'payment_reminder',
    label: 'Recordatorios para aportar al pozo',
    description:
      'A 7, 3 y 1 días del cierre, si todavía no apareces como contribuyente del pozo.',
    icon: '💰',
  },
  {
    key: 'admin_broadcast',
    label: 'Mensajes del administrador',
    description: 'Avisos manuales del administrador del torneo (no spam, solo lo importante).',
    icon: '📣',
  },
  {
    key: 'member_joined',
    label: 'Nuevo miembro a tu grupo',
    description: 'Solo si eres administrador: cuando alguien se une via código de invitación.',
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
  {
    key: 'rank_reached_top',
    label: 'Cuando llegás al #1',
    description:
      'Aviso si pasaste al primer puesto de un grupo al resolverse una categoría (también si entras a un empate por el #1).',
    icon: '🥇',
  },
  {
    key: 'group_creation_requested',
    label: 'Solicitudes de crear grupo (solo admin)',
    description: 'Solo si eres superadmin: cuando un usuario pide permiso para crear un grupo.',
    icon: '📝',
  },
  {
    key: 'group_creation_approved',
    label: 'Cuando aprueban tu solicitud de crear grupo',
    description: 'Aviso si el admin te dio permiso para crear grupos.',
    icon: '✅',
  },
  {
    key: 'group_creation_rejected',
    label: 'Cuando rechazan tu solicitud de crear grupo',
    description: 'Aviso si el admin rechazó tu pedido (con razón opcional).',
    icon: '🚫',
  },
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key']

export const NOTIFICATION_TYPE_KEYS: ReadonlySet<NotificationType> = new Set(
  NOTIFICATION_TYPES.map((t) => t.key),
)
