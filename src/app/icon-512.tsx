import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon512() {
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
    { ...size },
  )
}
