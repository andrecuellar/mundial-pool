import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
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
        gap: 2,
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: -2,
        fontFamily: 'system-ui',
      }}
    >
      <span>m</span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#4F7DDC',
        }}
      />
      <span>p</span>
    </div>,
    { ...size },
  )
}
