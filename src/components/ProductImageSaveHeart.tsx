import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { AppContext } from '../context'

export type ProductSavePayload = {
  title: string
  price?: string
  image?: unknown
  category?: string
}

type ProductImageSaveHeartProps = {
  product: ProductSavePayload
  iconSize?: number
  top?: number
  right?: number
  /** Stack under a parent that is already positioned (e.g. `ProductImageQuickActions`). */
  inline?: boolean
}

const IG_RED = '#ff3040'

const EASE_SETTLE = Easing.bezier(0.22, 0.72, 0.28, 1)

export function ProductImageSaveHeart({
  product,
  iconSize = 22,
  top = 10,
  right = 10,
  inline = false,
}: ProductImageSaveHeartProps) {
  const { savedItems, toggleSavedItem } = useContext(AppContext)
  const saved = savedItems.some((i) => i.title === product.title)
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null)
  const displaySaved = optimisticSaved !== null ? optimisticSaved : saved

  const scale = useSharedValue(1)
  /** Touch-down already played the burst; touch-up only commits (avoids waiting for release to animate). */
  const burstPlayedRef = useRef(false)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  useEffect(() => {
    if (optimisticSaved !== null && optimisticSaved === saved) {
      setOptimisticSaved(null)
    }
  }, [saved, optimisticSaved])

  const playBurst = useCallback(
    (willSave: boolean) => {
      cancelAnimation(scale)
      scale.value = 1
      if (willSave) {
        // Noticeable pop, then rest at 1 = normal-sized filled red heart (optimistic fill on press).
        scale.value = withSequence(
          withTiming(1.38, { duration: 95, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 340, easing: EASE_SETTLE })
        )
      } else {
        scale.value = withSequence(
          withTiming(0.94, { duration: 70, easing: Easing.in(Easing.quad) }),
          withTiming(1, { duration: 260, easing: EASE_SETTLE })
        )
      }
    },
    [scale]
  )

  const handlePressIn = useCallback(() => {
    const willSave = !savedItems.some((i) => i.title === product.title)
    burstPlayedRef.current = true
    playBurst(willSave)
  }, [playBurst, product.title, savedItems])

  const handlePress = useCallback(() => {
    const willSave = !savedItems.some((i) => i.title === product.title)
    if (!burstPlayedRef.current) {
      playBurst(willSave)
    }
    burstPlayedRef.current = false

    setOptimisticSaved(willSave)
    queueMicrotask(() => {
      toggleSavedItem(product)
    })
  }, [playBurst, product, savedItems, toggleSavedItem])

  const pad = Math.max(6, Math.round(iconSize * 0.28))
  const circle = iconSize + pad * 2

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={handlePress}
      /** Keep touches inside the image — symmetric hitSlop draws outside the photo bounds. */
      hitSlop={{ top: 4, left: 4, bottom: 6, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={displaySaved ? 'Remove from saved items' : 'Save to profile'}
      style={[
        styles.heartAnchor,
        inline ? styles.heartInline : styles.heartFloating,
        !inline && { top, right },
        {
          width: circle,
          height: circle,
          borderRadius: circle / 2,
        },
      ]}
    >
      <Animated.View style={[styles.iconWrap, animatedStyle]}>
        <Ionicons
          name={displaySaved ? 'heart' : 'heart-outline'}
          size={iconSize}
          color={displaySaved ? IG_RED : '#ffffff'}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  heartAnchor: {
    zIndex: 6,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartFloating: {
    position: 'absolute',
  },
  heartInline: {
    position: 'relative',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
