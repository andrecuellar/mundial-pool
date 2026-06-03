import { ImageResponse } from 'next/og'

export const alt = 'mundial-pool · El pool del Mundial 2026 entre amigos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#16181F',
        color: '#F5F4ED',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        fontFamily: 'system-ui',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 600,
          height: 600,
          background:
            'radial-gradient(circle at top right, rgba(79,125,220,0.35) 0%, transparent 60%)',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        <span>m</span>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#4F7DDC',
            display: 'flex',
          }}
        />
        <span>p</span>
        <span style={{ marginLeft: 16, opacity: 0.55, fontSize: 24, fontWeight: 500 }}>
          mundial-pool
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: '#4F7DDC',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Mundial 2026 · 11 jun → 19 jul
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span>El pool del Mundial,</span>
          <span style={{ color: '#94A0B8' }}>para tu grupo.</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 32,
            fontSize: 24,
            fontWeight: 500,
            color: '#A8B0C0',
            marginTop: 16,
          }}
        >
          <span>48 selecciones</span>
          <span>·</span>
          <span>104 partidos</span>
          <span>·</span>
          <span>14 predicciones</span>
        </div>
      </div>
    </div>,
    { ...size },
  )
}
