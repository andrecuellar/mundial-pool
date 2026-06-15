export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// TheSportsDB returns team names in English; our DB stores Spanish names.
// Both sides are normalized through normalizeTeamName before lookup, so the
// keys/values below are already lowercase + diacritic-free + alphanumeric-only.
// Teams whose Spanish + English normalize to the same key (Argentina, Australia,
// Colombia, Ecuador, Ghana, Paraguay, Senegal, Uruguay) need no entry.
const PROVIDER_TO_DB: Record<string, string> = {
  algeria: 'argelia',
  belgium: 'belgica',
  bosniaherzegovina: 'bosniayherzegovina',
  bosnia: 'bosniayherzegovina',
  bosniaandherzegovina: 'bosniayherzegovina',
  brazil: 'brasil',
  capeverde: 'caboverde',
  croatia: 'croacia',
  curacao: 'curazao',
  czechrepublic: 'republicacheca',
  czechia: 'republicacheca',
  drcongo: 'rdcongo',
  democraticrepublicofthecongo: 'rdcongo',
  congodr: 'rdcongo', // ESPN usa "Congo DR"
  egypt: 'egipto',
  england: 'inglaterra',
  france: 'francia',
  germany: 'alemania',
  iraq: 'irak',
  ivorycoast: 'costademarfil',
  cotedivoire: 'costademarfil',
  japan: 'japon',
  jordan: 'jordania',
  morocco: 'marruecos',
  netherlands: 'paisesbajos',
  newzealand: 'nuevazelanda',
  norway: 'noruega',
  qatar: 'catar',
  saudiarabia: 'arabiasaudita',
  scotland: 'escocia',
  southafrica: 'sudafrica',
  southkorea: 'coreadelsur',
  koreareublic: 'coreadelsur',
  korearepublic: 'coreadelsur',
  koreasouth: 'coreadelsur',
  spain: 'espana',
  sweden: 'suecia',
  switzerland: 'suiza',
  tunisia: 'tunez',
  turkey: 'turquia',
  turkiye: 'turquia', // ESPN usa "Türkiye" (nombre oficial)
  usa: 'estadosunidos',
  unitedstates: 'estadosunidos',
}

export function teamMatchKey(name: string): string {
  const n = normalizeTeamName(name)
  return PROVIDER_TO_DB[n] ?? n
}
