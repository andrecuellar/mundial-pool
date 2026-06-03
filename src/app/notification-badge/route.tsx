import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Monochrome silhouette used as the small badge icon in Android web push
// notifications. Browsers mask this to the system tint so it must be a flat
// white mark on a transparent background.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 56,
        fontWeight: 800,
        letterSpacing: -3,
        fontFamily: 'system-ui',
      }}
    >
      <span>m</span>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex',
        }}
      />
      <span>p</span>
    </div>,
    { width: 96, height: 96 },
  )
}
