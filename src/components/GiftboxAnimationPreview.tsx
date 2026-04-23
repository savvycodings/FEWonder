import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, StyleSheet, View } from 'react-native'
import Svg, { Path, SvgXml } from 'react-native-svg'

/** Static angle data for the rotating ray burst (Daily Rewards gift guide). */
export const GIFT_BOX_PREVIEW_RAY_ANGLES = Array.from({ length: 18 }, (_, i) => i * 20)

function giftRayWedgePath(cx: number, cy: number, rInner: number, rOuter: number, deg: number, halfSpanDeg: number): string {
  const rad = (deg * Math.PI) / 180
  const d = (halfSpanDeg * Math.PI) / 180
  const t0 = rad - d
  const t1 = rad + d
  const x0 = cx + rInner * Math.cos(t0)
  const y0 = cy + rInner * Math.sin(t0)
  const x1 = cx + rOuter * Math.cos(t0)
  const y1 = cy + rOuter * Math.sin(t0)
  const x2 = cx + rOuter * Math.cos(t1)
  const y2 = cy + rOuter * Math.sin(t1)
  const x3 = cx + rInner * Math.cos(t1)
  const y3 = cy + rInner * Math.sin(t1)
  return `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`
}

/** Sunburst / rays behind the gift box (`GiftBoxPrizeRays` from Daily Rewards gift guide). */
export const GiftBoxPrizeRays = memo(function GiftBoxPrizeRays({ size }: { size: number }) {
  const cx = size / 2
  const cy = size / 2
  const rInner = size * 0.1
  const rOuter = size * 0.5
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      {GIFT_BOX_PREVIEW_RAY_ANGLES.map((deg) => (
        <Path
          key={deg}
          d={giftRayWedgePath(cx, cy, rInner, rOuter, deg, 5.5)}
          fill="rgba(255, 228, 140, 0.38)"
          stroke="rgba(255, 190, 70, 0.32)"
          strokeWidth={0.6}
        />
      ))}
    </Svg>
  )
})

let giftBoxSvgXmlCache: string | null = null
let giftBoxSvgXmlInflight: Promise<string> | null = null

async function loadGiftBoxSvgXml(): Promise<string> {
  if (giftBoxSvgXmlCache) return giftBoxSvgXmlCache
  if (!giftBoxSvgXmlInflight) {
    giftBoxSvgXmlInflight = (async () => {
      const resolved = Image.resolveAssetSource(require('../../assets/giftbox.svg'))
      const uri = resolved?.uri
      if (!uri) throw new Error('giftbox.svg has no uri')
      const res = await fetch(uri)
      if (!res.ok) throw new Error(`giftbox fetch ${res.status}`)
      const xml = await res.text()
      giftBoxSvgXmlCache = xml
      return xml
    })()
  }
  return giftBoxSvgXmlInflight
}

export type GiftboxAnimationPreviewProps = {
  /** Pixel width/height of the gift art (square slot). */
  size: number
  /**
   * When false, motion stops and values reset (mirrors Daily Rewards `isGiftBoxReadyToClaim` /
   * preview visibility gates).
   */
  active?: boolean
}

/**
 * Mystery gift “ready” animation: floating + tilt on the box layer, rotating rays behind.
 * Implements the structure described in the Daily Rewards gift animation guide.
 */
export const GiftboxAnimationPreview = memo(function GiftboxAnimationPreview({
  size,
  active = true,
}: GiftboxAnimationPreviewProps) {
  const [giftBoxSvgXml, setGiftBoxSvgXml] = useState<string | null>(() => giftBoxSvgXmlCache)
  const giftBoxPreviewPhase = useRef(new Animated.Value(0)).current
  const giftBoxGlowRotateAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (giftBoxSvgXml) return
    let cancelled = false
    void loadGiftBoxSvgXml()
      .then((xml) => {
        if (!cancelled) setGiftBoxSvgXml(xml)
      })
      .catch(() => {
        if (!cancelled) setGiftBoxSvgXml(null)
      })
    return () => {
      cancelled = true
    }
  }, [giftBoxSvgXml])

  useEffect(() => {
    if (!active) {
      giftBoxPreviewPhase.stopAnimation()
      giftBoxGlowRotateAnim.stopAnimation()
      giftBoxPreviewPhase.setValue(0)
      giftBoxGlowRotateAnim.setValue(0)
      return
    }
    const motionLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(giftBoxPreviewPhase, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(giftBoxPreviewPhase, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    const glowLoop = Animated.loop(
      Animated.timing(giftBoxGlowRotateAnim, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    motionLoop.start()
    glowLoop.start()
    return () => {
      motionLoop.stop()
      glowLoop.stop()
      giftBoxPreviewPhase.setValue(0)
      giftBoxGlowRotateAnim.setValue(0)
    }
  }, [active, giftBoxPreviewPhase, giftBoxGlowRotateAnim])

  const giftBoxFloatY = giftBoxPreviewPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -5, 0],
  })
  const giftBoxTiltDeg = giftBoxPreviewPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-5deg', '0deg', '5deg'],
  })
  const giftBoxGlowRotateDeg = giftBoxGlowRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const raySize = Math.round(size * 1.28)

  return (
    <View style={[styles.slot, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.giftBoxPrizeRaysOrbit,
          {
            width: raySize,
            height: raySize,
            left: (size - raySize) / 2,
            top: (size - raySize) / 2,
            transform: [{ rotate: giftBoxGlowRotateDeg }],
          },
        ]}
      >
        <GiftBoxPrizeRays size={raySize} />
      </Animated.View>
      <Animated.View
        style={[
          styles.giftBoxAnimatedPreviewGroup,
          {
            width: size,
            height: size,
            transform: [{ translateY: giftBoxFloatY }, { rotate: giftBoxTiltDeg }],
          },
        ]}
      >
        {giftBoxSvgXml ? (
          <SvgXml xml={giftBoxSvgXml} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <View style={{ width: size, height: size }} />
        )}
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  slot: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  giftBoxPrizeRaysOrbit: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  giftBoxAnimatedPreviewGroup: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
