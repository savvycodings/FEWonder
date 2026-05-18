import { useContext, useMemo, type ReactNode } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppContext, ThemeContext } from '../context'
import { formatMoney, parseMoneyToNumber } from '../money'
import { brandAccentRgba } from '../brandAccent'
import { getCartStockError, maxPurchasableQuantity } from '../productStock'

const SHIPPING_SINGLE_ZAR = 150
const SHIPPING_WHOLE_SET_ZAR = 200
const CART_CURRENCY = 'ZAR'

const ACCENT_TEXT = '#000000'
const HEADING_FONT = 'Montserrat_700Bold' as const

export function Cart({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const route = useRoute()
  const { width: windowWidth } = useWindowDimensions()
  /** `Tabs` shell already applies top/horizontal safe insets; root `Stack` `Cart` does not. */
  const isProfileCart = route.name === 'ProfileCart'
  const insets = useSafeAreaInsets()
  const { cartItems, updateCartItemQuantity, removeFromCart, clearCart } = useContext(AppContext)
  const iconColor = theme.textColor || '#ffffff'

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = parseMoneyToNumber(item.price)
      return sum + price * (item.quantity || 1)
    }, 0)
  }, [cartItems])

  const shippingTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const isWholeSet =
        item?.selectedPackaging === 'set' || String(item?.title || '').includes('(Whole set)')
      const rate = isWholeSet ? SHIPPING_WHOLE_SET_ZAR : SHIPPING_SINGLE_ZAR
      return sum + rate * (item.quantity || 1)
    }, 0)
  }, [cartItems])

  const orderTotal = subtotal + shippingTotal
  const cartStockErr = useMemo(() => getCartStockError(cartItems), [cartItems])

  const formatZar = (amount: number) =>
    formatMoney({ amount: amount.toFixed(2), currencyCode: CART_CURRENCY }, CART_CURRENCY)

  const scrollBottomPad = 120 + insets.bottom
  const emptyTitleFontSize = Math.max(18, Math.min(22, windowWidth * 0.055))

  function onCheckoutPress() {
    if (cartStockErr) {
      Alert.alert('Out of stock', cartStockErr)
      return
    }
    navigation.navigate('CartCheckout')
  }

  function goBackToPrevious() {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }
    navigation.navigate('ProfileHome')
  }

  function cartThumbSource(item: any) {
    if (item?.featuredImageUrl && String(item.featuredImageUrl).trim()) {
      return { uri: String(item.featuredImageUrl).trim() }
    }
    if (item?.image) return item.image
    return null
  }

  const screenShell = (children: ReactNode) =>
    isProfileCart ? (
      <View style={[styles.container, styles.screenFill]}>{children}</View>
    ) : (
      <SafeAreaView style={[styles.container, styles.screenFill]} edges={['top', 'left', 'right']}>
        {children}
      </SafeAreaView>
    )

  if (!cartItems.length) {
    return screenShell(
      <>
        <View style={styles.topNavRow}>
          <Pressable
            style={styles.backButton}
            onPress={goBackToPrevious}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="arrow-left" size={20} color={iconColor} />
          </Pressable>
        </View>
        <View style={[styles.emptyBody, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.emptyIconWrap}>
            <FeatherIcon name="shopping-bag" size={28} color={theme.brandAccent} />
          </View>
          <Text
            style={[styles.emptyTitle, { fontSize: emptyTitleFontSize, lineHeight: emptyTitleFontSize + 6 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={1}
          >
            Your cart is empty
          </Text>
          <Text style={styles.emptySub}>Add products from Home, Search, or Product page.</Text>
        </View>
      </>,
    )
  }

  return screenShell(
    <>
      <View style={styles.topNavRow}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={goBackToPrevious}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FeatherIcon name="arrow-left" size={20} color={iconColor} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              Shopping Cart
            </Text>
          </View>
          <Pressable onPress={clearCart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {cartItems.map((item) => {
          const thumb = cartThumbSource(item)
          return (
            <View key={item.title} style={styles.itemCard}>
              <Pressable style={styles.removeButton} onPress={() => removeFromCart(item.title)}>
                <FeatherIcon name="x" size={14} color={theme.mutedForegroundColor || '#a8a8a8'} />
              </Pressable>
              <View style={styles.imageWrap}>
                {thumb ? (
                  <Image source={thumb} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>{String(item.title || '?').slice(0, 1)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemPrice}>
                  {item.price && typeof item.price === 'object' ? formatMoney(item.price) : String(item.price || '')}
                </Text>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => updateCartItemQuantity(item.title, Math.max(1, item.quantity - 1))}
                  >
                    <FeatherIcon name="minus" size={14} color={iconColor} />
                  </Pressable>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => {
                      const max = maxPurchasableQuantity(item)
                      if (max > 0 && item.quantity >= max) {
                        Alert.alert('Out of stock', `Only ${max} in stock for this item.`)
                        return
                      }
                      updateCartItemQuantity(item.title, item.quantity + 1)
                    }}
                  >
                    <FeatherIcon name="plus" size={14} color={iconColor} />
                  </Pressable>
                </View>
              </View>
            </View>
          )
        })}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatZar(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{formatZar(shippingTotal)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatZar(orderTotal)}</Text>
          </View>
          {cartStockErr ? (
            <Text style={styles.stockWarning}>{cartStockErr}</Text>
          ) : null}
          <Pressable
            style={[styles.checkoutButton, cartStockErr ? styles.checkoutButtonDisabled : null]}
            disabled={Boolean(cartStockErr)}
            onPress={onCheckoutPress}
          >
            <Text style={styles.checkoutText}>Checkout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>,
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    container: {
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor || '#000000',
    },
    screenFill: {
      flex: 1,
    },
    topNavRow: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingTop: 8,
    },
    header: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.12)',
    },
    title: {
      flex: 1,
      minWidth: 0,
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.25,
    },
    clearText: {
      color: theme.brandAccent,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
    itemCard: {
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#1a1a1a',
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.1)',
    },
    removeButton: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.08)',
    },
    imageWrap: {
      width: 78,
      height: 78,
      borderRadius: 12,
      backgroundColor: theme.secondaryBackgroundColor || '#2a2a2a',
      overflow: 'hidden',
      position: 'relative',
    },
    imagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.secondaryBackgroundColor || '#2a2a2a',
    },
    imagePlaceholderText: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.boldFont,
      fontSize: 22,
    },
    itemBody: {
      flex: 1,
      marginLeft: 10,
      paddingRight: 28,
    },
    itemTitle: {
      color: theme.textColor || '#ffffff',
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      marginBottom: 4,
    },
    itemPrice: {
      color: theme.brandAccent,
      fontFamily: theme.boldFont,
      fontSize: 14,
      marginBottom: 8,
    },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    qtyButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.1)',
    },
    qtyValue: {
      minWidth: 24,
      textAlign: 'center',
      color: theme.textColor || '#ffffff',
      fontFamily: theme.boldFont,
      fontSize: 14,
    },
    summaryCard: {
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#1a1a1a',
      borderRadius: 16,
      padding: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.1)',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    summaryLabel: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    summaryValue: {
      color: theme.textColor || '#ffffff',
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: theme.tileBorderColor || 'rgba(255,255,255,0.12)',
      marginVertical: 6,
    },
    totalLabel: {
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      fontSize: 17,
      letterSpacing: -0.2,
    },
    totalValue: {
      color: theme.brandAccent,
      fontFamily: theme.boldFont,
      fontSize: 18,
    },
    stockWarning: {
      marginTop: 10,
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: theme.brandAccent,
      lineHeight: 18,
    },
    checkoutButton: {
      marginTop: 10,
      backgroundColor: theme.brandAccent,
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    },
    checkoutButtonDisabled: {
      opacity: 0.45,
    },
    checkoutText: {
      color: theme.brandAccent_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 15,
    },
    emptyBody: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    emptyIconWrap: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#1a1a1a',
      borderWidth: 2,
      borderColor: L(0.35),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      width: '100%',
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      marginBottom: 6,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    emptySub: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.regularFont,
      fontSize: 13,
      textAlign: 'center',
    },
  })
}
