import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
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
import { ProductTileImageWithHeart, WonderportAccentCard } from '../components'
import { ThemeContext } from '../context'
import {
  getDailyRewardStatus,
  listDbCategories,
  listDbProducts,
  readDailyRewardsCache,
  type DbCategorySummary,
} from '../utils'
import { shouldShowDailyRewardsHomeAlert } from '../wonderBadgeNotifications'
import { ShopifyProduct } from '../../types'
import { formatMoney } from '../money'

/** Home row chips — each maps to DB-backed lists (see load effect). */
const HOME_CHIPS = ['New', 'Pops', 'Plushies', 'Brands'] as const

/** If no collection title matches, search title/type/vendor/tags via API `q`. */
const CHIP_SEARCH_FALLBACK: Record<string, string> = {
  Pops: 'pop',
  Plushies: 'plush',
}

const COLLECTION_MATCHERS: Record<string, (c: DbCategorySummary) => boolean> = {
  Pops: (c) => /pop|funko|vinyl/i.test(`${c.handle} ${c.title}`),
  Plushies: (c) => /plush|plushie|stuffed|soft toy|cuddle/i.test(`${c.handle} ${c.title}`),
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

const GRID_GAP = 12

/** Category chips: accent border + text on black fill; price pill uses equipped accent + black label */
const HOME_CHIP_FILL = '#000000'
const HOME_ACCENT_TEXT = '#000000'

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
  const styles = getStyles(theme)
  const heroGreeting = useMemo(() => 'Wonderport', [])
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
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

  useEffect(() => {
    if (activeCategory === 'Brands') {
      setLoadingProducts(false)
      setProducts([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      try {
        let fetched: ShopifyProduct[] = []
        if (activeCategory === 'New') {
          fetched = await listDbProducts({ first: 12, sort: 'new' })
        } else {
          const slug = matchCollectionHandle(activeCategory, dbCategories)
          if (slug) {
            fetched = await listDbProducts({ first: 12, collection: slug })
          }
          if (!fetched.length) {
            const q = CHIP_SEARCH_FALLBACK[activeCategory]
            if (q) fetched = await listDbProducts({ first: 12, query: q })
          }
        }
        if (!cancelled) setProducts(fetched)
      } catch (e) {
        if (!cancelled) console.log('[Home] DB products load failed', e)
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeCategory, dbCategories])

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
                onPress={() =>
                  navigation.navigate('DailyRewards', { sessionToken: sessionToken || '' })
                }
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
                return (
                  <Pressable
                    key={String(c.shopifyId || c.handle)}
                    style={({ pressed }) => [styles.brandCard, pressed && styles.brandCardPressed]}
                    onPress={() =>
                      navigation.navigate('CategoryProducts', {
                        slug: c.handle,
                        title: c.title,
                      })
                    }
                  >
                    <WonderportAccentCard
                      borderWidth={2}
                      borderRadius={18}
                      innerBackgroundColor="#0a0a0c"
                      style={styles.brandAccentOuter}
                      contentStyle={styles.brandAccentInner}
                    >
                      <View style={styles.brandBannerClip}>
                        <Image
                          source={{ uri: String(c.imageUrl).trim() }}
                          style={styles.brandBannerImage}
                          resizeMode="cover"
                        />
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
                const priceLabel =
                  item.price?.amount != null && item.price.amount !== ''
                    ? formatMoney(item.price)
                    : 'View details'
                const savePayload = productToSavePayload(item)
                return (
                  <View key={item.id || item.handle || item.title} style={[styles.card, { width: cardW }]}>
                    {src ? (
                      <ProductTileImageWithHeart
                        product={savePayload}
                        source={src}
                        resizeMode="cover"
                        imageTranslateY={0}
                        wrapStyle={styles.media}
                        imageStyle={styles.mediaImage}
                        onPress={() => navigation.navigate('Product', { product: item })}
                      />
                    ) : (
                      <Pressable
                        style={styles.media}
                        onPress={() => navigation.navigate('Product', { product: item })}
                      >
                        <View style={styles.mediaPlaceholder}>
                          <Text
                            style={styles.mediaPlaceholderText}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {item.title}
                          </Text>
                        </View>
                      </Pressable>
                    )}
                    <View style={styles.footerBand}>
                      <Pressable
                        style={styles.cardFooter}
                        onPress={() => navigation.navigate('Product', { product: item })}
                      >
                        <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
                          {item.title}
                        </Text>
                        <View style={styles.priceRow}>
                          <View style={styles.pricePill}>
                            <Text style={styles.pricePillText}>{priceLabel}</Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
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
    },
    chipPressable: {
      flex: 1,
      minWidth: 0,
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
      backgroundColor: HOME_CHIP_FILL,
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
      backgroundColor: theme.brandAccent,
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
    loadingText: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      marginBottom: 10,
    },
    brandsList: {
      gap: 14,
      marginTop: 10,
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
      backgroundColor: '#141418',
    },
    brandBannerImage: {
      ...StyleSheet.absoluteFillObject,
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
      color: HOME_ACCENT_TEXT,
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
}: {
  label: string
  selected: boolean
  onPress: () => void
  styles: HomeStyles
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
            innerBackgroundColor={HOME_CHIP_FILL}
            animatedBorder
            style={styles.chipCardOuter}
            contentStyle={styles.chipCardInner}
          >
            <Text style={styles.chipText}>{label}</Text>
          </WonderportAccentCard>
        ) : (
          <View style={styles.chipPlainOuter}>
            <View style={styles.chipCardInner}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}
