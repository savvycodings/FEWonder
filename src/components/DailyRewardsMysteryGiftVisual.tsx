import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Image, StyleSheet, View } from 'react-native'
import Svg, { Polygon, SvgXml } from 'react-native-svg'

/** Matches `dailyRewards.tsx` — 12 triangular rays on a 30° grid. */
export const DAILY_REWARDS_GIFT_RAY_ANGLES = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
] as const

const BASE_RAY_STAGE = 236
const BASE_BOX_W = 180
const BASE_BOX_H = 146

/** Float/tilt loop — keep in sync with `dailyRewards.tsx` mystery gift `useEffect`. */
export const DAILY_REWARDS_GIFT_FLOAT_LOOP_MS = 4600
/** Rotating ray burst — keep in sync with `dailyRewards.tsx` mystery gift `useEffect`. */
export const DAILY_REWARDS_GIFT_RAY_SPIN_MS = 5600

/** Same geometry as Daily Rewards `GiftBoxPrizeRays`, scaled to `size`. */
export const DailyRewardsGiftBoxRayBurst = memo(function DailyRewardsGiftBoxRayBurst({ size }: { size: number }) {
  const center = size / 2
  const innerRadius = 28 * (size / BASE_RAY_STAGE)
  const outerRadius = 116 * (size / BASE_RAY_STAGE)
  /** Wider wedges than the original 7° so the rays read thicker on screen. */
  const halfSpreadDeg = 10
  const pointAt = (radius: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return {
      x: center + Math.cos(rad) * radius,
      y: center + Math.sin(rad) * radius,
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      {DAILY_REWARDS_GIFT_RAY_ANGLES.map((angle, idx) => {
        const tip = pointAt(outerRadius, angle)
        const left = pointAt(innerRadius, angle - halfSpreadDeg)
        const right = pointAt(innerRadius, angle + halfSpreadDeg)
        const opacity = idx % 2 === 0 ? 0.52 : 0.34
        return (
          <Polygon
            key={`ray-${angle}`}
            points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
            fill={`rgba(255,223,120,${opacity})`}
            stroke="rgba(255, 205, 100, 0.32)"
            strokeWidth={Math.max(0.45, 0.72 * (size / BASE_RAY_STAGE))}
            strokeLinejoin="round"
          />
        )
      })}
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

export type DailyRewardsMysteryGiftVisualProps = {
  /**
   * Outer stage size (Daily Rewards uses 236). Rays + box scale down together.
   */
  maxStageSize?: number
  /**
   * When true: same motion + ray burst as Daily Rewards when the box is ready to claim.
   * When false: static gift (no rays), like Daily Rewards before the timer finishes.
   */
  ready: boolean
}

/**
 * Daily Rewards mystery gift: triangular `DailyRewardsGiftBoxRayBurst`,
 * linear float/tilt + ray spin (`DAILY_REWARDS_GIFT_*_MS`) — only while `ready`.
 */
export const DailyRewardsMysteryGiftVisual = memo(function DailyRewardsMysteryGiftVisual({
  maxStageSize = BASE_RAY_STAGE,
  ready,
}: DailyRewardsMysteryGiftVisualProps) {
  const [giftBoxSvgXml, setGiftBoxSvgXml] = useState<string | null>(() => giftBoxSvgXmlCache)
  const giftBoxPreviewPhase = useRef(new Animated.Value(0)).current
  const giftBoxGlowRotateAnim = useRef(new Animated.Value(0)).current

  const scale = maxStageSize / BASE_RAY_STAGE
  const stageSize = maxStageSize
  const raySize = stageSize
  const boxW = BASE_BOX_W * scale
  const boxH = BASE_BOX_H * scale

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
    if (!ready) {
      giftBoxPreviewPhase.stopAnimation()
      giftBoxGlowRotateAnim.stopAnimation()
      giftBoxPreviewPhase.setValue(0)
      giftBoxGlowRotateAnim.setValue(0)
      return
    }

    const motionLoop = Animated.loop(
      Animated.timing(giftBoxPreviewPhase, {
        toValue: 1,
        duration: DAILY_REWARDS_GIFT_FLOAT_LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    const glowSpinLoop = Animated.loop(
      Animated.timing(giftBoxGlowRotateAnim, {
        toValue: 1,
        duration: DAILY_REWARDS_GIFT_RAY_SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )

    giftBoxPreviewPhase.setValue(0)
    motionLoop.start()
    glowSpinLoop.start()

    return () => {
      motionLoop.stop()
      glowSpinLoop.stop()
      giftBoxPreviewPhase.setValue(0)
      giftBoxGlowRotateAnim.setValue(0)
    }
  }, [giftBoxGlowRotateAnim, giftBoxPreviewPhase, ready])

  const giftBoxFloatY = useMemo(
    () =>
      giftBoxPreviewPhase.interpolate({
        inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
        outputRange: [0, -4, -9, -5, 0, 4, 8, 4, 0],
      }),
    [giftBoxPreviewPhase],
  )
  const giftBoxTiltDeg = useMemo(
    () =>
      giftBoxPreviewPhase.interpolate({
        inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
        outputRange: ['-2.4deg', '-1deg', '2.2deg', '0.8deg', '-2deg', '-0.8deg', '2.2deg', '1deg', '-2.4deg'],
      }),
    [giftBoxPreviewPhase],
  )
  const giftBoxGlowRotateDeg = useMemo(
    () => giftBoxGlowRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [giftBoxGlowRotateAnim],
  )

  return (
    <View style={[styles.stage, { width: stageSize, height: stageSize }]}>
      <Animated.View
        style={[
          styles.previewGroup,
          {
            width: stageSize,
            height: stageSize,
            transform: [
              { translateY: ready ? giftBoxFloatY : 0 },
              { rotate: ready ? giftBoxTiltDeg : '0deg' },
            ],
          },
        ]}
      >
        {ready ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.raysOrbit,
              {
                width: raySize,
                height: raySize,
                transform: [{ rotate: giftBoxGlowRotateDeg }],
              },
            ]}
          >
            <DailyRewardsGiftBoxRayBurst size={raySize} />
          </Animated.View>
        ) : null}
        <View style={styles.boxWrap}>
          {giftBoxSvgXml ? (
            <SvgXml xml={giftBoxSvgXml} width={boxW} height={boxH} preserveAspectRatio="xMidYMid meet" />
          ) : (
            <View style={{ width: boxW, height: boxH }} />
          )}
        </View>
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  previewGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  raysOrbit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
})
