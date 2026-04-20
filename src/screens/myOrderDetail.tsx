import { useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { ThemeContext } from '../context'
import { WonderportAccentCard } from '../components'
import { fetchMyOrder } from '../ordersApi'

const ACCENT = '#CBFF00'
const CARD_FILL = '#000000'

export function MyOrderDetail({ route }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const orderId = route?.params?.orderId as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orderId) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetchMyOrder(orderId)
      setData(res)
    } catch (e: any) {
      setError(e?.message || 'Could not load order')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const o = data?.order
  const lines = (data?.lineItems || []) as any[]

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pad}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {o ? (
        <>
          <WonderportAccentCard borderWidth={2} borderRadius={16} innerBackgroundColor={CARD_FILL} style={styles.block}>
            <View style={styles.innerPad}>
              <Text style={styles.ref}>{o.referenceCode}</Text>
              <Text style={styles.meta}>
                {o.paymentMethod?.toUpperCase()} · {o.status}
              </Text>
              <Text style={styles.total}>
                {(o.totalCents / 100).toFixed(2)} {o.currencyCode}
              </Text>
            </View>
          </WonderportAccentCard>
          <Text style={styles.section}>Shipping</Text>
          <Text style={styles.body}>{o.shippingSnapshot?.name}</Text>
          <Text style={styles.body}>{o.shippingSnapshot?.line1}</Text>
          {o.shippingSnapshot?.line2 ? <Text style={styles.body}>{o.shippingSnapshot.line2}</Text> : null}
          <Text style={styles.section}>Items</Text>
          {lines.map((l) => (
            <WonderportAccentCard
              key={l.id}
              borderWidth={1}
              borderRadius={12}
              innerBackgroundColor={CARD_FILL}
              style={{ marginBottom: 10 }}
              contentStyle={styles.lineInner}
            >
              <Text style={styles.lineTitle}>{l.title}</Text>
              <Text style={styles.lineSub}>
                ×{l.quantity} @ {(l.unitPriceCents / 100).toFixed(2)} → {(l.lineTotalCents / 100).toFixed(2)}{' '}
                {l.currencyCode}
              </Text>
            </WonderportAccentCard>
          ))}
          {o.eftProofImageUrl ? (
            <>
              <Text style={styles.section}>Proof of payment</Text>
              <Image source={{ uri: o.eftProofImageUrl }} style={styles.proof} resizeMode="contain" />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    pad: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: { color: '#ff6b6b', marginBottom: 12, fontFamily: theme.mediumFont },
    block: { width: '100%', marginBottom: 16 },
    innerPad: { padding: 14 },
    ref: { fontFamily: theme.boldFont, fontSize: 20, color: ACCENT, marginBottom: 6 },
    meta: { fontFamily: theme.mediumFont, fontSize: 13, color: 'rgba(203,255,0,0.8)', marginBottom: 8 },
    total: { fontFamily: theme.boldFont, fontSize: 18, color: ACCENT },
    section: {
      fontFamily: theme.boldFont,
      fontSize: 14,
      color: ACCENT,
      marginTop: 12,
      marginBottom: 6,
    },
    body: { fontFamily: theme.mediumFont, fontSize: 14, color: theme.textColor, marginBottom: 2 },
    lineInner: { paddingVertical: 10, paddingHorizontal: 12 },
    lineTitle: { fontFamily: theme.semiBoldFont, color: ACCENT, fontSize: 14 },
    lineSub: { fontFamily: theme.mediumFont, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    proof: { width: '100%', height: 220, marginTop: 8, borderRadius: 12, backgroundColor: '#111' },
  })
