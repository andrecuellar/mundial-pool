// Single source of truth for the Mundial 2026 dates and constants used
// across UI copy, ranking calculations and notifications. Anything that
// references the start/end of the tournament should import from here so
// rescheduling (FIFA has done it before) is a one-line change.

// Mexico vs Sudáfrica · Estadio Azteca · 13:00 Ciudad de México (UTC-6)
// = 19:00 UTC. México no observa DST desde 2022, así que UTC-6 todo el año.
export const WORLD_CUP_START = new Date('2026-06-11T19:00:00Z')
export const WORLD_CUP_END = new Date('2026-07-19T22:00:00Z')

// Last FIFA ranking update before the World Cup is scheduled for 9 June 2026
// (2 days before the opening match). The predict form uses this to warn users
// that revelation/disappointment computations will use this snapshot.
export const FIFA_FINAL_UPDATE = new Date('2026-06-09T00:00:00Z')

// The resolution + standings cron runs daily at 08:00 UTC.
export const CRON_HOUR_UTC = 8

export const TOTAL_MATCHES = 104
export const TOTAL_TEAMS = 48
