import { useContext, useMemo, useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext, AppContext } from '../context'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney } from '../money'

function plainTextFromHtml(html: string | null | undefined, maxLen: number) {
  if (!html?.trim()) return ''
  const t = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1).trim()}…`
}

export function Product({ route, navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const { addToCart, savedItems, toggleSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
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
    if (product?.price?.amount != null && product.price.amount !== '') {
      return formatMoney(product.price)
    }
    return 'Price on request'
  }, [product])
  const compareText = useMemo(() => {
    const c = product?.compareAtPrice
    if (c?.amount != null && c.amount !== '' && product?.price?.amount) {
      const sale = parseFloat(String(product.price.amount))
      const was = parseFloat(String(c.amount))
      if (Number.isFinite(sale) && Number.isFinite(was) && was > sale) {
        return formatMoney(c)
      }
    }
    return null
  }, [product])
  const detailText = useMemo(
    () =>
      plainTextFromHtml(product?.descriptionHtml, 800) ||
      'See photos and listing details. Packaging and edition may vary by vendor.',
    [product?.descriptionHtml]
  )
  const metaParts = useMemo(() => {
    const parts = [product?.vendor, product?.productType || product?.category].filter(
      (p): p is string => Boolean(p && String(p).trim())
    )
    return parts.length ? parts : ['Collectible']
  }, [product])
  const heroSize = Math.min(Math.max(width - 32, 260), 380)

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="chevron-left" size={20} color={'#5f6780'} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroImageWrap, { height: heroSize }]}>
          {heroImageSource ? (
            <Image source={heroImageSource} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>{product.title || 'Product'}</Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title || 'Product'}</Text>
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
          <View style={styles.priceRow}>
            <Text style={styles.inlinePrice}>{priceText}</Text>
            {compareText ? <Text style={styles.compareAtPrice}>{compareText}</Text> : null}
          </View>

          <View style={styles.metaRow}>
            {metaParts.map((part, i) => (
              <View key={i} style={styles.metaChip}>
                <Text style={styles.metaChipText}>{part}</Text>
              </View>
            ))}
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
          <Text style={styles.sectionTitle}>About this item</Text>
          <Text style={styles.sectionBody}>{detailText}</Text>
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
  safeTop: {
    backgroundColor: '#f6f8fc',
  },
  /** ~44pt content area under status bar — iOS nav bar convention */
  topNavRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    paddingBottom: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 128,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageWrap: {
    borderRadius: 16,
    backgroundColor: '#f0f3f9',
    overflow: 'hidden',
    shadowColor: '#2a335f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heroPlaceholderText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 16,
    color: '#7a849e',
    textAlign: 'center',
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
    fontSize: 22,
    lineHeight: 28,
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
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlinePrice: {
    color: '#ff9f57',
    fontFamily: theme.boldFont,
    fontSize: 22,
  },
  compareAtPrice: {
    color: '#a0a8bd',
    fontFamily: theme.mediumFont,
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: '#f1f4fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaChipText: {
    fontFamily: theme.mediumFont,
    color: '#4d5878',
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
    fontSize: 18,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: theme.regularFont,
    color: '#6d7897',
    fontSize: 15,
    lineHeight: 23,
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
