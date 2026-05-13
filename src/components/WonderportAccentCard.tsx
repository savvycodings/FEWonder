import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useContext, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { ThemeContext } from '../context'
import { BRAND_ACCENT_LIME_HEX, hexToRgbString } from '../brandAccent'

/** @deprecated Use `theme.brandAccent` from context; kept for imports that expect a constant. */
export const WONDERPORT_ACCENT_HEX = BRAND_ACCENT_LIME_HEX

type WonderportAccentCardProps = {
  children: ReactNode
  /** Gradient shell (padding = border thickness). */
  style?: StyleProp<ViewStyle>
  /** Inner container wrapping `children`. */
  contentStyle?: StyleProp<ViewStyle>
  borderWidth?: number
  borderRadius?: number
  /** Fill behind children; visible as the “card face” inside the gradient ring. */
  innerBackgroundColor?: string
  /**
   * When true, the same linear gradient (stops unchanged) rotates about the card center
   * so the lime bands sweep around the border. Uses Reanimated on the UI thread; prefer
   * enabling on one focused control at a time (e.g. active chip), not every list row.
   */
  animatedBorder?: boolean
  /** Full rotation period when `animatedBorder` is true. */
  borderRotationDurationMs?: number
}

function gradientBoxSide(layoutW: number, layoutH: number, borderWidth: number): number {
  const w = Math.max(1, layoutW)
  const h = Math.max(1, layoutH)
  return Math.ceil(Math.hypot(w, h) + borderWidth * 4)
}

/**
 * Reusable card with a **Wonderport accent** border: linear gradient top-left → bottom-right,
 * stops 0 / 66 at full lime, 33 / 100 at transparent (pulses lime along the diagonal).
 * Optional `animatedBorder` spins that same gradient around the center for a radial sweep.
 */
export function WonderportAccentCard({
  children,
  style,
  contentStyle,
  borderWidth = 2,
  borderRadius = 16,
  innerBackgroundColor = '#000000',
  animatedBorder = false,
  borderRotationDurationMs = 10_000,
}: WonderportAccentCardProps) {
  const { theme } = useContext(ThemeContext)
  const borderRgb = useMemo(() => {
    const s = theme?.brandAccentRgb ?? hexToRgbString(BRAND_ACCENT_LIME_HEX)
    const parts = s.split(',').map((p) => parseInt(p.trim(), 10))
    const r = Number.isFinite(parts[0]) ? parts[0] : 203
    const g = Number.isFinite(parts[1]) ? parts[1] : 255
    const b = Number.isFinite(parts[2]) ? parts[2] : 0
    return { r, g, b }
  }, [theme?.brandAccentRgb])

  const borderGradientColors = useMemo(
    () =>
      [
        `rgba(${borderRgb.r},${borderRgb.g},${borderRgb.b},1)`,
        `rgba(${borderRgb.r},${borderRgb.g},${borderRgb.b},0)`,
        `rgba(${borderRgb.r},${borderRgb.g},${borderRgb.b},1)`,
        `rgba(${borderRgb.r},${borderRgb.g},${borderRgb.b},0)`,
      ] as const,
    [borderRgb.r, borderRgb.g, borderRgb.b],
  )

  const innerRadius = Math.max(0, borderRadius - borderWidth)
  const [layout, setLayout] = useState({ w: 0, h: 0 })
  const rotationDeg = useSharedValue(0)

  useEffect(() => {
    if (!animatedBorder) {
      rotationDeg.value = 0
      return
    }
    rotationDeg.value = 0
    rotationDeg.value = withRepeat(
      withTiming(360, {
        duration: Math.max(2000, borderRotationDurationMs),
        easing: Easing.linear,
      }),
      -1,
      false,
    )
  }, [animatedBorder, borderRotationDurationMs, rotationDeg])

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationDeg.value}deg` }],
  }))

  const box = gradientBoxSide(layout.w, layout.h, borderWidth)

  return (
    <View
      style={[styles.shell, { borderRadius, overflow: 'hidden' }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        if (width !== layout.w || height !== layout.h) {
          setLayout({ w: width, h: height })
        }
      }}
    >
      {animatedBorder && layout.w > 0 && layout.h > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, spinStyle]}
        >
          <LinearGradient
            colors={[...borderGradientColors]}
            locations={[0, 0.33, 0.66, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              width: box,
              height: box,
              left: (layout.w - box) / 2,
              top: (layout.h - box) / 2,
            }}
          />
        </Animated.View>
      ) : (
        <LinearGradient
          pointerEvents="none"
          colors={[...borderGradientColors]}
          locations={[0, 0.33, 0.66, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View
        style={[
          styles.inner,
          {
            borderRadius: innerRadius,
            backgroundColor: innerBackgroundColor,
            margin: borderWidth,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
  },
  inner: {
    overflow: 'hidden',
  },
})
