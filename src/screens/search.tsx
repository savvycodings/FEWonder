import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ShopifyProduct, User } from '../../types'
import { listDbProducts } from '../utils'

const banners = [
  require('../../public/homepageimgs/searchbanner.webp'),
  require('../../public/homepageimgs/searchbanner2.webp'),
  require('../../public/homepageimgs/searchbanner3.webp'),
]
const trendingTallImages = [
  require('../../public/homepageimgs/search31.webp'),
  require('../../public/homepageimgs/search32.webp'),
  require('../../public/homepageimgs/search33.webp'),
]

export function Search({
  navigation,
  user,
}: {
  navigation: any
  user?: User
}) {
  const [query, setQuery] = useState('')
  const [activeBanner, setActiveBanner] = useState(0)
  const bannerScrollRef = useRef<ScrollView | null>(null)
  const { width } = useWindowDimensions()
  const bannerWidth = width - 32
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter(
      item =>
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.productType || '').toLowerCase().includes(q)
    )
  }, [query, products])
  const avatarInitial = (user?.fullName || 'U').slice(0, 1).toUpperCase()

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

  function getThumbSource(item: any) {
    if (item?.featuredImageUrl) return { uri: item.featuredImageUrl }
    return item?.image
  }

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        style={styles.scroll}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              {user?.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              )}
            </View>
            <View style={styles.notifyButton}>
              <FeatherIcon name="bell" size={14} color="#f4d26f" />
            </View>
          </View>

          <Text style={styles.greeting}>Hello, {user?.fullName || 'there'}!</Text>

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
            <Text style={styles.loadingText}>Loading products…</Text>
          ) : !products.length ? (
            <Text style={styles.loadingText}>No products found.</Text>
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
                    if (filtered[0]) {
                      navigation.navigate('Product', { product: filtered[0] })
                    }
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

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Trending Searches</Text>
          </View>

          <View style={styles.tallRow}>
            {trendingTallImages.map((img, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [styles.tallCard, pressed ? styles.cardPressed : null]}
                onPress={() => {
                  const product = filtered[index]
                  if (product) {
                    navigation.navigate('Product', { product })
                  }
                }}
              >
                <Image source={img} style={styles.tallImage} resizeMode="cover" />
              </Pressable>
            ))}
          </View>

          <View style={styles.popularSection}>
            <Text style={styles.resultsTitle}>Popular Choices</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularCarousel}
            >
              {(filtered.length ? filtered : products).slice(0, 12).map((product, index) => (
                <Pressable
                  key={`${product.id || product.handle || product.title}-${index}`}
                  style={({ pressed }) => [styles.popularCard, pressed ? styles.cardPressed : null]}
                  onPress={() => navigation.navigate('Product', { product })}
                >
                  <View style={styles.popularImageWrap}>
                    <Image source={getThumbSource(product)} style={styles.popularImage} resizeMode="cover" />
                  </View>
                  <Text numberOfLines={1} style={styles.popularName}>
                    {product.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  )
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
    backgroundColor: '#2a335f',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffbd8f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 12,
  },
  notifyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 28,
    marginBottom: 12,
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
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultsTitle: {
    color: '#2b3559',
    fontFamily: 'Geist-SemiBold',
    fontSize: 18,
  },
  tallRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tallCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e9edf5',
  },
  cardPressed: {
    opacity: 0.86,
  },
  tallImage: {
    width: '100%',
    height: 260,
  },
  popularSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  popularCarousel: {
    paddingTop: 10,
    paddingRight: 8,
    gap: 12,
  },
  popularCard: {
    width: 196,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e9f3',
  },
  popularImageWrap: {
    width: '100%',
    height: 210,
    backgroundColor: '#e9edf5',
  },
  popularImage: {
    width: '100%',
    height: '100%',
  },
  popularName: {
    color: '#2a3359',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingText: {
    color: '#8b94aa',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
    marginBottom: 10,
  },
})
