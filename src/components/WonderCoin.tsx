import { memo, useEffect, useRef, useState, type ReactElement } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SvgXml } from 'react-native-svg'
import { DOMAIN, getDevClientOrigin } from '../../constants'

/** Full coin face for badges and price tiles (no animation). */
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

/** Where `/homepageimgs/...` is reachable for this runtime (Expo dev client vs API server). */
function coinAssetUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (/^https?:\/\//i.test(path)) return path
    if (path.startsWith('/')) return `${window.location.origin}${path}`
    return path
  }
  const devOrigin = getDevClientOrigin()
  if (devOrigin) return `${devOrigin}${path}`
  if (DOMAIN) return `${DOMAIN}${path}`
  return path
}

function canResolveCoinUrl(): boolean {
  if (Platform.OS === 'web') return true
  return Boolean(getDevClientOrigin() || DOMAIN)
}

async function fetchSvgMarkup(path: string): Promise<string> {
  const url = coinAssetUrl(path)
  const res = await fetch(url)
  const text = (await res.text()).replace(/^\uFEFF/, '').trimStart()
  if (!res.ok) {
    throw new Error(`Coin SVG not available (${res.status})`)
  }
  // Reject HTML error pages (also start with "<") so SvgXml never parses them.
  if (!/<svg[\s>]/i.test(text)) {
    throw new Error('Coin response was not SVG markup')
  }
  return text
}

let rotationFramesPromise: Promise<string[]> | null = null

function loadRotationFrames(): Promise<string[]> {
  if (!rotationFramesPromise) {
    rotationFramesPromise = Promise.all(
      COIN_ROTATION_FRAME_URIS.map((path) => fetchSvgMarkup(path))
    ).catch((err) => {
      rotationFramesPromise = null
      return Promise.reject(err)
    })
  }
  return rotationFramesPromise
}

let frontSvgPromise: Promise<string> | null = null

function loadFrontSvg(): Promise<string> {
  if (!frontSvgPromise) {
    frontSvgPromise = fetchSvgMarkup(WONDER_COIN_FRONT_SVG).catch((err) => {
      frontSvgPromise = null
      return Promise.reject(err)
    })
  }
  return frontSvgPromise
}

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
  const [frames, setFrames] = useState<string[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const lastFrameIdxRef = useRef(-1)

  useEffect(() => {
    if (!canResolveCoinUrl()) return
    let cancelled = false
    loadRotationFrames()
      .then((xml) => {
        if (!cancelled) setFrames(xml)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  if (!canResolveCoinUrl() || loadFailed) {
    return (
      <CoinSlot size={size}>
        <DollarFallback size={dollarSize} color={fallbackColor} />
      </CoinSlot>
    )
  }

  if (!frames) {
    return (
      <CoinSlot size={size}>
        <ActivityIndicator color={fallbackColor} />
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
  const [xml, setXml] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!canResolveCoinUrl()) return
    let cancelled = false
    loadFrontSvg()
      .then((markup) => {
        if (!cancelled) setXml(markup)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dollarSize = Math.max(10, Math.round(size * 0.9))

  if (!canResolveCoinUrl() || loadFailed) {
    return (
      <CoinSlot size={size}>
        <DollarFallback size={dollarSize} color={fallbackColor} />
      </CoinSlot>
    )
  }

  if (!xml) {
    return (
      <CoinSlot size={size}>
        <ActivityIndicator color={fallbackColor} size="small" />
      </CoinSlot>
    )
  }

  return (
    <CoinSlot size={size}>
      <SvgXml xml={xml} width={size} height={size} preserveAspectRatio={COIN_SVG_PAR} />
    </CoinSlot>
  )
}
