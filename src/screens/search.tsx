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
import { listDbProducts, listShopifyCollectionsByIds, ShopifyCollectionSummary } from '../utils'
import { formatMoney } from '../money'

const GRID_GAP = 12

/** Match home.tsx price pills: lime fill + black label */
const HOME_ACCENT_BG = '#CBFF00'
const HOME_ACCENT_TEXT = '#000000'
/** Unselected home category chip fill (`chipPlainOuter`) */
const HOME_CHIP_FILL = '#000000'

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

/** Hide storefront utility collections from the Search collections grid. */
function isExcludedSearchCollection(c: ShopifyCollectionSummary): boolean {
  const hay = `${c.title || ''} ${c.handle || ''}`.toLowerCase().replace(/[-_]+/g, ' ')
  return /\ball products\b/.test(hay) || /\bnew releases?\b/.test(hay)
}

const banners = [
  require('../../public/homepageimgs/searchbanner.webp'),
  require('../../public/homepageimgs/searchbanner2.webp'),
  require('../../public/homepageimgs/searchbanner3.webp'),
]

const FEATURED_COLLECTION_IDS = [
  'gid://shopify/Collection/294309199985',
  'gid://shopify/Collection/287599689841',
  'gid://shopify/Collection/293150228593',
  'gid://shopify/Collection/294309298289',
  'gid://shopify/Collection/294309265521',
  'gid://shopify/Collection/290448900209',
  'gid://shopify/Collection/294309396593',
  'gid://shopify/Collection/291556622449',
  'gid://shopify/Collection/290058993777',
  'gid://shopify/Collection/288153862257',
  'gid://shopify/Collection/290535899249',
  'gid://shopify/Collection/299407343729',
  'gid://shopify/Collection/294309822577',
  'gid://shopify/Collection/289047216241',
  'gid://shopify/Collection/288797818993',
  'gid://shopify/Collection/291791536241',
  'gid://shopify/Collection/288153895025',
  'gid://shopify/Collection/294309494897',
  'gid://shopify/Collection/290676637809',
  'gid://shopify/Collection/294309462129',
  'gid://shopify/Collection/284024537201',
  'gid://shopify/Collection/285040246897',
  'gid://shopify/Collection/291451895921',
  'gid://shopify/Collection/294309593201',
  'gid://shopify/Collection/294309625969',
  'gid://shopify/Collection/288892616817',
  'gid://shopify/Collection/287199330417',
]
export function Search({ navigation }: { navigation: any }) {
  const [query, setQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [activeBanner, setActiveBanner] = useState(0)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const bannerScrollRef = useRef<ScrollView | null>(null)
  const { width } = useWindowDimensions()
  const bannerWidth = width - 32
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [collections, setCollections] = useState<ShopifyCollectionSummary[]>([])
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [showAllCollections, setShowAllCollections] = useState(false)
  const { theme } = useContext(ThemeContext)
  const bannerSlides = useMemo(() => [...banners, banners[0]], [])

  const productNameSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((item) => String(item.title || '').toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, products])
  const topSellers = useMemo(() => products.slice(0, 2), [products])
  const newArrivals = useMemo(() => products.slice(2, 4), [products])
  const cardW = (width - 32 - GRID_GAP) / 2
  const collectionCardW = (width - 32 - GRID_GAP) / 2
  const collectionsForGrid = useMemo(
    () => collections.filter((c) => !isExcludedSearchCollection(c)),
    [collections]
  )
  const visibleCollections = useMemo(
    () => (showAllCollections ? collectionsForGrid : collectionsForGrid.slice(0, 4)),
    [showAllCollections, collectionsForGrid]
  )
  const gridStyles = useMemo(() => getProductGridStyles(theme), [theme])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingCollections(true)
      try {
        const fetched = await listShopifyCollectionsByIds(FEATURED_COLLECTION_IDS)
        if (!cancelled) setCollections(fetched)
      } catch {
        if (!cancelled) setCollections([])
      } finally {
        if (!cancelled) setLoadingCollections(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      try {
        const fetched = await listDbProducts({ first: 24 })
        if (!cancelled) setProducts(fetched)
      } catch {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = prev + 1
        bannerScrollRef.current?.scrollTo({
          x: next * bannerWidth,
          animated: true,
        })
        if (next >= banners.length) {
          setActiveBanner(0)
        } else {
          setActiveBanner(next)
        }
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
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <FeatherIcon name="search" size={16} color="#8e97ad" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
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
            {isSearchFocused && query.trim().length > 0 ? (
              <View
                style={[
                  styles.searchDropdown,
                  {
                    backgroundColor: theme.secondaryBackgroundColor || theme.appBackgroundColor || '#1a1f2e',
                    borderColor: theme.tileBorderColor || theme.borderColor || '#2b3145',
                  },
                ]}
              >
                {productNameSuggestions.length ? (
                  productNameSuggestions.map((item) => (
                    <Pressable
                      key={`search-suggestion-${item.id || item.handle || item.title}`}
                      style={styles.searchDropdownRow}
                      onPress={() => {
                        setQuery(item.title)
                        navigation.navigate('Product', { product: item })
                      }}
                    >
                      <Text
                        style={[styles.searchDropdownText, { color: theme.headingColor || theme.textColor || '#ffffff' }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <FeatherIcon
                        name="arrow-up-right"
                        size={14}
                        color={theme.mutedForegroundColor || '#b3bdd8'}
                      />
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.searchDropdownEmptyRow}>
                    <Text style={[styles.searchDropdownEmptyText, { color: theme.mutedForegroundColor || '#b3bdd8' }]}>
                      No matching products
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
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
                if (nextIndex >= banners.length) {
                  setCarouselIndex(0)
                  setActiveBanner(0)
                  requestAnimationFrame(() => {
                    bannerScrollRef.current?.scrollTo({ x: 0, animated: false })
                  })
                  return
                }
                setCarouselIndex(nextIndex)
                setActiveBanner(nextIndex)
              }}
            >
              {bannerSlides.map((banner, index) => (
                <Pressable
                  key={index}
                  style={[styles.searchBannerSlide, { width: bannerWidth }]}
                  onPress={() => {
                    const first = products[0]
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

          <View style={styles.collectionsSection}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitleMontserrat, { color: theme.textColor }]}>Collections</Text>
              {collectionsForGrid.length > 4 ? (
                <Pressable onPress={() => setShowAllCollections((prev) => !prev)} hitSlop={8}>
                  <Text style={[styles.seeAllButtonText, { color: theme.textColor }]}>
                    {showAllCollections ? 'See less' : 'See all'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {loadingCollections ? (
              <Text style={[styles.loadingText, { color: theme.mutedForegroundColor }]}>Loading collections…</Text>
            ) : (
              <View style={styles.collectionsGrid}>
                {visibleCollections.map((collection) => (
                  <Pressable
                    key={collection.id}
                    style={({ pressed }) => [
                      styles.collectionCard,
                      { width: collectionCardW, opacity: pressed ? 0.92 : 1 },
                    ]}
                    onPress={() =>
                      navigation.navigate('CategoryProducts', {
                        slug: collection.handle,
                        title: collection.title,
                      })
                    }
                  >
                    <Text style={styles.collectionTitle} numberOfLines={2}>
                      {collection.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
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
    zIndex: 20,
  },
  searchWrap: {
    position: 'relative',
    zIndex: 30,
  },
  searchBar: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 0,
  },
  searchDropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 60,
    backgroundColor: '#11131b',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 200,
    elevation: 10,
  },
  searchDropdownRow: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(194, 206, 238, 0.15)',
  },
  searchDropdownText: {
    flex: 1,
    marginRight: 10,
    color: '#f1f4ff',
    fontFamily: 'Geist-Medium',
    fontSize: 14,
  },
  searchDropdownEmptyRow: {
    minHeight: 46,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  searchDropdownEmptyText: {
    color: '#b3bdd8',
    fontFamily: 'Geist-Medium',
    fontSize: 13,
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
  collectionsSection: {
    marginBottom: 18,
  },
  collectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  /** Match home unselected `HomeCategoryChip` (`chipPlainOuter` + `chipText`) */
  collectionCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: HOME_ACCENT_BG,
    backgroundColor: HOME_CHIP_FILL,
    paddingHorizontal: 6,
    paddingVertical: 12,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  collectionTitle: {
    color: HOME_ACCENT_BG,
    fontFamily: HOME_CHIP_MONTSERRAT,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  seeAllButtonText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
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
