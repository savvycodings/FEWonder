import { useCallback, useContext, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { fetchAdminOrderDetail } from '../ordersApi'

function centsLabel(cents: number, code: string) {
  return `${(cents / 100).toFixed(2)} ${code}`
}

async function adminCopy(label: string, value: string | null | undefined) {
  const v = String(value || '').trim()
  if (!v) {
    Alert.alert(label, 'Nothing to copy.')
    return
  }
  await Clipboard.setStringAsync(v)
  Alert.alert('Copied', `${label} copied to clipboard.`)
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
          <Text style={styles.body}>
            Subtotal {centsLabel(o.subtotalCents ?? 0, o.currencyCode)} · Shipping{' '}
            {centsLabel(o.shippingCents ?? 0, o.currencyCode)}
          </Text>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.body}>{u?.name || '—'}</Text>
          {u?.email ? (
            <View style={styles.copyRow}>
              <Text style={styles.bodyFlex}>{u.email}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={() => adminCopy('Email', u.email)}>
                <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
              </TouchableOpacity>
            </View>
          ) : null}
          {u?.phone ? (
            <View style={styles.copyRow}>
              <Text style={styles.bodyFlex}>{u.phone}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={() => adminCopy('Phone', u.phone)}>
                <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.label}>Order contact</Text>
          {o.contactEmail ? (
            <View style={styles.copyRow}>
              <Text style={styles.bodyFlex}>{o.contactEmail}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={() => adminCopy('Order email', o.contactEmail)}>
                <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
              </TouchableOpacity>
            </View>
          ) : null}
          {o.contactPhone ? (
            <View style={styles.copyRow}>
              <Text style={styles.bodyFlex}>{o.contactPhone}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={() => adminCopy('Order phone', o.contactPhone)}>
                <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.label}>Delivery</Text>
          <Text style={styles.body}>
            {o.deliveryMethod === 'pudo' ? 'Pudo locker' : 'Standard courier'} · snapshot below
          </Text>
          <Text style={styles.label}>Shipping snapshot</Text>
          <Text style={styles.body}>{o.shippingSnapshot?.name}</Text>
          <View style={styles.copyRow}>
            <Text style={styles.bodyFlex}>{o.shippingSnapshot?.line1 || '—'}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => adminCopy('Shipping line 1', o.shippingSnapshot?.line1)}
            >
              <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
            </TouchableOpacity>
          </View>
          {o.shippingSnapshot?.line2 ? (
            <View style={styles.copyRow}>
              <Text style={styles.bodyFlex}>{o.shippingSnapshot.line2}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => adminCopy('Shipping line 2', o.shippingSnapshot?.line2)}
              >
                <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
              </TouchableOpacity>
            </View>
          ) : null}
          {o.pudoLockerName || o.pudoLockerAddress ? (
            <>
              <Text style={styles.label}>Pudo (order)</Text>
              {o.pudoLockerName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{o.pudoLockerName}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Pudo locker name', o.pudoLockerName)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {o.pudoLockerAddress ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{o.pudoLockerAddress}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Pudo address', o.pudoLockerAddress)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
          {o.customerEftAccountName || o.customerEftBankName || o.customerEftAccountNumber ? (
            <>
              <Text style={styles.label}>Customer bank (order)</Text>
              {o.customerEftAccountName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{o.customerEftAccountName}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Customer account name', o.customerEftAccountName)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {o.customerEftBankName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{o.customerEftBankName}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Customer bank', o.customerEftBankName)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {o.customerEftAccountNumber ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{o.customerEftAccountNumber}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Customer account number', o.customerEftAccountNumber)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
          {u?.eftBankAccountName || u?.eftBankName || u?.eftBankAccountNumber ? (
            <>
              <Text style={styles.label}>Customer bank (profile)</Text>
              {u.eftBankAccountName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{u.eftBankAccountName}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Profile EFT name', u.eftBankAccountName)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {u.eftBankName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{u.eftBankName}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={() => adminCopy('Profile bank', u.eftBankName)}>
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {u.eftBankAccountNumber ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{u.eftBankAccountNumber}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Profile account no.', u.eftBankAccountNumber)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
          {u?.pudoLockerName || u?.pudoLockerAddress ? (
            <>
              <Text style={styles.label}>Pudo (profile)</Text>
              {u.pudoLockerName ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{u.pudoLockerName}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Profile Pudo name', u.pudoLockerName)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {u.pudoLockerAddress ? (
                <View style={styles.copyRow}>
                  <Text style={styles.bodyFlex}>{u.pudoLockerAddress}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Profile Pudo address', u.pudoLockerAddress)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
          {o.peachCheckoutId ? (
            <>
              <Text style={styles.label}>Peach</Text>
              <View style={styles.copyRow}>
                <Text style={styles.bodyFlex}>checkout: {o.peachCheckoutId}</Text>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => adminCopy('Peach checkout id', o.peachCheckoutId)}
                >
                  <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                </TouchableOpacity>
              </View>
              {o.peachResourcePath ? (
                <View style={styles.copyRow}>
                  <Text style={styles.monoFlex}>{o.peachResourcePath}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => adminCopy('Peach path', o.peachResourcePath)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.tintColor || '#CBFF00'} />
                  </TouchableOpacity>
                </View>
              ) : null}
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
    bodyFlex: { flex: 1, fontFamily: theme.mediumFont, fontSize: 14, color: theme.textColor, paddingRight: 8 },
    mono: { fontFamily: theme.mediumFont, fontSize: 12, color: theme.mutedForegroundColor },
    monoFlex: {
      flex: 1,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      paddingRight: 8,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    copyBtn: { padding: 6 },
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
