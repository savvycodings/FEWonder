import { useContext, useRef } from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { SvgUri } from 'react-native-svg'
import { AppContext } from '../context'
import type { ProductSavePayload } from './ProductImageSaveHeart'

const CART_SVG_WEB = '/homepageimgs/icons/cart-add.svg'

type ProductImageAddToCartProps = {
  product: ProductSavePayload
  iconSize?: number
}

export function ProductImageAddToCart({ product, iconSize = 22 }: ProductImageAddToCartProps) {
  const { addToCart } = useContext(AppContext)
  const scale = useRef(new Animated.Value(1)).current
  const pad = Math.max(6, Math.round(iconSize * 0.28))
  const circle = iconSize + pad * 2
  const svgW = Math.round(iconSize * 1.2)
  const svgH = svgW

  function handlePress() {
    addToCart(product, 1)
    scale.stopAnimation()
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.18,
        duration: 75,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: true,
      }),
    ]).start()
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 4, left: 4, bottom: 6, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel="Add to cart"
      style={[
        styles.btn,
        {
          width: circle,
          height: circle,
          borderRadius: circle / 2,
        },
      ]}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        {Platform.OS === 'web' ? (
          <View style={styles.svgWrap}>
            <SvgUri uri={CART_SVG_WEB} width={svgW} height={svgH} />
          </View>
        ) : (
          <MaterialCommunityIcons name="cart-plus" size={iconSize + 2} color="#ffffff" />
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    zIndex: 6,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
