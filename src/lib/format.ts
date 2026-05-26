const CURRENCY_PREFIX: Record<string, string> = {
  BOB: 'Bs.',
  USD: 'USD',
  EUR: 'EUR',
  PEN: 'S/',
  ARS: '$',
}

export function formatMoney(amount: number, currency = 'BOB'): string {
  const n = (amount || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${CURRENCY_PREFIX[currency] ?? currency} ${n}`
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
  }).format(d)
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const ms = target.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
