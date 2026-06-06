import { ImageResponse } from 'next/og'

// 512x512 maskable PWA icon. Misma proporción del 192x192 maskable
// (design al 60% del canvas, fondo full).
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#16181F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F4ED',
          gap: 12,
          fontSize: 172,
          fontWeight: 700,
          letterSpacing: -10,
          fontFamily: 'system-ui',
        }}
      >
        <span>m</span>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#4F7DDC',
          }}
        />
        <span>p</span>
      </div>
    </div>,
    { width: 512, height: 512 },
  )
}
