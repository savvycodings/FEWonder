import { useContext, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { Feather as FeatherIcon } from '@expo/vector-icons'
import { ProductTileImageWithHeart } from '../components'
import { ThemeContext } from '../context'
import { ShopifyProduct } from '../../types'
import { formatMoney } from '../money'
import { getDbCategoryBySlug } from '../utils'

const GRID_GAP = 12

export function CategoryProducts({ route, navigation }: { route: any; navigation: any }) {
  const slug = String(route?.params?.slug || '').trim()
  const fallbackTitle = String(route?.params?.title || '').trim()
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState(fallbackTitle || 'Category')
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const { width } = useWindowDimensions()
  const { theme } = useContext(ThemeContext)
  const cardW = (width - 32 - GRID_GAP) / 2
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (item) =>
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.productType || '').toLowerCase().includes(q) ||
        String(item.vendor || '').toLowerCase().includes(q)
    )
  }, [products, query])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
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
  }, [slug, fallbackTitle])

  useEffect(() => {
    navigation.setOptions?.({ title })
  }, [navigation, title])

  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.searchBar}>
          <FeatherIcon name="search" size={16} color="#8e97ad" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title}`}
            placeholderTextColor="#a2a9bb"
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <FeatherIcon name="x" size={16} color="#8e97ad" />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>{title}</Text>
        {loading ? <Text style={[styles.metaText, { color: theme.mutedForegroundColor }]}>Loading…</Text> : null}
        {!loading && !filteredProducts.length ? (
          <Text style={[styles.metaText, { color: theme.mutedForegroundColor }]}>No products found.</Text>
        ) : null}
        <View style={styles.grid}>
          {filteredProducts.map((item) => {
            const imageSource = item.featuredImageUrl ? { uri: item.featuredImageUrl } : undefined
            const priceLabel =
              item.price?.amount != null && item.price.amount !== '' ? formatMoney(item.price) : 'View details'
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
                  <Pressable style={styles.media} onPress={() => navigation.navigate('Product', { product: item })}>
                    <View style={styles.placeholderWrap}>
                      <Text style={[styles.placeholderText, { color: theme.textColor }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </Pressable>
                )}
                <Pressable style={styles.footer} onPress={() => navigation.navigate('Product', { product: item })}>
                  <Text style={[styles.cardTitle, { color: theme.textColor }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardPrice}>{priceLabel}</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: '#000000' },
    hero: {
      backgroundColor: '#000000',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchBar: {
      borderRadius: 12,
      backgroundColor: '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      color: '#2a3359',
      fontFamily: 'Geist-Medium',
      fontSize: 14,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 110,
      backgroundColor: theme.appBackgroundColor || '#f7f8fb',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    },
    headerTitle: { fontFamily: theme.boldFont, fontSize: 24, marginBottom: 6 },
    metaText: { fontFamily: theme.mediumFont, fontSize: 13, marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
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
    cardPrice: { marginTop: 8, fontFamily: theme.boldFont, fontSize: 13, color: '#000', backgroundColor: theme.brandAccent, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  })
}
