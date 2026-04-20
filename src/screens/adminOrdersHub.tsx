import { useCallback, useContext, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from 'react-native'
import { ThemeContext } from '../context'
import { fetchAdminOrders } from '../ordersApi'

type Filter = 'peach' | 'eft'

function centsLabel(cents: number, code: string) {
  return `${(cents / 100).toFixed(2)} ${code}`
}

export function AdminOrdersHub({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [filter, setFilter] = useState<Filter>('peach')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchAdminOrders(filter, 80, 0)
      setOrders(data.orders || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View style={styles.page}>
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, filter === 'peach' && styles.segmentActive]}
          onPress={() => setFilter('peach')}
        >
          <Text style={[styles.segmentText, filter === 'peach' && styles.segmentTextActive]}>
            Peach payments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, filter === 'eft' && styles.segmentActive]}
          onPress={() => setFilter('eft')}
        >
          <Text style={[styles.segmentText, filter === 'eft' && styles.segmentTextActive]}>EFT</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listPad}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No orders in this section.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('AdminOrderDetail', { orderId: item.id })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.ref}>{item.referenceCode}</Text>
              <Text style={styles.amount}>{centsLabel(item.totalCents, item.currencyCode)}</Text>
            </View>
            <Text style={styles.status}>{item.status}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {item.userEmail || '—'}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminUserOrders', { userId: item.userId })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.userLink}>View user history</Text>
            </TouchableOpacity>
          </Pressable>
        )}
      />
    </View>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    segmentRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    segment: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.tileBackgroundColor || '#1f1f1f',
      alignItems: 'center',
    },
    segmentActive: {
      borderWidth: 1,
      borderColor: theme.tintColor || '#CBFF00',
    },
    segmentText: { fontFamily: theme.mediumFont, fontSize: 13, color: theme.mutedForegroundColor },
    segmentTextActive: { color: theme.textColor, fontFamily: theme.boldFont },
    errorBanner: {
      marginHorizontal: 12,
      marginBottom: 6,
      color: '#c62828',
      fontFamily: theme.mediumFont,
      fontSize: 13,
    },
    listPad: { padding: 12, paddingBottom: 40 },
    empty: { textAlign: 'center', color: theme.mutedForegroundColor, marginTop: 24, fontFamily: theme.mediumFont },
    card: {
      backgroundColor: theme.tileBackgroundColor || '#1f1f1f',
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    cardPressed: { opacity: 0.92 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    ref: { fontFamily: theme.boldFont, fontSize: 15, color: theme.textColor },
    amount: { fontFamily: theme.semiBoldFont, fontSize: 15, color: theme.textColor },
    status: { fontFamily: theme.mediumFont, fontSize: 12, color: theme.mutedForegroundColor, marginBottom: 4 },
    email: { fontFamily: theme.mediumFont, fontSize: 13, color: theme.textColor, marginBottom: 8 },
    userLink: { fontFamily: theme.boldFont, fontSize: 13, color: theme.tintColor || '#CBFF00' },
  })
