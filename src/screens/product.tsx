import { useContext, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext, AppContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function Product({ route, navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const { addToCart, savedItems, toggleSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()
  const styles = getStyles(theme)
  const product = route?.params?.product || {}
  const [packaging, setPackaging] = useState<'single' | 'set'>('single')
  const [quantity, setQuantity] = useState(1)
  const liked = savedItems.some(item => item.title === product.title)
  const heroImageSource = useMemo(() => {
    if (product?.featuredImageUrl) return { uri: product.featuredImageUrl }
    return product?.image
  }, [product])
  const priceText = useMemo(() => {
    if (product?.price?.amount) {
      const amount = Number(product.price.amount)
      if (Number.isFinite(amount)) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: product.price.currencyCode || 'USD',
          maximumFractionDigits: 2,
        }).format(amount)
      }
      return `$${product.price.amount}`
    }
    return product.price || '$14.99'
  }, [product])
  const categoryText = product?.productType || product?.category || 'Pops & Figures'

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <FeatherIcon name="chevron-left" size={16} color={'#5f6780'} />
        </TouchableOpacity>

        <View style={styles.heroImageWrap}>
          {heroImageSource ? (
            <Image source={heroImageSource} style={styles.heroImage} resizeMode="contain" />
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title || 'Fresh Orange'}</Text>
            <TouchableOpacity
              style={styles.heartButton}
              activeOpacity={0.85}
              onPress={() => toggleSavedItem(product)}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={23}
                color={liked ? '#ff4d4f' : '#a0a8bd'}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.inlinePrice}>{priceText}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{categoryText}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>1 lb</Text>
            <Text style={styles.metaDot}>•</Text>
            <FeatherIcon name="star" size={12} color={'#ff9f57'} />
            <Text style={styles.metaText}>4.8</Text>
          </View>
        </View>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <FeatherIcon name="minus" size={15} color={'#34406b'} />
            </TouchableOpacity>
            <View style={styles.qtyValueWrap}>
              <Text style={styles.qtyValue}>{quantity}</Text>
            </View>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => q + 1)}
            >
              <FeatherIcon name="plus" size={15} color={'#34406b'} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Packaging</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.optionButton, packaging === 'single' ? styles.optionButtonActive : null]}
              activeOpacity={0.9}
              onPress={() => setPackaging('single')}
            >
              <Text style={[styles.optionText, packaging === 'single' ? styles.optionTextActive : null]}>
                Single blind box
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, packaging === 'set' ? styles.optionButtonActive : null]}
              activeOpacity={0.9}
              onPress={() => setPackaging('set')}
            >
              <Text style={[styles.optionText, packaging === 'set' ? styles.optionTextActive : null]}>
                Whole set
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          <Text style={styles.sectionBody} numberOfLines={3}>
            Whole set contains 12 non-repeating blind boxes. Limited collectible figure with premium paint detail,
            display-ready finish, and careful packaging.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footerBar, { bottom: insets.bottom + 10 }]}>
        <Text style={styles.price}>{priceText}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.9}
            onPress={() => {
              addToCart(product, quantity)
              navigation.navigate('Tabs', {
                screen: 'Profile',
                params: {
                  screen: 'ProfileCart',
                },
              })
            }}
          >
            <Text style={styles.addButtonText}>Add to cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buyButton} activeOpacity={0.9}>
            <Text style={styles.buyButtonText}>Buy now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f6f8fc',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 128,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroImageWrap: {
    height: 580,
    borderRadius: 10,
    backgroundColor: '#f0f3f9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#2a335f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  infoCard: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#1d274c',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    flex: 1,
    fontFamily: theme.boldFont,
    fontSize: 36,
    lineHeight: 40,
    color: '#1f2948',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlinePrice: {
    marginTop: 6,
    color: '#ff9f57',
    fontFamily: theme.boldFont,
    fontSize: 22,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: theme.mediumFont,
    color: '#667191',
    fontSize: 13,
  },
  metaDot: {
    color: '#a0a8bd',
    fontSize: 12,
  },
  section: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#1d274c',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  optionButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#f1f4fa',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  optionButtonActive: {
    backgroundColor: '#2a335f',
  },
  optionText: {
    color: '#677394',
    fontFamily: theme.mediumFont,
    fontSize: 13,
    textAlign: 'center',
  },
  optionTextActive: {
    color: '#ffffff',
  },
  sectionTitle: {
    fontFamily: theme.boldFont,
    color: '#233055',
    fontSize: 24,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: theme.regularFont,
    color: '#6d7897',
    fontSize: 14,
    lineHeight: 22,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
  },
  qtyButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf1f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValueWrap: {
    minWidth: 56,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  qtyValue: {
    color: '#243157',
    fontFamily: theme.boldFont,
    fontSize: 18,
  },
  footerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: '#2a335f',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#0f1a40',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  price: {
    color: '#ffffff',
    fontFamily: theme.boldFont,
    fontSize: 22,
    minWidth: 92,
  },
  actionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#cfd6e8',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#2a335f',
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#eef2f9',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: '#2a335f',
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
})
