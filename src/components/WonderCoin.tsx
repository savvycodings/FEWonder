import { memo, useEffect, useRef, useState, type ReactElement } from 'react'
import { View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SvgXml } from 'react-native-svg'
import {
  WONDER_COIN_FRONT_SVG_MARKUP,
  WONDER_COIN_ROTATION_SVG_MARKUP,
} from './wonderCoinFrames.generated'

/** Public URL path (e.g. web `<img src>`); animated coin uses bundled SVG strings instead. */
export const WONDER_COIN_FRONT_SVG = '/homepageimgs/Coinrotation/CoinFRONT.svg'

export const COIN_ROTATION_FRAME_URIS = [
  '/homepageimgs/Coinrotation/CoinFRONT.svg',
  '/homepageimgs/Coinrotation/Coin2.svg',
  '/homepageimgs/Coinrotation/Coin3.svg',
  '/homepageimgs/Coinrotation/Coin4.svg',
  '/homepageimgs/Coinrotation/Coin5.svg',
  '/homepageimgs/Coinrotation/Coin6.svg',
  '/homepageimgs/Coinrotation/Coin7.svg',
  '/homepageimgs/Coinrotation/Coin8.svg',
  '/homepageimgs/Coinrotation/Coin9.svg',
  '/homepageimgs/Coinrotation/Coin10.svg',
  '/homepageimgs/Coinrotation/Coin11.svg',
  '/homepageimgs/Coinrotation/Coin12.svg',
  '/homepageimgs/Coinrotation/Coin13.svg',
  '/homepageimgs/Coinrotation/Coin14.svg',
  '/homepageimgs/Coinrotation/Coin15.svg',
  '/homepageimgs/Coinrotation/Coin16.svg',
  '/homepageimgs/Coinrotation/Coin17.svg',
  '/homepageimgs/Coinrotation/Coin18.svg',
  '/homepageimgs/Coinrotation/Coin19.svg',
  '/homepageimgs/Coinrotation/Coin20.svg',
  '/homepageimgs/Coinrotation/Coin21.svg',
  '/homepageimgs/Coinrotation/Coin22.svg',
  '/homepageimgs/Coinrotation/Coin23.svg',
  '/homepageimgs/Coinrotation/Coin24.svg',
  '/homepageimgs/Coinrotation/Coin25.svg',
  '/homepageimgs/Coinrotation/Coin26.svg',
  '/homepageimgs/Coinrotation/Coin27.svg',
  '/homepageimgs/Coinrotation/Coin28.svg',
  '/homepageimgs/Coinrotation/Coin29.svg',
  '/homepageimgs/Coinrotation/Coin30.svg',
  '/homepageimgs/Coinrotation/Coin31.svg',
  '/homepageimgs/Coinrotation/Coin32.svg',
] as const

/** ms per frame — a bit faster than the original 80ms so the 32-frame loop feels snappier. */
const COIN_SPIN_FRAME_MS = 58

/** Edge-on coin SVGs use a narrow viewBox; `meet` keeps scale even so rotation doesn’t “rush” mid-spin. */
const COIN_SVG_PAR = 'xMidYMid meet' as const

const BUNDLED_FRAMES_OK = WONDER_COIN_ROTATION_SVG_MARKUP.length > 0
const BUNDLED_FRONT_OK = WONDER_COIN_FRONT_SVG_MARKUP.length > 0

function DollarFallback({ size, color }: { size: number; color: string }): ReactElement {
  return <FeatherIcon name="dollar-sign" size={size} color={color} />
}

function CoinSlot({
  size,
  children,
}: {
  size: number
  children: ReactElement
}): ReactElement {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  )
}

export const WonderSpinningCoin = memo(function WonderSpinningCoin({
  size,
  fallbackColor,
}: {
  size: number
  fallbackColor: string
}): ReactElement {
  const [frameIndex, setFrameIndex] = useState(0)
  const frames = BUNDLED_FRAMES_OK ? WONDER_COIN_ROTATION_SVG_MARKUP : null
  const lastFrameIdxRef = useRef(-1)

  useEffect(() => {
    if (!frames?.length) return
    lastFrameIdxRef.current = -1
    const started = performance.now()
    const n = frames.length
    const frameMs = COIN_SPIN_FRAME_MS
    let raf = 0
    const loop = (now: number) => {
      const idx = Math.floor((now - started) / frameMs) % n
      if (idx !== lastFrameIdxRef.current) {
        lastFrameIdxRef.current = idx
        setFrameIndex(idx)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [frames])

  const dollarSize = Math.max(12, Math.round(size * 0.62))

  if (!frames?.length) {
    return (
      <CoinSlot size={size}>
        <DollarFallback size={dollarSize} color={fallbackColor} />
      </CoinSlot>
    )
  }

  return (
    <CoinSlot size={size}>
      <SvgXml
        xml={frames[frameIndex]}
        width={size}
        height={size}
        preserveAspectRatio={COIN_SVG_PAR}
      />
    </CoinSlot>
  )
})

export function WonderStaticCoin({
  size = 20,
  fallbackColor,
}: {
  size?: number
  fallbackColor: string
}): ReactElement {
  const dollarSize = Math.max(10, Math.round(size * 0.9))

  if (!BUNDLED_FRONT_OK) {
    return (
      <CoinSlot size={size}>
        <DollarFallback size={dollarSize} color={fallbackColor} />
      </CoinSlot>
    )
  }

  return (
    <CoinSlot size={size}>
      <SvgXml
        xml={WONDER_COIN_FRONT_SVG_MARKUP}
        width={size}
        height={size}
        preserveAspectRatio={COIN_SVG_PAR}
      />
    </CoinSlot>
  )
}
