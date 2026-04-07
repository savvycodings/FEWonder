import { useContext, useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { listDbProducts } from '../utils'
import { ShopifyProduct } from '../../types'
import { formatMoney } from '../money'

const categories = ['Popular', 'Pops', 'Figures', 'Anime']

function getImageSource(item: any) {
  if (item?.featuredImageUrl) return { uri: item.featuredImageUrl }
  return item?.image
}

const GRID_PAD = 16
const GRID_GAP = 12

export function Home({ navigation }: any) {
  const { width } = useWindowDimensions()
  const cardW = (width - GRID_PAD * 2 - GRID_GAP) / 2
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const heroGreeting = useMemo(() => 'Daily Wonderport Drops', [])
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        console.log('[Home] loading DB products…')
        const fetched = await listDbProducts({ first: 12 })
        if (!cancelled && fetched.length) {
          console.log('[Home] DB products loaded', {
            count: fetched.length,
            first: {
              id: fetched[0]?.id,
              title: fetched[0]?.title,
              handle: fetched[0]?.handle,
              featuredImageUrl: fetched[0]?.featuredImageUrl,
              price: fetched[0]?.price,
            },
          })
          setProducts(fetched)
        } else if (!cancelled) {
          console.log('[Home] DB products empty')
        }
      } catch (error: any) {
        if (!cancelled) {
          console.log('[Home] DB products load failed, using fallback', {
            message: error?.message,
          })
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{heroGreeting}</Text>
        <View style={styles.bellButton}>
          <FeatherIcon name="bell" size={16} color={theme.mutedForegroundColor} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.chipsRow}
      >
        {categories.map((item, idx) => (
          <View
            key={item}
            style={[styles.chip, idx === 0 ? styles.chipActive : null]}
          >
            <Text style={[styles.chipText, idx === 0 ? styles.chipTextActive : null]}>{item}</Text>
          </View>
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
          return (
            <TouchableOpacity
              key={item.id || item.handle || item.title}
              style={[styles.card, { width: cardW }]}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('Product', { product: item })}
            >
              <View style={styles.media}>
                {src ? (
                  <Image source={src} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <View style={styles.mediaPlaceholder}>
                    <Text style={styles.mediaPlaceholderText} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
                  {item.title}
                </Text>
                <Text style={styles.priceText}>{priceLabel}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
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
  bellButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e7ebf3',
  },
  title: {
    color: '#1f2744',
    fontFamily: theme.boldFont,
    fontSize: 32,
    lineHeight: 36,
    width: '78%',
  },
  chipsRow: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#e9edf5',
  },
  chipActive: {
    backgroundColor: '#2a335f',
  },
  chipText: {
    color: '#6f7892',
    fontFamily: theme.mediumFont,
    fontSize: 13,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  sectionHeaderRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#2b3356',
    fontFamily: theme.boldFont,
    fontSize: 18,
  },
  sectionHint: {
    color: '#9aa2b6',
    fontFamily: theme.mediumFont,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8ecf4',
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#eef1f8',
    overflow: 'hidden',
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  mediaPlaceholderText: {
    color: '#8893ad',
    fontFamily: theme.mediumFont,
    fontSize: 12,
    textAlign: 'center',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  itemTitle: {
    color: '#2b3356',
    fontFamily: theme.semiBoldFont,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
    minHeight: 40,
  },
  priceText: {
    color: '#f17d3e',
    fontFamily: theme.boldFont,
    fontSize: 15,
    lineHeight: 18,
  },
  loadingText: {
    color: '#9aa2b6',
    fontFamily: theme.mediumFont,
    fontSize: 12,
    marginBottom: 10,
  },
})
