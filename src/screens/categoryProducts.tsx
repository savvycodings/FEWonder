import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Feather as FeatherIcon } from '@expo/vector-icons'
import { ProductTileImageWithHeart, WonderportAccentCard } from '../components'
import { brandIpSelectionLabel, shouldShowBrandIpHub } from '../brandIpCatalog'
import { resolveFeaturedBrandIps } from '../brandIpResolve'
import {
  countProductsByIp,
  filterProductsByIp,
  ipHubTilePreviewUri,
} from '../brandIpFilter'
import { ThemeContext } from '../context'
import { ShopifyProduct } from '../../types'
import { formatMoney } from '../money'
import { getDbCategoryBySlug, listDbProducts } from '../utils'

const GRID_GAP = 12
const IP_GRID_GAP = 10
const PAGE_SIZE = 20

export function CategoryProducts({ route, navigation }: { route: any; navigation: any }) {
  const slug = String(route?.params?.slug || '').trim()
  const catalogSearchQuery = String(route?.params?.searchQuery || '').trim()
  const fallbackTitle = String(route?.params?.title || '').trim()
  const headerLabel = String(route?.params?.headerLabel || '').trim()
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState(fallbackTitle || 'Category')
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { width } = useWindowDimensions()
  const { theme } = useContext(ThemeContext)
  const cardW = (width - 32 - GRID_GAP) / 2
  const ipCardW = (width - 32 - IP_GRID_GAP) / 2

  const brandIps = useMemo(() => resolveFeaturedBrandIps(slug, products), [slug, products])
  const ipHubEnabled = shouldShowBrandIpHub(slug, catalogSearchQuery)

  useEffect(() => {
    setSelectedIp(null)
    setQuery('')
    setVisibleCount(PAGE_SIZE)
  }, [slug, catalogSearchQuery])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedIp, query])

  const ipScopedProducts = useMemo(() => {
    if (!selectedIp) return products
    return filterProductsByIp(products, selectedIp, slug)
  }, [products, selectedIp, slug])

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ipScopedProducts
    return ipScopedProducts.filter(
      (item) =>
        item &&
        (String(item.title || '').toLowerCase().includes(q) ||
          String(item.productType || '').toLowerCase().includes(q) ||
          String(item.vendor || '').toLowerCase().includes(q) ||
          (Array.isArray(item.tags) &&
            item.tags.some((tag) => String(tag || '').toLowerCase().includes(q))))
    )
  }, [ipScopedProducts, query])

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  )

  const hasMore = filteredProducts.length > visibleCount

  const ipHubTiles = useMemo(() => {
    if (!brandIps?.length) return []
    const usedPreviewUris = new Set<string>()
    return brandIps.map((ip) => {
      const previewUri = ipHubTilePreviewUri(products, ip, slug, usedPreviewUris)
      if (previewUri) usedPreviewUris.add(previewUri)
      return {
        key: ip,
        label: ip,
        count: countProductsByIp(products, ip, slug),
        previewUri,
      }
    })
  }, [brandIps, products, slug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (catalogSearchQuery) {
          const fetched = await listDbProducts({ first: 50, query: catalogSearchQuery })
          if (!cancelled) {
            setTitle(fallbackTitle || 'Products')
            setProducts(fetched)
          }
          return
        }
        if (!slug) {
          if (!cancelled) {
            setTitle(fallbackTitle || 'Category')
            setProducts([])
          }
          return
        }
        const data = await getDbCategoryBySlug(slug)
        if (!cancelled) {
          setTitle(data.category?.title || fallbackTitle || 'Category')
          setProducts(Array.isArray(data.products) ? data.products : [])
        }
      } catch {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, catalogSearchQuery, fallbackTitle])

  const screenTitle = useMemo(() => {
    if (headerLabel && !selectedIp) return headerLabel
    if (selectedIp) return brandIpSelectionLabel(selectedIp)
    return title
  }, [headerLabel, selectedIp, title])

  const selectionLabel = selectedIp ? brandIpSelectionLabel(selectedIp) : title

  useEffect(() => {
    navigation.setOptions?.({ title: screenTitle })
  }, [navigation, screenTitle])

  useEffect(() => {
    if (!selectedIp) return
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void }) => {
      e.preventDefault()
      setSelectedIp(null)
      setQuery('')
    })
    return unsub
  }, [navigation, selectedIp])

  const clearIpFilter = useCallback(() => {
    setSelectedIp(null)
    setQuery('')
  }, [])

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + PAGE_SIZE)
  }, [])

  const styles = useMemo(() => getStyles(theme), [theme])
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'

  const renderSearchBar = () => (
    <WonderportAccentCard
      borderVariant="solid"
      borderWidth={2}
      borderRadius={12}
      innerBackgroundColor={frameFill}
      style={styles.searchCard}
    >
      <View style={styles.searchBar}>
        <FeatherIcon name="search" size={16} color={theme.mutedForegroundColor} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            selectedIp
              ? `Search in ${selectionLabel}`
              : title
                ? `Search in ${title}`
                : 'Search this collection'
          }
          placeholderTextColor={theme.placeholderTextColor}
          style={[styles.searchInput, { color: theme.textColor }]}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <FeatherIcon name="x" size={16} color={theme.mutedForegroundColor} />
          </Pressable>
        ) : null}
      </View>
    </WonderportAccentCard>
  )

  const renderProductGrid = () => (
    <>
      {loading ? (
        <Text style={[styles.metaText, { color: theme.mutedForegroundColor }]}>Loading…</Text>
      ) : null}
      {!loading && !filteredProducts.length ? (
        <Text style={[styles.metaText, { color: theme.mutedForegroundColor }]}>
          {query.trim()
            ? `No products match “${query.trim()}”.`
            : selectedIp
              ? `No ${selectionLabel} in this collection yet.`
              : catalogSearchQuery
                ? `No products found for “${catalogSearchQuery}”.`
                : 'No products in this collection.'}
        </Text>
      ) : null}
      {!loading && selectedIp && !filteredProducts.length && !query.trim() ? (
        <Pressable onPress={clearIpFilter} style={styles.clearIpButton}>
          <Text style={[styles.clearIpButtonText, { color: theme.brandAccent }]}>View all characters</Text>
        </Pressable>
      ) : null}
      <View style={styles.grid}>
        {displayedProducts.map((item) => {
          if (!item) return null
          const imageSource = item.featuredImageUrl ? { uri: item.featuredImageUrl } : undefined
          const priceLabel =
            item.price?.amount != null && item.price.amount !== ''
              ? formatMoney(item.price)
              : 'View details'
          return (
            <View key={item.id || item.handle || item.title} style={[styles.card, { width: cardW }]}>
              {imageSource ? (
                <ProductTileImageWithHeart
                  product={{
                    title: item.title,
                    price: priceLabel,
                    image: imageSource,
                    category: item.productType || undefined,
                  }}
                  source={imageSource}
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
                  <View style={styles.placeholderWrap}>
                    <Text style={[styles.placeholderText, { color: theme.textColor }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                </Pressable>
              )}
              <Pressable
                style={styles.footer}
                onPress={() => navigation.navigate('Product', { product: item })}
              >
                <Text style={[styles.cardTitle, { color: theme.textColor }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardPrice}>{priceLabel}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>
      {!loading && hasMore ? (
        <Pressable
          onPress={loadMore}
          style={({ pressed }) => [styles.loadMoreButton, { opacity: pressed ? 0.88 : 1 }]}
        >
          <Text style={[styles.loadMoreText, { color: theme.brandAccent }]}>Load more</Text>
        </Pressable>
      ) : null}
    </>
  )

  return (
    <View style={styles.page}>
      {!ipHubEnabled ? (
        <View style={styles.hero}>
          {renderSearchBar()}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          {ipHubEnabled ? 'Featured' : selectionLabel}
        </Text>

        {ipHubEnabled && selectedIp ? (
          <Pressable onPress={clearIpFilter} hitSlop={8} style={styles.clearIpRow}>
            <FeatherIcon name="chevron-left" size={16} color={theme.brandAccent} />
            <Text style={[styles.clearIpText, { color: theme.brandAccent }]}>All characters</Text>
          </Pressable>
        ) : null}

        {ipHubEnabled && !loading ? (
          <View style={styles.ipGrid}>
            {ipHubTiles.map(({ key, label, count, previewUri }) => {
              const isSelected = selectedIp === key
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.ipCardPressable,
                    { width: ipCardW, opacity: pressed ? 0.92 : 1 },
                  ]}
                  onPress={() => {
                    setSelectedIp((prev) => (prev === key ? null : key))
                    setQuery('')
                  }}
                >
                  <WonderportAccentCard
                    borderVariant="solid"
                    borderWidth={isSelected ? 3 : 2}
                    borderRadius={16}
                    innerBackgroundColor={frameFill}
                    style={styles.ipCardOuter}
                    contentStyle={styles.ipCardInner}
                  >
                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.ipPreviewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.ipPreviewPlaceholder, { backgroundColor: frameFill }]}>
                        <Text style={[styles.ipPreviewInitial, { color: theme.brandAccent }]}>
                          {label.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.ipName, { color: theme.textColor }]} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={[styles.ipCount, { color: theme.mutedForegroundColor }]}>
                      {count === 1 ? '1 product' : `${count} products`}
                    </Text>
                  </WonderportAccentCard>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {ipHubEnabled ? <View style={styles.searchSection}>{renderSearchBar()}</View> : null}

        {renderProductGrid()}
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  const pageBg = theme.appBackgroundColor || theme.backgroundColor
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: pageBg },
    hero: {
      backgroundColor: pageBg,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchSection: {
      marginBottom: 16,
    },
    searchCard: {
      width: '100%',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      fontFamily: 'Geist-Medium',
      fontSize: 14,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 110,
      backgroundColor: pageBg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    },
    headerTitle: { fontFamily: theme.boldFont, fontSize: 24, marginBottom: 18 },
    metaText: { fontFamily: theme.mediumFont, fontSize: 13, marginBottom: 10 },
    clearIpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
      marginTop: -8,
      alignSelf: 'flex-start',
    },
    clearIpText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
    },
    clearIpButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      marginBottom: 12,
    },
    clearIpButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
    },
    ipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: IP_GRID_GAP,
      marginBottom: 16,
    },
    ipCardPressable: {
      alignSelf: 'stretch',
    },
    ipCardOuter: {
      width: '100%',
    },
    ipCardInner: {
      padding: 10,
      alignItems: 'center',
      minHeight: 168,
    },
    ipPreviewImage: {
      width: '100%',
      height: 100,
      borderRadius: 12,
      marginBottom: 8,
    },
    ipPreviewPlaceholder: {
      width: '100%',
      height: 100,
      borderRadius: 12,
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ipPreviewInitial: {
      fontFamily: theme.boldFont,
      fontSize: 36,
    },
    ipName: {
      fontFamily: theme.boldFont,
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 4,
    },
    ipCount: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      textAlign: 'center',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    loadMoreButton: {
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 16,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    loadMoreText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
    },
    card: {
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderRadius: 18,
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: 6,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      overflow: 'hidden',
    },
    media: { width: '100%', height: 230, borderRadius: 14, overflow: 'hidden' },
    mediaImage: { width: '100%', height: '100%' },
    placeholderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
    placeholderText: { fontFamily: theme.semiBoldFont, fontSize: 13, textAlign: 'center' },
    footer: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 },
    cardTitle: { fontFamily: theme.boldFont, fontSize: 14, lineHeight: 18 },
    cardPrice: {
      marginTop: 8,
      fontFamily: theme.boldFont,
      fontSize: 13,
      color: '#fff',
      backgroundColor: theme.brandAccent,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
  })
}
