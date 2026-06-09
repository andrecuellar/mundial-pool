import type { MetadataRoute } from 'next'

const BASE = 'https://mundial-pool.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE, changeFrequency: 'daily', priority: 1.0, lastModified: now },
    {
      url: `${BASE}/torneo/selecciones`,
      changeFrequency: 'weekly',
      priority: 0.6,
      lastModified: now,
    },
    {
      url: `${BASE}/torneo/jugadores`,
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: now,
    },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.3, lastModified: now },
  ]
}
