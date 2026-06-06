import { ImageResponse } from 'next/og'

// 512x512 PWA icon (purpose: 'any'). Next.js' metadata icon convention
// (icon.tsx, icon1.tsx) only supports numbered suffixes, so para tener
// rutas con nombres descriptivos ('/icon-512', '/icon-maskable') usamos
// regular route handlers — mismo patrón que /notification-badge.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#16181F',
        color: '#F5F4ED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontSize: 288,
        fontWeight: 700,
        letterSpacing: -16,
        fontFamily: 'system-ui',
      }}
    >
      <span>m</span>
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#4F7DDC',
        }}
      />
      <span>p</span>
    </div>,
    { width: 512, height: 512 },
  )
}
