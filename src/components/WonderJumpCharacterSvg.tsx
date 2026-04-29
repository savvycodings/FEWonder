import { memo, useMemo } from 'react'
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import type { WonderJumpCharacterStyle } from '../wonderJumpCharacters'

/** Art is authored in this box and scales to any player size (matches hitbox). */
const VB = 24

type Props = {
  variant: WonderJumpCharacterStyle
  width: number
  height: number
}

export const WonderJumpCharacterSvg = memo(function WonderJumpCharacterSvg({ variant, width, height }: Props) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 10), [])

  if (variant === 'classic') {
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${VB} ${VB}`}>
        <Rect x={1.3} y={1.3} width={21.4} height={21.4} rx={3.7} fill="#ff8a3d" stroke="#b5531d" strokeWidth={1.65} />
        <Rect x={7.3} y={9} width={3.2} height={3.2} rx={1.6} fill="#1b1d26" />
        <Rect x={13.5} y={9} width={3.2} height={3.2} rx={1.6} fill="#1b1d26" />
      </Svg>
    )
  }

  if (variant === 'ghost') {
    const gBody = `ghostBody_${uid}`
    const gSoft = `ghostSoft_${uid}`
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${VB} ${VB}`}>
        <Defs>
          <LinearGradient id={gBody} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#f2f8ff" stopOpacity={1} />
            <Stop offset="1" stopColor="#d6e8f5" stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id={gSoft} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path
          d="M12 1.6 C6.35 1.6 2.25 5.75 2.15 11.45 C2.1 13.15 2.2 14.55 2.35 15.95 V19.95 C2.3 20.55 2.9 21.05 3.5 20.8 L5.55 19.7 C6.05 19.45 6.65 19.5 7.05 19.9 L8.45 21.25 C8.95 21.75 9.7 21.75 10.2 21.25 L11.45 20 C11.85 19.6 12.45 19.6 12.85 20 L14.1 21.25 C14.6 21.75 15.35 21.75 15.85 21.25 L17.25 19.9 C17.65 19.5 18.25 19.45 18.75 19.7 L20.8 20.8 C21.4 21.05 22 20.55 21.95 19.95 V15.95 C22.1 14.55 22.2 13.15 22.15 11.45 C22.05 5.75 17.65 1.6 12 1.6 Z"
          fill={`url(#${gBody})`}
          stroke="#6f8799"
          strokeWidth={1.35}
          strokeLinejoin="round"
        />
        <Path
          d="M6.2 6.9 C8.1 4.6 15.9 4.6 17.8 6.9 C18.4 7.65 18.2 9.15 17.15 9.75 C14.85 11.2 9.15 11.2 6.85 9.75 C5.8 9.15 5.6 7.65 6.2 6.9 Z"
          fill={`url(#${gSoft})`}
        />
        <Ellipse cx={8.55} cy={11.35} rx={1.1} ry={1.4} fill="#1e2f42" />
        <Ellipse cx={15.45} cy={11.35} rx={1.1} ry={1.4} fill="#1e2f42" />
        <Path
          d="M8.8 14.7 Q12 17.05 15.2 14.7"
          fill="none"
          stroke="#1e2f42"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Svg>
    )
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB} ${VB}`}>
      <Rect x={1.3} y={1.3} width={21.4} height={21.4} rx={3.7} fill="#ff8a3d" stroke="#b5531d" strokeWidth={1.65} />
      <Rect x={7.3} y={9} width={3.2} height={3.2} rx={1.6} fill="#1b1d26" />
      <Rect x={13.5} y={9} width={3.2} height={3.2} rx={1.6} fill="#1b1d26" />
    </Svg>
  )
})
