import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ProductGridTile, productGridPriceLabel, WonderportAccentCard } from '../components'
import { AppContext, ThemeContext } from '../context'
import {
  getDailyRewardStatus,
  listDbCategories,
  listDbProducts,
  readDailyRewardsCache,
  type DbCategorySummary,
} from '../utils'
import { shouldShowDailyRewardsHomeAlert } from '../wonderBadgeNotifications'
import { ShopifyProduct } from '../../types'
import { shopifyProductToSavePayload } from '../productSave'
import { navigateOnRootStack } from '../rootNavigation'

/** Home row chips — each maps to DB-backed lists (see load effect). */
const HOME_CHIPS = ['New', 'Pops', 'Plushie', 'Brands'] as const

/** If no collection title matches, search title/type/vendor/tags via API `q`. */
const CHIP_SEARCH_FALLBACK: Record<string, string> = {
  Pops: 'pop',
  Plushie: 'plush',
}

const COLLECTION_MATCHERS: Record<string, (c: DbCategorySummary) => boolean> = {
  Pops: (c) => /pop|funko|vinyl/i.test(`${c.handle} ${c.title}`),
  Plushie: (c) => /plush|plushie|stuffed|soft toy|cuddle/i.test(`${c.handle} ${c.title}`),
}

function matchCollectionHandle(chip: string, categories: DbCategorySummary[]): string | undefined {
  const match = COLLECTION_MATCHERS[chip]
  if (!match || !categories.length) return undefined
  for (const c of categories) {
    if (match(c)) return c.handle
  }
  return undefined
}

/** Hide utility Shopify collections from the Brands carousel (matched on title + handle). */
function isExcludedBrandCollection(c: DbCategorySummary): boolean {
  const hay = `${c.title} ${c.handle}`.toLowerCase().replace(/[-_]+/g, ' ')
  return (
    /\ball products\b/.test(hay) ||
    /\bout of stock\b/.test(hay) ||
    /\bnew releases?\b/.test(hay)
  )
}

function hasBrandBannerImage(c: DbCategorySummary): boolean {
  return String(c.imageUrl || '').trim().length > 0
}

function brandHaystack(c: DbCategorySummary): string {
  return `${c.title || ''} ${c.handle || ''}`.toLowerCase().replace(/[-_]+/g, ' ')
}

function shouldUseBlackBrandBackground(c: DbCategorySummary): boolean {
  const hay = brandHaystack(c)
  return /\bhey\s*one\b/.test(hay) || /\bheyone\b/.test(hay)
}

type BrandBannerImageLayout =
  | { mode: 'cover' }
  | { mode: 'contain'; inset: number }
  /** Full banner: `contain` scales to height/width without cropping top or bottom. */
  | { mode: 'containFit' }

/** Handle-first so sizing always applies (matches `/categories` slugs). */
function getBrandBannerImageLayout(c: DbCategorySummary): BrandBannerImageLayout {
  const handle = String(c.handle || '').trim().toLowerCase()

  if (handle === 'lucky-emma') {
    return { mode: 'containFit' }
  }
  if (handle === 'cureplaneta') {
    return { mode: 'cover' }
  }
  if (handle === 'pop-mart') {
    return { mode: 'contain', inset: 14 }
  }

  return { mode: 'cover' }
}

/** Kept for hot-reload / older call sites — use `getBrandBannerImageLayout` in new code. */
function getBrandLogoInset(c: DbCategorySummary): number | null {
  const layout = getBrandBannerImageLayout(c)
  return layout.mode === 'contain' ? layout.inset : null
}

function getImageSource(item: ShopifyProduct): ImageSourcePropType | undefined {
  if (item?.featuredImageUrl) return { uri: item.featuredImageUrl }
  return (item as { image?: ImageSourcePropType }).image
}


const GRID_GAP = 12
const HOME_PRODUCTS_INITIAL = 12
const HOME_PRODUCTS_PAGE_SIZE = 20

/** Price pill label on accent-filled badges. */
const HOME_ACCENT_ON_BADGE_TEXT = '#ffffff'

