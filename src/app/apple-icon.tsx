import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        gap: 6,
        fontSize: 96,
        fontWeight: 700,
        letterSpacing: -5,
        fontFamily: 'system-ui',
      }}
    >
      <span>m</span>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#4F7DDC',
        }}
      />
      <span>p</span>
    </div>,
    { ...size },
  )
}
