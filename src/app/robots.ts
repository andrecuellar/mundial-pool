import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/privacy', '/terms', '/torneo/'],
        disallow: [
          '/api/',
          '/admin/',
          '/groups/',
          '/settings/',
          '/banned',
          '/auth/',
          '/join/',
          '/monitoring',
        ],
      },
    ],
    sitemap: 'https://mundial-pool.vercel.app/sitemap.xml',
  }
}
