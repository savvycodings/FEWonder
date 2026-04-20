import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/** Brand lime used in the border gradient (full opacity). */
export const WONDERPORT_ACCENT_HEX = '#CBFF00'

const CB = { r: 203, g: 255, b: 0 }

const BORDER_GRADIENT_COLORS = [
  `rgba(${CB.r},${CB.g},${CB.b},1)`,
  `rgba(${CB.r},${CB.g},${CB.b},0)`,
  `rgba(${CB.r},${CB.g},${CB.b},1)`,
  `rgba(${CB.r},${CB.g},${CB.b},0)`,
] as const

const BORDER_GRADIENT_LOCATIONS = [0, 0.33, 0.66, 1] as const

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
            colors={[...BORDER_GRADIENT_COLORS]}
            locations={[...BORDER_GRADIENT_LOCATIONS]}
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
          colors={[...BORDER_GRADIENT_COLORS]}
          locations={[...BORDER_GRADIENT_LOCATIONS]}
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
