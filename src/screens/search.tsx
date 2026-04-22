import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Feather as FeatherIcon } from '@expo/vector-icons'
import { ProductTileImageWithHeart } from '../components'
import { ShopifyProduct } from '../../types'
import { ThemeContext } from '../context'
import { listDbProducts } from '../utils'
import { formatMoney } from '../money'

const GRID_GAP = 12

/** Match home.tsx price pills: lime fill + black label */
const HOME_ACCENT_BG = '#CBFF00'
const HOME_ACCENT_TEXT = '#000000'

/** Same Montserrat weight as home category chips (e.g. Popular) — registered in App.tsx */
const HOME_CHIP_MONTSERRAT = 'Montserrat_800ExtraBold' as const

function getImageSource(item: ShopifyProduct): ImageSourcePropType | undefined {
  if (item?.featuredImageUrl) return { uri: item.featuredImageUrl }
  return (item as { image?: ImageSourcePropType }).image
}

function productToSavePayload(item: ShopifyProduct) {
  const priceLabel =
    item.price?.amount != null && item.price.amount !== '' ? formatMoney(item.price) : undefined
  return {
    title: item.title,
    price: priceLabel,
    image: getImageSource(item),
    category: item.productType || undefined,
  }
}

const banners = [
  require('../../public/homepageimgs/searchbanner.webp'),
  require('../../public/homepageimgs/searchbanner2.webp'),
  require('../../public/homepageimgs/searchbanner3.webp'),
]
export function Search({ navigation }: { navigation: any }) {
  const [query, setQuery] = useState('')
  const [activeBanner, setActiveBanner] = useState(0)
  const bannerScrollRef = useRef<ScrollView | null>(null)
  const { width } = useWindowDimensions()
  const bannerWidth = width - 32
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const { theme } = useContext(ThemeContext)

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter(
      item =>
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.productType || '').toLowerCase().includes(q)
    )
  }, [query, products])
  const displayProducts = useMemo(
    () => (filtered.length ? filtered : products),
    [filtered, products]
  )
  const topSellers = useMemo(() => displayProducts.slice(0, 2), [displayProducts])
  const newArrivals = useMemo(() => displayProducts.slice(2, 4), [displayProducts])
  const cardW = (width - 32 - GRID_GAP) / 2
  const gridStyles = useMemo(() => getProductGridStyles(theme), [theme])

  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    const timeout = setTimeout(() => {
      ;(async () => {
        setLoadingProducts(true)
        try {
          console.log('[Search] loading DB products…', { q })
          const fetched = await listDbProducts({ first: 24, query: q || undefined })
          if (!cancelled && fetched.length) {
            console.log('[Search] DB products loaded', {
              q,
              count: fetched.length,
              first: {
                id: fetched[0]?.id,
                title: fetched[0]?.title,
                handle: fetched[0]?.handle,
                featuredImageUrl: fetched[0]?.featuredImageUrl,
              },
            })
            setProducts(fetched)
          } else if (!cancelled) {
            console.log('[Search] DB products empty', { q })
            setProducts([])
          }
        } catch (error: any) {
          if (!cancelled) {
            console.log('[Search] DB products failed', { q, message: error?.message })
            setProducts([])
          }
        } finally {
          if (!cancelled) setLoadingProducts(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  useEffect(() => {
    const id = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % banners.length
        bannerScrollRef.current?.scrollTo({
          x: next * bannerWidth,
          animated: true,
        })
        return next
      })
    }, 3500)

    return () => clearInterval(id)
  }, [bannerWidth])

  function renderProductCard(item: ShopifyProduct) {
    const src = getImageSource(item)
    const priceLabel =
      item.price?.amount != null && item.price.amount !== ''
        ? formatMoney(item.price)
        : 'View details'
    const savePayload = productToSavePayload(item)
    return (
      <View key={item.id || item.handle || item.title} style={[gridStyles.card, { width: cardW }]}>
        {src ? (
          <ProductTileImageWithHeart
            product={savePayload}
            source={src}
            resizeMode="cover"
            imageTranslateY={0}
            wrapStyle={gridStyles.media}
            imageStyle={gridStyles.mediaImage}
            onPress={() => navigation.navigate('Product', { product: item })}
          />
        ) : (
          <Pressable
            style={gridStyles.media}
            onPress={() => navigation.navigate('Product', { product: item })}
          >
            <View style={gridStyles.mediaPlaceholder}>
              <Text style={gridStyles.mediaPlaceholderText} numberOfLines={2} ellipsizeMode="tail">
                {item.title}
              </Text>
            </View>
          </Pressable>
        )}
        <View style={gridStyles.footerBand}>
          <Pressable
            style={gridStyles.cardFooter}
            onPress={() => navigation.navigate('Product', { product: item })}
          >
            <Text style={gridStyles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
              {item.title}
            </Text>
            <View style={gridStyles.priceRow}>
              <View style={gridStyles.pricePill}>
                <Text style={gridStyles.pricePillText}>{priceLabel}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.appBackgroundColor || '#f7f8fb' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        style={styles.scroll}
      >
        <View style={styles.hero}>
          <View style={styles.searchBar}>
            <FeatherIcon name="search" size={16} color="#8e97ad" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#a2a9bb"
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <FeatherIcon name="x" size={16} color="#8e97ad" />
              </Pressable>
            )}
          </View>

        </View>

        <View style={styles.body}>
          {loadingProducts ? (
            <Text style={[styles.loadingText, { color: theme.mutedForegroundColor }]}>Loading products…</Text>
          ) : !products.length ? (
            <Text style={[styles.loadingText, { color: theme.mutedForegroundColor }]}>No products found.</Text>
          ) : null}
          <View style={styles.searchBannerWrap}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const nextIndex = Math.round(e.nativeEvent.contentOffset.x / bannerWidth)
                setActiveBanner(nextIndex)
              }}
            >
              {banners.map((banner, index) => (
                <Pressable
                  key={index}
                  style={[styles.searchBannerSlide, { width: bannerWidth }]}
                  onPress={() => {
                    const first = (filtered.length ? filtered : products)[0]
                    if (first) navigation.navigate('Product', { product: first })
                  }}
                >
                  <Image
                    source={banner}
                    style={styles.searchBanner}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.bannerDots}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.bannerDot,
                    activeBanner === index ? styles.bannerDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>

          {topSellers.length > 0 ? (
            <View style={styles.productSection}>
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsTitleMontserrat, { color: theme.textColor }]}>Top sellers</Text>
              </View>
              <View style={gridStyles.grid}>{topSellers.map((item) => renderProductCard(item))}</View>
            </View>
          ) : null}

          {newArrivals.length > 0 ? (
            <View style={styles.productSection}>
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsTitleMontserrat, { color: theme.textColor }]}>New arrivals</Text>
              </View>
              <View style={gridStyles.grid}>{newArrivals.map((item) => renderProductCard(item))}</View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

function getProductGridStyles(theme: any) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      alignItems: 'stretch',
    },
    card: {
      flexDirection: 'column',
      alignSelf: 'stretch',
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderRadius: 18,
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: 4,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      overflow: 'hidden',
    },
    media: {
      position: 'relative',
      width: '100%',
      height: 250,
      paddingTop: 6,
      overflow: 'hidden',
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderRadius: 14,
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    mediaPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
    },
    mediaPlaceholderText: {
      color: theme.headingColor || theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    footerBand: {
      flexGrow: 1,
      minHeight: 1,
    },
    cardFooter: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 8,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginTop: 8,
    },
    itemTitle: {
      color: theme.headingColor || theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: -0.15,
    },
    pricePill: {
      backgroundColor: HOME_ACCENT_BG,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      flexShrink: 0,
    },
    pricePillText: {
      color: HOME_ACCENT_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 13,
      lineHeight: 16,
    },
  })
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    paddingBottom: 110,
  },
  scroll: {
    marginTop: 0,
  },
  hero: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  searchBar: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#2a3359',
    fontFamily: 'Geist-Medium',
    fontSize: 14,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    color: '#2b3559',
    fontFamily: 'Geist-SemiBold',
    fontSize: 22,
    marginBottom: 12,
  },
  searchBannerWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 22,
  },
  searchBannerSlide: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchBanner: {
    width: '100%',
    height: 170,
  },
  bannerDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,.55)',
  },
  bannerDotActive: {
    width: 16,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  productSection: {
    marginBottom: 22,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  /** Match home Popular chip typography */
  resultsTitleMontserrat: {
    color: '#2b3559',
    fontFamily: HOME_CHIP_MONTSERRAT,
    fontSize: 18,
    lineHeight: 22,
  },
  loadingText: {
    color: '#8b94aa',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
    marginBottom: 10,
  },
})
