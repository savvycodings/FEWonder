import { useContext, useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { AppContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney, parseMoneyToNumber } from '../money'

export function Cart({ navigation }: any) {
  const { cartItems, updateCartItemQuantity, removeFromCart, clearCart } = useContext(AppContext)
  const insets = useSafeAreaInsets()

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = parseMoneyToNumber(item.price)
      return sum + price * (item.quantity || 1)
    }, 0)
  }, [cartItems])

  function goBackToProfile() {
    navigation.navigate('ProfileHome')
  }

  if (!cartItems.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyHeader, { top: insets.top + 8 }]}>
          <Pressable style={styles.backButton} onPress={goBackToProfile}>
            <FeatherIcon name="arrow-left" size={16} color="#5f6780" />
          </Pressable>
        </View>
        <View style={styles.emptyIconWrap}>
          <FeatherIcon name="shopping-cart" size={30} color="#7f89a5" />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add products from Home, Search, or Product page.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={goBackToProfile}>
            <FeatherIcon name="arrow-left" size={16} color="#5f6780" />
          </Pressable>
          <Text style={styles.title}>Shopping Cart</Text>
        </View>
        <Pressable onPress={clearCart}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {cartItems.map((item) => (
        <View key={item.title} style={styles.itemCard}>
          <Pressable style={styles.removeButton} onPress={() => removeFromCart(item.title)}>
            <FeatherIcon name="x" size={14} color="#8f97ad" />
          </Pressable>
          <View style={styles.imageWrap}>
            <Image
              source={item.featuredImageUrl ? { uri: item.featuredImageUrl } : item.image}
              style={styles.image}
              resizeMode="contain"
            />
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
                <FeatherIcon name="minus" size={14} color="#2a335f" />
              </Pressable>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyButton}
                onPress={() => updateCartItemQuantity(item.title, item.quantity + 1)}
              >
                <FeatherIcon name="plus" size={14} color="#2a335f" />
              </Pressable>
            </View>
          </View>
        </View>
      ))}

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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  emptyHeader: {
    position: 'absolute',
    top: 18,
    left: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#243056',
    fontFamily: 'Geist-Bold',
    fontSize: 28,
  },
  clearText: {
    color: '#f5a25d',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#f2f5fb',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imageWrap: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: '#eff3fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
    marginLeft: 10,
    paddingRight: 28,
  },
  itemTitle: {
    color: '#2a3359',
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
    backgroundColor: '#edf1f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    color: '#2a3359',
    fontFamily: 'Geist-Bold',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
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
    color: '#8b94aa',
    fontFamily: 'Geist-Regular',
    fontSize: 13,
  },
  summaryValue: {
    color: '#2a3359',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#edf1f8',
    marginVertical: 6,
  },
  totalLabel: {
    color: '#243056',
    fontFamily: 'Geist-Bold',
    fontSize: 16,
  },
  totalValue: {
    color: '#243056',
    fontFamily: 'Geist-Bold',
    fontSize: 18,
  },
  checkoutButton: {
    marginTop: 10,
    backgroundColor: '#2a335f',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: '#f7f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#edf1f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#2a3359',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 6,
  },
  emptySub: {
    color: '#8b94aa',
    fontFamily: 'Geist-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
})
