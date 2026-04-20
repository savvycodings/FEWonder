import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { NotificationsModal, ProductTileImageWithHeart } from '../components'
import { ThemeContext } from '../context'
import { getDailyRewardStatus, listDbProducts, readDailyRewardsCache } from '../utils'
import { ShopifyProduct } from '../../types'
import { formatMoney } from '../money'

const categories = ['Popular', 'Pops', 'Figures', 'Anime']

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

export function Home({ navigation, sessionToken }: { navigation: any; sessionToken?: string }) {
  const { width } = useWindowDimensions()
  const cardW = (width - 32 - GRID_GAP) / 2
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const heroGreeting = useMemo(() => 'Wonderport', [])
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [activeCategory, setActiveCategory] = useState(categories[0])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [hasUnclaimedReward, setHasUnclaimedReward] = useState(false)
  const lastRewardsPrefetchAt = useRef(0)

  const hasNewNotifications = true

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fetched = await listDbProducts({ first: 12 })
        if (!cancelled && fetched.length) setProducts(fetched)
      } catch (e) {
        if (!cancelled) console.log('[Home] DB products load failed', e)
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    readDailyRewardsCache().then((c) => {
      if (!cancelled && c?.canClaim) setHasUnclaimedReward(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sessionToken) return
    const now = Date.now()
    if (now - lastRewardsPrefetchAt.current < 45_000) return
    lastRewardsPrefetchAt.current = now
    getDailyRewardStatus(sessionToken)
      .then((s) => {
        setHasUnclaimedReward(Boolean(s?.canClaim))
      })
      .catch(() => {
        /* warm cache only */
      })
  }, [sessionToken])

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
            <View style={[styles.iconBadgeWrap, styles.bellButtonOffset]}>
              <TouchableOpacity
                style={styles.bellButton}
                activeOpacity={0.85}
                onPress={() => setNotificationsOpen(true)}
              >
                <FeatherIcon name="bell" size={24} color={theme.textColor} />
              </TouchableOpacity>
              {hasNewNotifications ? (
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
              >
                <FeatherIcon name="gift" size={26} color={theme.textColor} />
              </TouchableOpacity>
              {hasUnclaimedReward ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>!</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categories.map((item) => (
            <Pressable
              key={item}
              style={[styles.chip, activeCategory === item ? styles.chipActive : null]}
              onPress={() => setActiveCategory(item)}
            >
              <Text style={[styles.chipText, activeCategory === item ? styles.chipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Items</Text>
          <Text style={styles.sectionHint}>See all</Text>
        </View>

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
                      <Text style={styles.mediaPlaceholderText} numberOfLines={2}>
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
                    <View style={styles.titleCell}>
                      <Text style={styles.itemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                    <View style={styles.priceCell}>
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
      </ScrollView>

      <NotificationsModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        navigation={navigation}
        sessionToken={sessionToken || ''}
      />
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
      fontFamily: theme.boldFont,
      fontSize: 36,
      lineHeight: 40,
      width: '78%',
    },
    chipsRow: {
      width: '100%',
      gap: 8,
      marginBottom: 12,
      justifyContent: 'space-between',
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 2,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    chipActive: {
      backgroundColor: theme.tileActiveBackgroundColor || theme.tintColor,
    },
    chipText: {
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      fontSize: 13,
    },
    chipTextActive: {
      color: theme.tileActiveTextColor || theme.tintTextColor,
    },
    sectionHeaderRow: {
      marginBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 18,
    },
    sectionHint: {
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    card: {
      flexDirection: 'column',
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
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      textAlign: 'center',
    },
    footerBand: {
      minHeight: 56,
      justifyContent: 'center',
      paddingVertical: 4,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 0,
    },
    titleCell: {
      flex: 1,
      justifyContent: 'center',
      paddingRight: 4,
    },
    priceCell: {
      justifyContent: 'center',
    },
    itemTitle: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      lineHeight: 18,
    },
    pricePill: {
      backgroundColor: theme.priceBadgeBackgroundColor || theme.tileActiveBackgroundColor || '#111',
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      flexShrink: 0,
    },
    pricePillText: {
      color: theme.priceBadgeTextColor || theme.tileActiveTextColor || '#fff',
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
  })
