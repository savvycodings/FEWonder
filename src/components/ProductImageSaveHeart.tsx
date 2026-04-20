import { useContext, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
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

export function ProductImageSaveHeart({
  product,
  iconSize = 22,
  top = 10,
  right = 10,
  inline = false,
}: ProductImageSaveHeartProps) {
  const { savedItems, toggleSavedItem } = useContext(AppContext)
  const saved = savedItems.some((i) => i.title === product.title)
  const scale = useRef(new Animated.Value(1)).current
  const pad = Math.max(6, Math.round(iconSize * 0.28))
  /** Total control size — matches touch target; anchored flush to `top` / `right` on the image. */
  const circle = iconSize + pad * 2

  function handlePress() {
    const willSave = !savedItems.some((i) => i.title === product.title)
    toggleSavedItem(product)
    scale.stopAnimation()

    if (willSave) {
      // Instagram-ish: pop up, then elastic settle (“beat” overshoot on the way to rest).
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 82,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 245,
          easing: Easing.out(Easing.back(1.32)),
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.87,
          duration: 72,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 195,
          easing: Easing.out(Easing.back(1.12)),
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      /** Keep touches inside the image — symmetric hitSlop draws outside the photo bounds. */
      hitSlop={{ top: 4, left: 4, bottom: 6, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved items' : 'Save to profile'}
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
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={iconSize}
          color={saved ? IG_RED : '#ffffff'}
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
