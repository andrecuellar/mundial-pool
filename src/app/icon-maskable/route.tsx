import { ImageResponse } from 'next/og'

// 192x192 maskable PWA icon. El fondo cubre 100% del canvas para que
// cualquier máscara de Android (circle, squircle, rounded square) muestre
// solo color sólido en las esquinas. El design queda en el 60% central
// (safe zone, ≈20% padding por lado).
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
          gap: 4,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -4,
          fontFamily: 'system-ui',
        }}
      >
        <span>m</span>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#4F7DDC',
          }}
        />
        <span>p</span>
      </div>
    </div>,
    { width: 192, height: 192 },
  )
}