/** Montserrat — registered in App.tsx `useFonts` */
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const
/** Heavier weight for category chips only */
const HOME_CHIP_MONTSERRAT = 'Montserrat_800ExtraBold' as const

/** Bell — disabled until notifications are wired; modal code removed to avoid bundler init issues. */
const SHOW_HOME_NOTIFICATIONS = false

export function Home({ navigation, sessionToken }: { navigation: any; sessionToken?: string }) {
  const { width } = useWindowDimensions()
  const cardW = (width - 32 - GRID_GAP) / 2
  const { theme } = useContext(ThemeContext)
  const { showHomeCartBadge, markCartViewed } = useContext(AppContext)
  const styles = getStyles(theme)
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const heroGreeting = useMemo(() => 'Wonderport', [])
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false)
  const [hasMoreProducts, setHasMoreProducts] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>(HOME_CHIPS[0])
  const [dbCategories, setDbCategories] = useState<DbCategorySummary[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [showDailyRewardsAlert, setShowDailyRewardsAlert] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCategoriesLoading(true)
    listDbCategories()
      .then((rows) => {
        if (!cancelled) setDbCategories(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setDbCategories([])
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const brandsSorted = useMemo(() => {
    return [...dbCategories]
      .filter((c) => !isExcludedBrandCollection(c) && hasBrandBannerImage(c))
      .sort((a, b) => {
        const pc = (b.productCount || 0) - (a.productCount || 0)
        if (pc !== 0) return pc
        return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
          sensitivity: 'base',
        })
      })
  }, [dbCategories])

  const fetchProductsPage = useCallback(
    async (offset: number, pageSize: number): Promise<ShopifyProduct[]> => {
      const homeFeed = { first: pageSize, offset, inStockOnly: true as const }
      if (activeCategory === 'New') {
        return listDbProducts({ ...homeFeed, sort: 'new' })
      }
      const slug = matchCollectionHandle(activeCategory, dbCategories)
      if (slug) {
        const rows = await listDbProducts({ ...homeFeed, collection: slug })
        if (rows.length) return rows
      }
      const q = CHIP_SEARCH_FALLBACK[activeCategory]
      if (q) return listDbProducts({ ...homeFeed, query: q })
      return []
    },
    [activeCategory, dbCategories],
  )

  useEffect(() => {
    if (activeCategory === 'Brands') {
      setLoadingProducts(false)
      setLoadingMoreProducts(false)
      setHasMoreProducts(false)
      setProducts([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      setHasMoreProducts(false)
      try {
        const fetched = await fetchProductsPage(0, HOME_PRODUCTS_INITIAL)
        if (!cancelled) {
          setProducts(fetched)
          setHasMoreProducts(fetched.length >= HOME_PRODUCTS_INITIAL)
        }
      } catch (e) {
        if (!cancelled) console.log('[Home] DB products load failed', e)
        if (!cancelled) {
          setProducts([])
          setHasMoreProducts(false)
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeCategory, dbCategories, fetchProductsPage])

  const loadMoreProducts = useCallback(async () => {
    if (loadingProducts || loadingMoreProducts || !hasMoreProducts) return
    setLoadingMoreProducts(true)
    try {
      const offset = products.length
      const fetched = await fetchProductsPage(offset, HOME_PRODUCTS_PAGE_SIZE)
      setProducts(prev => {
        const seen = new Set(prev.map(p => String(p.id || p.handle || '')))
        const merged = [...prev]
        for (const item of fetched) {
          const key = String(item.id || item.handle || '')
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push(item)
        }
        return merged
      })
      setHasMoreProducts(fetched.length >= HOME_PRODUCTS_PAGE_SIZE)
    } catch (e) {
      console.log('[Home] load more products failed', e)
    } finally {
      setLoadingMoreProducts(false)
    }
  }, [
    fetchProductsPage,
    hasMoreProducts,
    loadingMoreProducts,
    loadingProducts,
    products.length,
  ])

  const refreshDailyRewardsAlert = useCallback(async () => {
    if (!sessionToken) {
      setShowDailyRewardsAlert(false)
      return
    }
    try {
      const cached = await readDailyRewardsCache()
      if (cached) {
        setShowDailyRewardsAlert(await shouldShowDailyRewardsHomeAlert(cached))
      }
    } catch {
      /* ignore */
    }
    try {
      const status = await getDailyRewardStatus(sessionToken)
      setShowDailyRewardsAlert(await shouldShowDailyRewardsHomeAlert(status))
    } catch {
      /* keep last known alert state */
    }
  }, [sessionToken])

  useFocusEffect(
    useCallback(() => {
      void refreshDailyRewardsAlert()
    }, [refreshDailyRewardsAlert]),
  )

  const openCart = useCallback(() => {
    markCartViewed()
    navigateOnRootStack(navigation, 'Cart')
  }, [markCartViewed, navigation])

  const openBrandCollection = useCallback(
    (collection: DbCategorySummary) => {
      const slug = String(collection.handle || '').trim()
      if (!slug) return
      navigateOnRootStack(navigation, 'CategoryProducts', {
        slug,
        title: collection.title,
        headerLabel: collection.title,
      })
    },
    [navigation],
  )

  const refreshCategories = useCallback(() => {
    listDbCategories()
      .then((rows) => setDbCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setDbCategories([]))
  }, [])

  useEffect(() => {
    if (activeCategory !== 'Brands') return
    refreshCategories()
  }, [activeCategory, refreshCategories])

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{heroGreeting}</Text>
          <View style={styles.headerActions}>
            {SHOW_HOME_NOTIFICATIONS ? (
              <View style={[styles.iconBadgeWrap, styles.bellButtonOffset]}>
                <TouchableOpacity style={styles.bellButton} activeOpacity={0.85}>
                  <FeatherIcon name="bell" size={24} color={theme.textColor} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.iconBadgeWrap}>
              <TouchableOpacity
                style={styles.bellButton}
                activeOpacity={0.85}
                onPress={openCart}
                accessibilityRole="button"
                accessibilityLabel="Open shopping cart"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FeatherIcon name="shopping-bag" size={24} color="#000000" />
              </TouchableOpacity>
              {showHomeCartBadge ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>!</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.iconBadgeWrap}>
              <TouchableOpacity
                style={styles.bellButton}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('DailyRewards', { sessionToken: sessionToken || '' })
                }
                accessibilityRole="button"
                accessibilityLabel="Daily rewards"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FeatherIcon name="gift" size={26} color={theme.textColor} />
              </TouchableOpacity>
              {showDailyRewardsAlert ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>!</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {HOME_CHIPS.map((item) => (
            <HomeCategoryChip
              key={item}
              label={item}
              selected={activeCategory === item}
              onPress={() => setActiveCategory(item)}
              styles={styles}
              frameFill={frameFill}
            />
          ))}
        </View>

        {activeCategory === 'Brands' ? (
          categoriesLoading ? (
            <Text style={styles.loadingText}>Loading collections…</Text>
          ) : !brandsSorted.length ? (
            <Text style={styles.loadingText}>No collections with banner images yet.</Text>
          ) : (
            <View style={styles.brandsList}>
              {brandsSorted.map((c) => {
                const count = Math.max(0, Math.floor(Number(c.productCount) || 0))
                const countLabel = count === 1 ? '1 product' : `${count} products`
                const blackLogoBg = shouldUseBlackBrandBackground(c)
                const bannerImage = getBrandBannerImageLayout(c)
                return (
                  <Pressable
                    key={String(c.shopifyId || c.handle)}
                    style={({ pressed }) => [styles.brandCard, pressed && styles.brandCardPressed]}
                    onPress={() => openBrandCollection(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${c.title} brand`}
                  >
                    <View pointerEvents="none">
                    <WonderportAccentCard
                      borderVariant="solid"
                      borderWidth={2}
                      borderRadius={18}
                      innerBackgroundColor={frameFill}
                      style={styles.brandAccentOuter}
                      contentStyle={styles.brandAccentInner}
                    >
                      <View style={[styles.brandBannerClip, blackLogoBg ? styles.brandBannerClipBlack : null]}>
                        {bannerImage.mode === 'contain' ? (
                          <View
                            style={[
                              styles.brandLogoInsetSlot,
                              {
                                top: bannerImage.inset,
                                left: bannerImage.inset,
                                right: bannerImage.inset,
                                bottom: bannerImage.inset,
                              },
                            ]}
                          >
                            <Image
                              source={{ uri: String(c.imageUrl).trim() }}
                              style={styles.brandLogoInsetImage}
                              resizeMode="contain"
                            />
                          </View>
                        ) : bannerImage.mode === 'containFit' ? (
                          <View style={styles.brandLogoContainFitSlot}>
                            <Image
                              source={{ uri: String(c.imageUrl).trim() }}
                              style={styles.brandLogoContainFitImage}
                              resizeMode="contain"
                            />
                          </View>
                        ) : (
                          <Image
                            source={{ uri: String(c.imageUrl).trim() }}
                            style={styles.brandBannerImage}
                            resizeMode="cover"
                          />
                        )}
                        <LinearGradient
                          pointerEvents="none"
                          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
                          locations={[0, 0.45, 1]}
                          style={styles.brandBannerGradient}
                        />
                        <View style={styles.brandBannerMeta} pointerEvents="none">
                          <View style={styles.brandTitleBlock}>
                            <Text style={styles.brandTitle} numberOfLines={2}>
                              {c.title}
                            </Text>
                            <View style={styles.brandCountPill}>
                              <Text style={styles.brandCountText}>{countLabel}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </WonderportAccentCard>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )
        ) : (
          <>
            {loadingProducts ? (
              <Text style={styles.loadingText}>Loading products…</Text>
            ) : !products.length ? (
              <Text style={styles.loadingText}>No products found.</Text>
            ) : null}

            <View style={styles.grid}>
              {products.map((item) => {
                const src = getImageSource(item)
                const priceLabel = productGridPriceLabel(item.price)
                const savePayload = shopifyProductToSavePayload(item)
                return (
                  <ProductGridTile
                    key={item.id || item.handle || item.title}
                    theme={theme}
                    cardWidth={cardW}
                    frameFill={frameFill}
                    title={item.title}
                    priceLabel={priceLabel}
                    savePayload={savePayload}
                    imageSource={src}
                    onPress={() => navigation.navigate('Product', { product: item })}
                  />
                )
              })}
            </View>

            {hasMoreProducts && products.length > 0 ? (
              <TouchableOpacity
                style={[styles.seeMoreButton, loadingMoreProducts && styles.seeMoreButtonDisabled]}
                onPress={() => void loadMoreProducts()}
                disabled={loadingMoreProducts || loadingProducts}
                activeOpacity={0.88}
              >
                {loadingMoreProducts ? (
                  <ActivityIndicator color={theme.brandAccent} />
                ) : (
                  <Text style={styles.seeMoreText}>See more</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 140,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBadgeWrap: {
      position: 'relative',
    },
    bellButtonOffset: {
      marginTop: 2,
    },
    bellButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    alertBadge: {
      position: 'absolute',
      right: -3,
      top: -3,
      minWidth: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#e32828',
      borderWidth: 1,
      borderColor: theme.tileBackgroundColor || '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    alertBadgeText: {
      color: '#ffffff',
      fontFamily: theme.boldFont,
      fontSize: 9,
      lineHeight: 10,
      marginTop: -0.2,
    },
    title: {
      color: theme.headingColor || theme.textColor,
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 36,
      lineHeight: 40,
      width: '78%',
    },
    chipsRow: {
      width: '100%',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      alignItems: 'stretch',
      zIndex: 2,
    },
    chipPressable: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
    },
    chipCardOuter: {
      width: '100%',
    },
    chipAnimWrap: {
      width: '100%',
    },
    chipPlainOuter: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      backgroundColor: theme.frameInnerBackgroundColor || theme.tileBackgroundColor,
      overflow: 'hidden',
    },
    chipCardInner: {
      paddingHorizontal: 6,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      color: theme.brandAccent,
      fontFamily: HOME_CHIP_MONTSERRAT,
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
      textTransform: 'uppercase',
      width: '100%',
    },
    chipTextInactive: {
      color: theme.headingColor || theme.textColor,
      fontFamily: HOME_CHIP_MONTSERRAT,
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
      textTransform: 'uppercase',
      width: '100%',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      alignItems: 'stretch',
    },
    seeMoreButton: {
      alignSelf: 'center',
      marginTop: 20,
      marginBottom: 8,
      minWidth: 160,
      minHeight: 44,
      paddingHorizontal: 28,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.brandAccent,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    },
    seeMoreButtonDisabled: {
      opacity: 0.65,
    },
    seeMoreText: {
      color: theme.brandAccent,
      fontFamily: theme.boldFont,
      fontSize: 15,
    },
    loadingText: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      marginBottom: 10,
    },
    brandsList: {
      gap: 14,
      marginTop: 10,
      zIndex: 1,
    },
    brandCard: {
      width: '100%',
    },
    brandCardPressed: {
      opacity: 0.92,
    },
    brandAccentOuter: {
      width: '100%',
    },
    brandAccentInner: {
      padding: 0,
      overflow: 'hidden',
    },
    brandBannerClip: {
      width: '100%',
      height: 156,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#ffffff',
    },
    brandBannerClipBlack: {
      backgroundColor: '#000000',
    },
    brandBannerImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    brandLogoInsetSlot: {
      position: 'absolute',
    },
    brandLogoInsetImage: {
      width: '100%',
      height: '100%',
    },
    brandLogoContainFitSlot: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    brandLogoContainFitImage: {
      width: '100%',
      height: '100%',
    },
    brandBannerGradient: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    brandBannerMeta: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 28,
    },
    brandTitleBlock: {
      flex: 1,
    },
    brandTitle: {
      color: '#ffffff',
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.3,
      textShadowColor: 'rgba(0,0,0,0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    brandCountPill: {
      alignSelf: 'flex-start',
      marginTop: 8,
      backgroundColor: theme.brandAccent,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
    },
    brandCountText: {
      color: HOME_ACCENT_ON_BADGE_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 12,
      letterSpacing: 0.2,
    },
  })

type HomeStyles = ReturnType<typeof getStyles>

function HomeCategoryChip({
  label,
  selected,
  onPress,
  styles,
  frameFill,
}: {
  label: string
  selected: boolean
  onPress: () => void
  styles: HomeStyles
  frameFill: string
}) {
  const scale = useSharedValue(1)
  const prevSelected = useRef(selected)

  useEffect(() => {
    if (selected && !prevSelected.current) {
      scale.value = withSequence(
        withSpring(1.07, { damping: 13, stiffness: 380 }),
        withSpring(1, { damping: 15, stiffness: 260 }),
      )
    } else if (!selected && prevSelected.current) {
      scale.value = withSequence(
        withSpring(0.98, { damping: 16, stiffness: 320 }),
        withSpring(1, { damping: 18, stiffness: 280 }),
      )
    }
    prevSelected.current = selected
  }, [selected, scale])

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      style={({ pressed }) => [styles.chipPressable, { opacity: pressed ? 0.9 : 1 }]}
      onPress={onPress}
    >
      <Animated.View style={[styles.chipAnimWrap, popStyle]}>
        {selected ? (
          <WonderportAccentCard
            borderWidth={3}
            borderRadius={16}
            innerBackgroundColor={frameFill}
            animatedBorder
            style={styles.chipCardOuter}
            contentStyle={styles.chipCardInner}
          >
            <Text style={styles.chipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
          </WonderportAccentCard>
        ) : (
          <View style={styles.chipPlainOuter}>
            <View style={styles.chipCardInner}>
              <Text style={styles.chipTextInactive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {label}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}
