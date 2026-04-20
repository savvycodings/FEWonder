import { useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Image } from 'react-native'
import { ThemeContext } from '../context'
import { fetchAdminUserOrders } from '../ordersApi'

function centsLabel(cents: number, code: string) {
  return `${(cents / 100).toFixed(2)} ${code}`
}

export function AdminUserOrders({ navigation, route }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const userId = route?.params?.userId as string
  const [data, setData] = useState<{
    user: any
    orders: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetchAdminUserOrders(userId)
      setData(res)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const user = data?.user

  return (
    <View style={styles.page}>
      {user ? (
        <View style={styles.header}>
          {user.image ? <Image source={{ uri: user.image }} style={styles.avatar} /> : <View style={styles.avatarPh} />}
          <View style={styles.headerText}>
            <Text style={styles.name}>{user.name || '—'}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {user.shippingAddress1 || 'No address on file'}
            </Text>
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.sectionTitle}>Order history</Text>
      <FlatList
        data={data?.orders || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listPad}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No orders.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            onPress={() => navigation.navigate('AdminOrderDetail', { orderId: item.id })}
          >
            <Text style={styles.ref}>{item.referenceCode}</Text>
            <Text style={styles.row}>
              {item.paymentMethod} · {item.status}
            </Text>
            <Text style={styles.amount}>{centsLabel(item.totalCents, item.currencyCode)}</Text>
            <Text style={styles.date}>{String(item.createdAt).slice(0, 19)}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    header: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    avatar: { width: 56, height: 56, borderRadius: 28 },
    avatarPh: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.tileBorderColor || '#333',
    },
    headerText: { flex: 1 },
    name: { fontFamily: theme.boldFont, fontSize: 18, color: theme.textColor },
    email: { fontFamily: theme.mediumFont, fontSize: 14, color: theme.mutedForegroundColor },
    sub: { fontFamily: theme.mediumFont, fontSize: 13, color: theme.textColor, marginTop: 4 },
    error: { color: '#c62828', paddingHorizontal: 16, fontFamily: theme.mediumFont },
    sectionTitle: {
      fontFamily: theme.boldFont,
      fontSize: 16,
      color: theme.textColor,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    listPad: { padding: 12, paddingBottom: 40 },
    empty: { textAlign: 'center', color: theme.mutedForegroundColor, marginTop: 20 },
    card: {
      backgroundColor: theme.tileBackgroundColor || '#1f1f1f',
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    ref: { fontFamily: theme.boldFont, color: theme.textColor, fontSize: 15 },
    row: { fontFamily: theme.mediumFont, color: theme.mutedForegroundColor, fontSize: 12, marginTop: 4 },
    amount: { fontFamily: theme.semiBoldFont, color: theme.textColor, marginTop: 4 },
    date: { fontFamily: theme.mediumFont, fontSize: 11, color: theme.mutedForegroundColor, marginTop: 4 },
  })
