const CURRENCY_PREFIX: Record<string, string> = {
  BOB: 'Bs.',
  USDT: 'USDT',
}

// All date/time formatting in the UI is anchored to Bolivian time because
// (a) the audience is Bolivian, and (b) the predictions cutoff has to be
// communicated as a wall-clock time the user can act on. Without a fixed
// timeZone, Node-side rendering on Vercel falls back to UTC and the display
// drifts 4 hours ahead of Bolivia.
export const APP_TIME_ZONE = 'America/La_Paz'

export function formatMoney(amount: number, currency = 'BOB'): string {
  const n = (amount || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${CURRENCY_PREFIX[currency] ?? currency} ${n}`
}

/** Day + short month, Bolivian time. e.g. "11 jun". */
export function formatDayShort(d: Date): string {
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    timeZone: APP_TIME_ZONE,
  })
}

/** Day + short month + 24h time, Bolivian time. e.g. "11 jun, 21:00". */
export function formatDayTime(d: Date): string {
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

/** Wall-clock time only, Bolivian time. e.g. "17:26". */
export function formatTimeOnly(d: Date): string {
  return d.toLocaleString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

const PAYOUT_LABELS: Record<string, string> = {
  winner_takes_all: 'El ganador se lleva todo',
  top_3_split: 'Top 3 · 60 / 30 / 10',
  manual: 'Reparto manual',
}

export function payoutRuleLabel(rule: string): string {
  return PAYOUT_LABELS[rule] ?? rule
}

export function formatDateEs(d: Date): string {
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(d)
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const ms = target.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

// ─── BOT input/output helpers ─────────────────────────────────────────
// La regla es: TODO display y TODO input al user es hora boliviana (BOT,
// UTC-4 sin DST), independientemente de la TZ del browser o del runtime.
// Estos helpers reemplazan el patrón inseguro de `new Date(str)` /
// `d.getHours()` cuando el string viene de un <input type="datetime-local">
// o cuando necesitamos un "día calendario BOT" para flags locales.

/**
 * Parse a "YYYY-MM-DDTHH:mm[:ss]" string (as produced by an
 * <input type="datetime-local">) treating it as Bolivian wall-clock time
 * and returning the corresponding UTC Date. TZ-independent of the runtime.
 *
 * Ejemplo: parseBolivianDateTimeLocal('2026-06-11T15:00') →
 *          new Date('2026-06-11T19:00:00.000Z')  // 3pm BOT = 7pm UTC
 */
export function parseBolivianDateTimeLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi, se] = m
  // BOT es UTC-4 sin DST. Sumamos 4h al construir el UTC equivalente.
  const utc = Date.UTC(+y, +mo - 1, +d, +h + 4, +mi, +(se ?? '0'))
  const dt = new Date(utc)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/**
 * Format a Date as a "YYYY-MM-DDTHH:mm" string in Bolivian wall-clock,
 * ready to assign to a <input type="datetime-local"> value. Always BOT,
 * regardless of the browser TZ.
 *
 * Ejemplo: formatBolivianDateTimeLocal(new Date('2026-06-11T19:00:00Z'))
 *          → '2026-06-11T15:00'
 */
export function formatBolivianDateTimeLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  // Intl con hour12:false puede devolver "24" para medianoche; normalizamos
  // a "00" para que datetime-local lo acepte como valor válido.
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * Calendar date in Bolivia as "YYYY-MM-DD". Useful for localStorage flags
 * ("¿ya vi el splash hoy?") that should respect the user's BOT day even
 * when their device is in another TZ.
 *
 * Ejemplo: bolivianCalendarDate(new Date('2026-06-12T03:00:00Z'))
 *          → '2026-06-11'  // 3am UTC = 11pm BOT día anterior
 */
export function bolivianCalendarDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE })
}
