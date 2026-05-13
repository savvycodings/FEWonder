import { useCallback, useContext, useState } from 'react'
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { WonderportAccentCard } from '../components'
import { fetchMyOrders } from '../ordersApi'
import { brandAccentRgba } from '../brandAccent'

const CARD_FILL = '#000000'

function formatTotal(cents: number, code: string) {
  return `${(cents / 100).toFixed(2)} ${code}`
}

export function MyOrders({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchMyOrders()
      setOrders(data.orders || [])
    } catch (e: any) {
      setError(e?.message || 'Could not load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  return (
    <View style={styles.page}>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {loading && !orders.length ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.brandAccent} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.brandAccent} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No orders yet. Use Buy now on a product to place an order.</Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ProfileMyOrderDetail', { orderId: item.id })}>
              <WonderportAccentCard
                borderWidth={2}
                borderRadius={16}
                innerBackgroundColor={CARD_FILL}
                style={styles.cardOuter}
                contentStyle={styles.cardInner}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowTopLeft}>
                    {item.previewImageUrl ? (
                      <Image
                        source={{ uri: item.previewImageUrl }}
                        style={styles.orderThumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.orderThumbPlaceholder}>
                        <FeatherIcon name="package" size={18} color={theme.brandAccent} />
                      </View>
                    )}
                    <Text style={styles.ref}>{item.referenceCode}</Text>
                  </View>
                  <Text style={styles.total}>{formatTotal(item.totalCents, item.currencyCode)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{item.paymentMethod?.toUpperCase()}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.meta}>{item.status}</Text>
                </View>
                <Text style={styles.date}>{String(item.createdAt).slice(0, 10)}</Text>
                <View style={styles.chevRow}>
                  <Text style={styles.viewDetail}>Details</Text>
                  <FeatherIcon name="chevron-right" size={18} color={theme.brandAccent} />
                </View>
              </WonderportAccentCard>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    errorBanner: {
      padding: 12,
      color: '#ff6b6b',
      fontFamily: theme.mediumFont,
      fontSize: 13,
    },
    list: { padding: 16, paddingBottom: 40 },
    empty: {
      textAlign: 'center',
      marginTop: 32,
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      paddingHorizontal: 20,
    },
    cardOuter: { width: '100%', marginBottom: 12 },
    cardInner: { paddingVertical: 14, paddingHorizontal: 14 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rowTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
    orderThumbImage: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: L(0.22),
    },
    orderThumbPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: L(0.22),
      alignItems: 'center',
      justifyContent: 'center',
    },
    ref: { fontFamily: theme.boldFont, fontSize: 16, color: theme.brandAccent, flexShrink: 1 },
    total: { fontFamily: theme.boldFont, fontSize: 15, color: theme.brandAccent },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    meta: { fontFamily: theme.mediumFont, fontSize: 12, color: L(0.75) },
    metaDot: { marginHorizontal: 6, color: L(0.5) },
    date: { fontFamily: theme.mediumFont, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
    chevRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 4 },
    viewDetail: { fontFamily: theme.semiBoldFont, fontSize: 13, color: theme.brandAccent },
  })
}
