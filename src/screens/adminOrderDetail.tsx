import { useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image, RefreshControl } from 'react-native'
import { ThemeContext } from '../context'
import { fetchAdminOrderDetail } from '../ordersApi'

function centsLabel(cents: number, code: string) {
  return `${(cents / 100).toFixed(2)} ${code}`
}

export function AdminOrderDetail({ route }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const orderId = route?.params?.orderId as string
  const [payload, setPayload] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orderId) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetchAdminOrderDetail(orderId)
      setPayload(res)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const o = payload?.order
  const u = payload?.user
  const lines = (payload?.lineItems || []) as any[]
  const events = (payload?.paymentEvents || []) as any[]

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {o ? (
        <>
          <Text style={styles.h1}>{o.referenceCode}</Text>
          <Text style={styles.meta}>
            {o.paymentMethod?.toUpperCase()} · {o.status}
          </Text>
          <Text style={styles.amount}>{centsLabel(o.totalCents, o.currencyCode)}</Text>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.body}>{u?.name || '—'}</Text>
          <Text style={styles.body}>{u?.email}</Text>
          <Text style={styles.label}>Shipping snapshot</Text>
          <Text style={styles.body}>{o.shippingSnapshot?.name}</Text>
          <Text style={styles.body}>{o.shippingSnapshot?.line1}</Text>
          {o.shippingSnapshot?.line2 ? <Text style={styles.body}>{o.shippingSnapshot.line2}</Text> : null}
          {o.peachCheckoutId ? (
            <>
              <Text style={styles.label}>Peach</Text>
              <Text style={styles.mono}>checkout: {o.peachCheckoutId}</Text>
              {o.peachResourcePath ? <Text style={styles.mono}>{o.peachResourcePath}</Text> : null}
            </>
          ) : null}
          {o.eftProofImageUrl ? (
            <>
              <Text style={styles.label}>EFT proof</Text>
              <Image source={{ uri: o.eftProofImageUrl }} style={styles.proof} resizeMode="contain" />
              {o.eftCustomerNote ? <Text style={styles.body}>{o.eftCustomerNote}</Text> : null}
            </>
          ) : null}
          <Text style={styles.label}>Line items</Text>
          {lines.map((l) => (
            <View key={l.id} style={styles.lineCard}>
              <Text style={styles.lineTitle}>{l.title}</Text>
              <Text style={styles.lineSub}>
                ×{l.quantity} @ {centsLabel(l.unitPriceCents, l.currencyCode)} →{' '}
                {centsLabel(l.lineTotalCents, l.currencyCode)}
              </Text>
            </View>
          ))}
          <Text style={styles.label}>Payment events</Text>
          {events.map((e) => (
            <View key={e.id} style={styles.eventCard}>
              <Text style={styles.eventTop}>
                {e.eventType} · {e.provider}
                {e.statusAfter ? ` → ${e.statusAfter}` : ''}
              </Text>
              <Text style={styles.eventDate}>{String(e.createdAt).slice(0, 19)}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    pad: { padding: 16, paddingBottom: 48 },
    error: { color: '#c62828', marginBottom: 12, fontFamily: theme.mediumFont },
    h1: { fontFamily: theme.boldFont, fontSize: 22, color: theme.textColor },
    meta: { fontFamily: theme.mediumFont, color: theme.mutedForegroundColor, marginTop: 4 },
    amount: { fontFamily: theme.boldFont, fontSize: 20, color: theme.textColor, marginVertical: 12 },
    label: {
      fontFamily: theme.boldFont,
      fontSize: 13,
      color: theme.tintColor || '#CBFF00',
      marginTop: 16,
      marginBottom: 4,
    },
    body: { fontFamily: theme.mediumFont, fontSize: 14, color: theme.textColor },
    mono: { fontFamily: theme.mediumFont, fontSize: 12, color: theme.mutedForegroundColor },
    proof: { width: '100%', height: 220, marginTop: 8, backgroundColor: '#000' },
    lineCard: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.tileBackgroundColor || '#1a1a1a',
      marginBottom: 8,
    },
    lineTitle: { fontFamily: theme.semiBoldFont, color: theme.textColor },
    lineSub: { fontFamily: theme.mediumFont, fontSize: 12, color: theme.mutedForegroundColor, marginTop: 4 },
    eventCard: {
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderColor,
      marginBottom: 6,
    },
    eventTop: { fontFamily: theme.mediumFont, fontSize: 12, color: theme.textColor },
    eventDate: { fontFamily: theme.mediumFont, fontSize: 11, color: theme.mutedForegroundColor, marginTop: 2 },
  })
