import { useContext, useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { AppContext } from '../context'
import { SafeAreaView } from 'react-native-safe-area-context'
import { formatMoney, parseMoneyToNumber } from '../money'

export function Cart({ navigation }: any) {
  const { cartItems, updateCartItemQuantity, removeFromCart, clearCart } = useContext(AppContext)

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = parseMoneyToNumber(item.price)
      return sum + price * (item.quantity || 1)
    }, 0)
  }, [cartItems])

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
      <View style={styles.emptyWrap}>
        <SafeAreaView style={styles.safeTop} edges={['top']}>
          <View style={styles.topNavRow}>
            <Pressable
              style={styles.backButton}
              onPress={goBackToProfile}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FeatherIcon name="arrow-left" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </SafeAreaView>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIconWrap}>
            <FeatherIcon name="shopping-cart" size={30} color="#ffffff" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add products from Home, Search, or Product page.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
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
                <FeatherIcon name="arrow-left" size={20} color="#ffffff" />
              </Pressable>
              <Text style={styles.title}>Shopping Cart</Text>
            </View>
            <Pressable onPress={clearCart}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {cartItems.map((item) => {
        const thumb = cartThumbSource(item)
        return (
        <View key={item.title} style={styles.itemCard}>
          <Pressable style={styles.removeButton} onPress={() => removeFromCart(item.title)}>
            <FeatherIcon name="x" size={14} color="#a8a8a8" />
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
                <FeatherIcon name="minus" size={14} color="#ffffff" />
              </Pressable>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyButton}
                onPress={() => updateCartItemQuantity(item.title, item.quantity + 1)}
              >
                <FeatherIcon name="plus" size={14} color="#ffffff" />
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeTop: {
    backgroundColor: '#000000',
  },
  topNavRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 120,
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
  },
  clearText: {
    color: '#f5a25d',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imageWrap: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
    position: 'relative',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
  },
  imagePlaceholderText: {
    color: '#a8a8a8',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
  },
  itemBody: {
    flex: 1,
    marginLeft: 10,
    paddingRight: 28,
  },
  itemTitle: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  itemPrice: {
    color: '#f5a25d',
    fontFamily: 'Geist-Bold',
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
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#a8a8a8',
    fontFamily: 'Geist-Regular',
    fontSize: 13,
  },
  summaryValue: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
  },
  totalLabel: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 16,
  },
  totalValue: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 18,
  },
  checkoutButton: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#000000',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: '#000000',
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
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 6,
  },
  emptySub: {
    color: '#a8a8a8',
    fontFamily: 'Geist-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
})
