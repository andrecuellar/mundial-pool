// Ranking de competición compartido entre server (payout, página del grupo) y
// client (tabla de líderes). Vive separado de queries.ts para que los client
// components puedan importarlo sin arrastrar código de servidor.
//
// Regla: más puntos arriba; a igualdad de puntos va arriba quien tiene MENOS
// fallos definitivos (categorías en 0 asegurado: resueltas sin acierto o con
// pick imposible). Solo si empatan en puntos Y en fallos comparten el puesto,
// y el siguiente puesto salta por el tamaño del empate (1, 1, 3, 3, 5) — la
// misma regla con la que se reparte el pozo.

// hasPaid: solo relevante con pozo activo. undefined/true = tratado como pagador
// (sin pozo, nadie se castiga). Los NO-pagadores van SIEMPRE al final, muestren
// los puntos que muestren.
export type RankableRow = { totalPoints: number; failedCount: number; hasPaid?: boolean }

export type RankInfo = { rank: number; tied: boolean }

/** Ordena filas ya cargadas: pagadores primero, luego puntos DESC, fallos ASC, nombre ASC. */
export function compareRanked(
  a: RankableRow & { displayName: string },
  b: RankableRow & { displayName: string },
): number {
  const aPaid = a.hasPaid ?? true
  const bPaid = b.hasPaid ?? true
  if (aPaid !== bPaid) return aPaid ? -1 : 1
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints
  if (a.failedCount !== b.failedCount) return a.failedCount - b.failedCount
  return a.displayName.localeCompare(b.displayName, 'es')
}

/** Asigna puestos a filas YA ordenadas con compareRanked. */
export function competitionRanks(rows: RankableRow[]): RankInfo[] {
  const out: RankInfo[] = []
  let prev: RankableRow | null = null
  let prevRank = 0
  rows.forEach((r, i) => {
    const tiesPrev =
      prev !== null &&
      r.totalPoints === prev.totalPoints &&
      r.failedCount === prev.failedCount &&
      (r.hasPaid ?? true) === (prev.hasPaid ?? true)
    const rank = tiesPrev ? prevRank : i + 1
    out.push({ rank, tied: false })
    prev = r
    prevRank = rank
  })
  for (let i = 0; i < out.length; i++) {
    const same = out.filter((x) => x.rank === out[i].rank).length
    out[i].tied = same > 1
  }
  return out
}
