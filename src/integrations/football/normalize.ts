export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const PROVIDER_TO_DB: Record<string, string> = {
  czechrepublic: 'czechrepublic',
  southkorea: 'southkorea',
  bosniaherzegovina: 'bosniaherzegovina',
  usa: 'usa',
  unitedstates: 'usa',
  capeverde: 'capeverde',
  caboverde: 'capeverde',
  ivorycoast: 'ivorycoast',
  cotedivoire: 'ivorycoast',
}

export function teamMatchKey(name: string): string {
  const n = normalizeTeamName(name)
  return PROVIDER_TO_DB[n] ?? n
}
