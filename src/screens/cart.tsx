import { useContext, useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppContext, ThemeContext } from '../context'
import { formatMoney, parseMoneyToNumber } from '../money'

const ACCENT = '#CBFF00'
const ACCENT_TEXT = '#000000'
const HEADING_FONT = 'Montserrat_700Bold' as const

export function Cart({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const { cartItems, updateCartItemQuantity, removeFromCart, clearCart } = useContext(AppContext)
  const iconColor = theme.textColor || '#ffffff'

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = parseMoneyToNumber(item.price)
      return sum + price * (item.quantity || 1)
    }, 0)
  }, [cartItems])

  const scrollBottomPad = 120 + insets.bottom

  function goBackToProfile() {
    navigation.navigate('ProfileHome')
  }

  function cartThumbSource(item: any) {
    if (item?.featuredImageUrl && String(item.featuredImageUrl).trim()) {
      return { uri: String(item.featuredImageUrl).trim() }
    }
    if (item?.image) return item.image
    return null
  }

  if (!cartItems.length) {
    return (
      <SafeAreaView style={[styles.container, styles.screenFill]} edges={['top', 'left', 'right']}>
        <View style={styles.topNavRow}>
          <Pressable
            style={styles.backButton}
            onPress={goBackToProfile}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="arrow-left" size={20} color={iconColor} />
          </Pressable>
        </View>
        <View style={[styles.emptyBody, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.emptyIconWrap}>
            <FeatherIcon name="shopping-bag" size={28} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add products from Home, Search, or Product page.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, styles.screenFill]} edges={['top', 'left', 'right']}>
      <View style={styles.topNavRow}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={goBackToProfile}
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
                    onPress={() => updateCartItemQuantity(item.title, item.quantity + 1)}
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
            <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>$0.00</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
          <Pressable style={styles.checkoutButton} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.checkoutText}>Checkout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
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
      color: ACCENT,
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
      color: ACCENT,
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
      color: ACCENT,
      fontFamily: theme.boldFont,
      fontSize: 18,
    },
    checkoutButton: {
      marginTop: 10,
      backgroundColor: ACCENT,
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    },
    checkoutText: {
      color: ACCENT_TEXT,
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
      borderColor: 'rgba(203, 255, 0, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      fontSize: 22,
      lineHeight: 28,
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
