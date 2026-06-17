import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext, AppContext } from '../context'
import { WonderportAccentCard, ProductSoldOutOverlay, ProductRestockNotifier } from '../components'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney, parseMoneyToNumber } from '../money'
import { getDbProductByHandle } from '../utils'
import type { ShopifyMoney, ShopifyProduct } from '../../types'
import { brandAccentRgba } from '../brandAccent'
import {
  formatStockLabel,
  isProductInStock,
  maxPurchasableQuantity,
} from '../productStock'
import { productShowsPackagingChoice } from '../productPurchaseMode'
import { isSameSavedProduct, shopifyProductToSavePayload } from '../productSave'
const ACCENT_ON_BADGE_TEXT = '#ffffff'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

function collectProductGalleryUrls(product: ShopifyProduct): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const add = (raw: unknown) => {
    const url =
      typeof raw === 'string'
        ? raw.trim()
        : raw && typeof raw === 'object' && 'url' in raw
          ? String((raw as { url?: string }).url || '').trim()
          : ''
    if (!url || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }
  if (Array.isArray(product.images)) {
    for (const img of product.images) add(img)
  }
  add(product.featuredImageUrl)
  return urls
}

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
  const { addToCart, savedItems, toggleSavedItem, sessionToken } = useContext(AppContext)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const styles = getStyles(theme)
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const initialProduct = (route?.params?.product || {}) as ShopifyProduct
  const [product, setProduct] = useState<ShopifyProduct>(initialProduct)
  const productHandle = String(route?.params?.product?.handle || '').trim()
  const loadedHeroUrisRef = useRef<Set<string>>(new Set())
  const heroImageUriRef = useRef('')
  const galleryListRef = useRef<FlatList<string>>(null)
  const [heroGalleryWidth, setHeroGalleryWidth] = useState(0)
  const [heroImageLoading, setHeroImageLoading] = useState(false)
  const [selectedGalleryUri, setSelectedGalleryUri] = useState('')
  const [packaging, setPackaging] = useState<'single' | 'set'>('single')
  const [quantity, setQuantity] = useState(1)
  const liked = savedItems.some((item) => isSameSavedProduct(item, product))
  useEffect(() => {
    setProduct((route?.params?.product || {}) as ShopifyProduct)
    setPackaging('single')
  }, [route?.params?.product])

  useEffect(() => {
    if (!productHandle) return
    let cancelled = false
    ;(async () => {
      try {
        const fullProduct = await getDbProductByHandle(productHandle)
        if (!cancelled) setProduct(fullProduct)
      } catch {
        /* keep route param payload if fetch fails */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productHandle])

  const showPackaging = useMemo(() => productShowsPackagingChoice(product), [product])
  const linePackaging = showPackaging && packaging === 'set' ? 'set' : 'single'
  const hasWholeSet = linePackaging === 'set'

  useEffect(() => {
    if (!showPackaging) setPackaging('single')
  }, [showPackaging, product?.id, product?.handle])

  const selectedUnitPrice = useMemo<ShopifyMoney | null>(() => {
    if (showPackaging && packaging === 'set') return product?.packagePrices?.set ?? product?.price ?? null
    return product?.packagePrices?.single ?? product?.price ?? null
  }, [packaging, product, showPackaging])

  const galleryUrls = useMemo(() => collectProductGalleryUrls(product), [product])

  useEffect(() => {
    setSelectedGalleryUri(galleryUrls[0] || '')
  }, [product.id, product.handle, galleryUrls.join('|')])

  const heroImageUri = useMemo(() => {
    const selected = String(selectedGalleryUri || '').trim()
    if (selected) return selected
    return galleryUrls[0] || ''
  }, [selectedGalleryUri, galleryUrls])

  const heroImageSource = useMemo(() => {
    if (heroImageUri) return { uri: heroImageUri }
    return product?.image
  }, [heroImageUri, product?.image])

  const showGalleryThumbs = galleryUrls.length > 1
  /** Measured inner width of hero frame — avoids peek of adjacent slides (borders / rounding). */
  const galleryPageWidth = heroGalleryWidth > 0 ? heroGalleryWidth : Math.max(width - 32, 1)
  const heroShowsLoadingOverlay = Boolean(heroImageUri && heroImageLoading)

  function selectGalleryIndex(index: number, animated = true) {
    if (index < 0 || index >= galleryUrls.length) return
    const uri = galleryUrls[index]
    if (!uri) return
    setSelectedGalleryUri(uri)
    if (galleryUrls.length > 1) {
      galleryListRef.current?.scrollToIndex({ index, animated })
    }
  }

  function syncGalleryFromScrollOffset(offsetX: number) {
    if (galleryUrls.length < 2) return
    const index = Math.round(offsetX / galleryPageWidth)
    const clamped = Math.min(Math.max(index, 0), galleryUrls.length - 1)
    const uri = galleryUrls[clamped]
    if (uri && uri !== selectedGalleryUri) setSelectedGalleryUri(uri)
  }

  function onGalleryScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    syncGalleryFromScrollOffset(event.nativeEvent.contentOffset.x)
  }

  heroImageUriRef.current = heroImageUri

  useEffect(() => {
    if (!heroImageUri) {
      setHeroImageLoading(false)
      return
    }
    setHeroImageLoading(!loadedHeroUrisRef.current.has(heroImageUri))
  }, [heroImageUri])

  function markHeroImageLoaded(forUri: string) {
    if (!forUri) return
    loadedHeroUrisRef.current.add(forUri)
    if (heroImageUriRef.current === forUri) setHeroImageLoading(false)
  }
  const priceText = useMemo(() => {
    if (selectedUnitPrice?.amount != null && selectedUnitPrice.amount !== '') {
      return formatMoney(selectedUnitPrice)
    }
    return 'Price on request'
  }, [selectedUnitPrice])
  const footerTotalText = useMemo(() => {
    if (selectedUnitPrice?.amount == null || selectedUnitPrice.amount === '') return 'Price on request'
    const unit = parseMoneyToNumber(selectedUnitPrice)
    if (!Number.isFinite(unit) || unit <= 0) return 'Price on request'
    return formatMoney(
      {
        amount: unit * quantity,
        currencyCode: selectedUnitPrice.currencyCode,
      },
      String(selectedUnitPrice.currencyCode || 'USD'),
    )
  }, [selectedUnitPrice, quantity])
  const stockLabel = useMemo(() => formatStockLabel(product), [product])
  const inStock = useMemo(() => isProductInStock(product), [product])
  const maxQty = useMemo(() => maxPurchasableQuantity(product), [product])

  useEffect(() => {
    if (maxQty > 0 && quantity > maxQty) setQuantity(maxQty)
  }, [maxQty, quantity])

  const compareText = useMemo(() => {
    if (showPackaging && packaging === 'set') return null
    const c = product?.compareAtPrice
    if (c?.amount != null && c.amount !== '' && selectedUnitPrice?.amount) {
      const sale = parseFloat(String(selectedUnitPrice.amount))
      const was = parseFloat(String(c.amount))
      if (Number.isFinite(sale) && Number.isFinite(was) && was > sale) {
        return formatMoney(c)
      }
    }
    return null
  }, [packaging, product?.compareAtPrice, selectedUnitPrice, showPackaging])
  const detailText = useMemo(
    () =>
      plainTextFromHtml(product?.descriptionHtml, 800) ||
      'See photos and listing details. Packaging and edition may vary by vendor.',
    [product?.descriptionHtml]
  )
  const heroSize = Math.min(Math.max(width - 32, 260), 380)

  function onBuyNowPress() {
    if (!inStock) {
      Alert.alert('Out of stock', 'This item is not available to purchase right now.')
      return
    }
    if (!product?.id) {
      Alert.alert('Product', 'This listing cannot be ordered (missing id).')
      return
    }
    if (priceText === 'Price on request') {
      Alert.alert('Price', 'This item has no fixed price online. Contact support.')
      return
    }
    const cur = String(selectedUnitPrice?.currencyCode || '').trim().toUpperCase()
    if (cur !== 'ZAR') {
      Alert.alert(
        'Checkout',
        'South African Pudo locker shipping applies to ZAR-priced items only. This product is priced in another currency.',
      )
      return
    }
    const subtotalZar = parseMoneyToNumber(selectedUnitPrice) * quantity
    navigation.navigate('CheckoutDelivery', {
      from: 'product',
      subtotalZar,
      items: [
        {
          productId: String(product.id),
          quantity,
          packaging: linePackaging,
        },
      ],
    })
  }

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
            <FeatherIcon name="chevron-left" size={20} color={theme.brandAccent} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={[styles.heroImageWrap, { height: heroSize }]}>
          <View
            style={styles.heroGalleryClip}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width)
              if (w > 0 && w !== heroGalleryWidth) setHeroGalleryWidth(w)
            }}
          >
          {galleryUrls.length > 0 ? (
            <FlatList
              key={`${product.id || product.handle || 'product'}-gallery-${galleryPageWidth}`}
              ref={galleryListRef}
              style={[styles.heroGalleryList, { width: galleryPageWidth, height: heroSize }]}
              data={galleryUrls}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              scrollEnabled={galleryUrls.length > 1}
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews
              overScrollMode="never"
              bounces={false}
              decelerationRate="fast"
              keyExtractor={(uri, index) => `${uri}-${index}`}
              getItemLayout={(_, index) => ({
                length: galleryPageWidth,
                offset: galleryPageWidth * index,
                index,
              })}
              onMomentumScrollEnd={onGalleryScrollEnd}
              onScrollEndDrag={onGalleryScrollEnd}
              onScrollToIndexFailed={(info) => {
                galleryListRef.current?.scrollToOffset({
                  offset: galleryPageWidth * info.index,
                  animated: false,
                })
              }}
              renderItem={({ item: uri }) => (
                <View style={[styles.heroGallerySlide, { width: galleryPageWidth, height: heroSize }]}>
                  <Image
                    source={{ uri }}
                    style={styles.heroGalleryImage}
                    resizeMode="cover"
                    onLoadStart={() => {
                      if (!uri || loadedHeroUrisRef.current.has(uri)) return
                      if (heroImageUriRef.current === uri) setHeroImageLoading(true)
                    }}
                    onLoad={() => markHeroImageLoaded(uri)}
                    onLoadEnd={() => markHeroImageLoaded(uri)}
                    onError={() => markHeroImageLoaded(uri)}
                  />
                </View>
              )}
            />
          ) : heroImageSource ? (
            <Image
              key={heroImageUri || 'local-hero'}
              source={heroImageSource}
              style={styles.heroGalleryImage}
              resizeMode="cover"
              onLoadStart={() => {
                const uri = heroImageUri
                if (!uri || loadedHeroUrisRef.current.has(uri)) return
                setHeroImageLoading(true)
              }}
              onLoad={() => markHeroImageLoaded(heroImageUri)}
              onLoadEnd={() => markHeroImageLoaded(heroImageUri)}
              onError={() => markHeroImageLoaded(heroImageUri)}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>{product.title || 'Product'}</Text>
            </View>
          )}
          {!inStock ? <ProductSoldOutOverlay /> : null}
          </View>
          {heroShowsLoadingOverlay ? (
            <View style={styles.heroImageLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.brandAccent} />
            </View>
          ) : null}
        </View>

        {showGalleryThumbs ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.galleryThumbsRow}
            contentContainerStyle={styles.galleryThumbsContent}
          >
            {galleryUrls.map((uri) => {
              const active = uri === heroImageUri
              return (
                <TouchableOpacity
                  key={uri}
                  activeOpacity={0.85}
                  onPress={() => selectGalleryIndex(galleryUrls.indexOf(uri))}
                  style={[styles.galleryThumbWrap, active && styles.galleryThumbWrapActive]}
                  accessibilityRole="button"
                  accessibilityLabel="View product image"
                  accessibilityState={{ selected: active }}
                >
                  <Image source={{ uri }} style={styles.galleryThumbImage} resizeMode="cover" />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : null}

        {!inStock && product?.id ? (
          <ProductRestockNotifier
            productId={String(product.id)}
            sessionToken={sessionToken || null}
            theme={theme}
          />
        ) : null}

        <WonderportAccentCard
          borderWidth={2}
          borderRadius={18}
          innerBackgroundColor={frameFill}
          style={styles.infoCardOuter}
          contentStyle={styles.infoCardInner}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title || 'Product'}</Text>
            <TouchableOpacity
              style={styles.heartButton}
              activeOpacity={0.85}
              onPress={() => void toggleSavedItem(shopifyProductToSavePayload(product))}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={23}
                color={liked ? '#ff4d4f' : brandAccentRgba(theme, 0.45)}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.inlinePrice}>{priceText}</Text>
            {compareText ? <Text style={styles.compareAtPrice}>{compareText}</Text> : null}
          </View>
          <Text style={styles.stockLabel}>{stockLabel}</Text>
        </WonderportAccentCard>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <FeatherIcon name="minus" size={15} color={theme.brandAccent} />
            </TouchableOpacity>
            <View style={styles.qtyValueWrap}>
              <Text style={styles.qtyValue}>{quantity}</Text>
            </View>
            <TouchableOpacity
              style={[styles.qtyButton, quantity >= maxQty || !inStock ? styles.qtyButtonDisabled : null]}
              activeOpacity={0.85}
              disabled={!inStock || quantity >= maxQty}
              onPress={() => setQuantity(q => Math.min(maxQty, q + 1))}
            >
              <FeatherIcon name="plus" size={15} color={theme.brandAccent} />
            </TouchableOpacity>
          </View>
        </View>

        {showPackaging ? (
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
        ) : null}

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>About this item</Text>
          <Text style={styles.sectionBody}>{detailText}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footerBar, { bottom: insets.bottom + 10 }]}>
        <Text style={styles.price}>{footerTotalText}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.addButton, !inStock ? styles.footerButtonDisabled : null]}
            activeOpacity={0.9}
            disabled={!inStock}
            onPress={() => {
              if (!inStock) {
                Alert.alert('Out of stock', 'This item is not available to purchase right now.')
                return
              }
              const packagedItem = {
                ...product,
                price: selectedUnitPrice,
                selectedPackaging: linePackaging,
                title:
                  linePackaging === 'set'
                    ? `${String(product?.title || 'Product')} (Whole set)`
                    : String(product?.title || 'Product'),
              }
              addToCart(packagedItem, quantity)
              navigation.navigate('Cart')
            }}
          >
            <Text style={styles.addButtonText}>Add to cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyButton, !inStock ? styles.footerButtonDisabled : null]}
            activeOpacity={0.9}
            disabled={!inStock}
            onPress={onBuyNowPress}
          >
            <Text style={styles.buyButtonText}>Buy now</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  const surfaceBorder = L(0.3)
  const pageBg = theme.appBackgroundColor || theme.backgroundColor
  const surfaceBg = theme.sheetBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const frameFill = theme.frameInnerBackgroundColor || surfaceBg
  const textPrimary = theme.textColor
  const textMuted = theme.mutedForegroundColor
  const modalOverlay = theme.modalOverlayColor || 'rgba(0, 0, 0, 0.38)'
  return StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: pageBg,
  },
  safeTop: {
    backgroundColor: pageBg,
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
    backgroundColor: frameFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: surfaceBorder,
  },
  heroImageWrap: {
    borderRadius: 16,
    backgroundColor: surfaceBg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: surfaceBorder,
  },
  heroGalleryClip: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGalleryList: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
  },
  heroGallerySlide: {
    overflow: 'hidden',
    backgroundColor: surfaceBg,
  },
  heroGalleryImage: {
    width: '100%',
    height: '100%',
  },
  heroImageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: modalOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryThumbsRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  galleryThumbsContent: {
    gap: 8,
    paddingRight: 4,
  },
  galleryThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: surfaceBg,
  },
  galleryThumbWrapActive: {
    borderColor: theme.brandAccent,
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
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
    color: textMuted,
    textAlign: 'center',
  },
  infoCardOuter: {
    marginTop: 10,
    width: '100%',
  },
  infoCardInner: {
    padding: 16,
  },
  title: {
    flex: 1,
    fontFamily: HOME_MONTSERRAT_BOLD,
    fontSize: 22,
    lineHeight: 28,
    color: textPrimary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.sheetRowBackgroundColor || frameFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L(0.35),
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlinePrice: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 22,
  },
  compareAtPrice: {
    color: textMuted,
    fontFamily: theme.mediumFont,
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  stockLabel: {
    marginTop: 6,
    fontFamily: theme.mediumFont,
    fontSize: 14,
    color: theme.brandAccent,
  },
  section: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: surfaceBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: surfaceBorder,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  optionButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: frameFill,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: L(0.28),
  },
  optionButtonActive: {
    borderWidth: 2,
    borderColor: theme.brandAccent,
    backgroundColor: frameFill,
  },
  optionText: {
    color: theme.brandAccent,
    fontFamily: theme.mediumFont,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.88,
  },
  optionTextActive: {
    color: theme.brandAccent,
    opacity: 1,
    fontFamily: theme.boldFont,
  },
  sectionTitle: {
    fontFamily: HOME_MONTSERRAT_BOLD,
    color: textPrimary,
    fontSize: 18,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: theme.regularFont,
    color: textMuted,
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
    backgroundColor: frameFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: L(0.55),
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyValueWrap: {
    minWidth: 56,
    height: 42,
    borderRadius: 21,
    backgroundColor: frameFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 3,
    borderColor: L(0.55),
  },
  qtyValue: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 18,
  },
  footerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: frameFill,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 2,
    borderColor: theme.brandAccent,
  },
  price: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 20,
    minWidth: 92,
  },
  actionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.brandAccent,
  },
  addButtonText: {
    color: theme.brandAccent,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  buyButton: {
    flex: 1,
    backgroundColor: theme.brandAccent,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: ACCENT_ON_BADGE_TEXT,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  footerButtonDisabled: {
    opacity: 0.45,
  },
  deliveryBackdrop: {
    flex: 1,
    backgroundColor: modalOverlay,
  },
  deliveryKeyboardWrap: {
    flex: 1,
  },
  deliveryBackdropInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  deliveryCard: {
    borderRadius: 18,
    padding: 16,
    maxHeight: '92%',
    backgroundColor: surfaceBg,
    borderWidth: 1,
    borderColor: surfaceBorder,
  },
  deliveryTitle: {
    fontFamily: HOME_MONTSERRAT_BOLD,
    fontSize: 20,
    color: textPrimary,
    marginBottom: 12,
  },
  deliveryChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  deliveryChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: frameFill,
    borderWidth: 1,
    borderColor: L(0.3),
  },
  deliveryChipActive: {
    borderWidth: 2,
    borderColor: theme.brandAccent,
  },
  deliveryChipText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 12,
    color: theme.brandAccent,
    textAlign: 'center',
  },
  deliveryChipTextActive: {
    fontFamily: theme.boldFont,
  },
  deliveryScroll: {
    maxHeight: 360,
    marginBottom: 8,
  },
  deliveryFieldLabel: {
    fontFamily: theme.mediumFont,
    fontSize: 12,
    color: textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  deliveryBankHeading: {
    marginTop: 18,
    marginBottom: 2,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
    color: textPrimary,
  },
  deliveryInput: {
    borderWidth: 1,
    borderColor: surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    fontFamily: theme.mediumFont,
    fontSize: 15,
    color: textPrimary,
    backgroundColor: frameFill,
  },
  deliveryInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  deliveryError: {
    color: '#f87171',
    fontFamily: theme.mediumFont,
    fontSize: 13,
    marginBottom: 8,
  },
  deliveryFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deliveryCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: surfaceBorder,
    backgroundColor: frameFill,
  },
  deliveryCancelText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 14,
    color: textPrimary,
  },
  deliveryContinueBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brandAccent,
  },
  deliveryContinueText: {
    fontFamily: theme.boldFont,
    fontSize: 14,
    color: ACCENT_ON_BADGE_TEXT,
    textAlign: 'center',
  },
  checkoutBackdrop: {
    flex: 1,
    backgroundColor: modalOverlay,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  checkoutShell: {
    width: '100%',
    maxHeight: '90%',
  },
  checkoutInner: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    maxHeight: 520,
  },
  checkoutScroll: { maxHeight: 380, marginBottom: 10 },
  checkoutTitle: {
    fontFamily: theme.boldFont,
    fontSize: 20,
    color: theme.brandAccent,
    marginBottom: 8,
  },
  checkoutSubtitle: {
    fontFamily: theme.mediumFont,
    fontSize: 13,
    color: textMuted,
    lineHeight: 19,
    marginBottom: 16,
  },
  checkoutSection: {
    fontFamily: theme.boldFont,
    fontSize: 14,
    color: theme.brandAccent,
    marginTop: 8,
    marginBottom: 10,
  },
  checkoutLabel: {
    fontFamily: theme.mediumFont,
    fontSize: 11,
    color: L(0.65),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  checkoutValueMono: {
    fontFamily: theme.boldFont,
    fontSize: 16,
    color: textPrimary,
  },
  checkoutHint: {
    fontFamily: theme.regularFont,
    fontSize: 13,
    color: textMuted,
    lineHeight: 20,
    marginTop: 12,
  },
  copyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: theme.sheetRowBackgroundColor || frameFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L(0.25),
  },
  copyTextCol: { flex: 1, minWidth: 0 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: L(0.12),
  },
  copyBtnText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
    color: theme.brandAccent,
  },
  checkoutPrimaryBtn: {
    backgroundColor: theme.brandAccent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  checkoutPrimaryBtnText: {
    color: ACCENT_ON_BADGE_TEXT,
    fontFamily: theme.boldFont,
    fontSize: 15,
  },
  checkoutGhostBtn: { paddingVertical: 14, alignItems: 'center' },
  checkoutGhostBtnText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 15,
    color: L(0.85),
  },
  })
}
