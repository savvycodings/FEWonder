import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ThemeContext } from '../context'
import { ProfileStackBackBar } from '../components/ProfileStackBackBar'
import {
  adminMarkCollectionCollected,
  fetchAdminCollectionByReference,
  fetchAdminCollections,
} from '../ordersApi'

function centsLabel(cents: number, code: string) {
  return `R${(cents / 100).toFixed(2)} ${code}`
}

function formatCollectStatus(status: string | null | undefined) {
  const raw = String(status || 'awaiting_collection').trim()
  return raw.replace(/_/g, ' ')
}

function splitStoreLabel(raw: string | null | undefined): { name: string; address: string } {
  const full = String(raw || '').trim()
  if (!full) return { name: '-', address: '' }
  const comma = full.indexOf(', ')
  if (comma > 0) {
    return { name: full.slice(0, comma).trim(), address: full.slice(comma + 2).trim() }
  }
  return { name: full, address: '' }
}

export function AdminInStoreCollections({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const [q, setQ] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [markBusy, setMarkBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchAdminCollections({
        q: q.trim() || undefined,
        status: 'awaiting',
        limit: 80,
      })
      setOrders(data.orders || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  async function lookup() {
    const code = q.trim()
    if (!code) {
      Alert.alert('Order number', 'Enter a WP- order number to look up.')
      return
    }
    setDetailBusy(true)
    setDetail(null)
    try {
      const data = await fetchAdminCollectionByReference(code)
      setDetail(data.order)
    } catch (e: any) {
      Alert.alert('Not found', e?.message || 'No collect order for that number.')
    } finally {
      setDetailBusy(false)
    }
  }

  function closeLookup() {
    setDetail(null)
    setQ('')
  }

  async function markCollected(referenceCode: string) {
    setMarkBusy(true)
    try {
      await adminMarkCollectionCollected(referenceCode)
      Alert.alert('Collected', `${referenceCode} marked as collected.`)
      setDetail(null)
      setQ('')
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not mark collected')
    } finally {
      setMarkBusy(false)
    }
  }

  return (
    <View style={styles.page}>
      <ProfileStackBackBar />
      <Text style={styles.title}>In-store collections</Text>
      <Text style={styles.hint}>
        Ask for the collector name and WP- order number, then look it up here.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="WP- order number"
          placeholderTextColor={theme.mutedForegroundColor}
          style={styles.searchInput}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => void lookup()} disabled={detailBusy}>
          {detailBusy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Lookup</Text>
          )}
        </TouchableOpacity>
      </View>

      {detail ? (
        <View style={styles.detailCard}>
          <Text style={styles.ref}>{detail.referenceCode}</Text>
          <Text style={styles.meta}>Collector: {detail.collectorName || '-'}</Text>
          {(() => {
            const store = splitStoreLabel(detail.collectStoreName)
            return (
              <>
                <Text style={styles.meta}>Store: {store.name}</Text>
                {store.address ? <Text style={styles.metaAddress}>{store.address}</Text> : null}
              </>
            )
          })()}
          <Text style={styles.meta}>Email: {detail.contactEmail || '-'}</Text>
          <Text style={styles.meta}>Status: {formatCollectStatus(detail.collectStatus)}</Text>
          <Text style={styles.meta}>
            Total: {centsLabel(detail.totalCents, detail.currencyCode)}
          </Text>
          <Text style={styles.linesHeading}>Items</Text>
          {(detail.lines || []).map((line: any, idx: number) => (
            <Text key={`${line.title}-${idx}`} style={styles.line}>
              {line.title} x {line.quantity} - R{(line.lineTotalCents / 100).toFixed(2)}
            </Text>
          ))}
          {detail.collectStatus !== 'collected' ? (
            <TouchableOpacity
              style={[styles.markBtn, markBusy && styles.markBtnDisabled]}
              onPress={() => void markCollected(detail.referenceCode)}
              disabled={markBusy}
            >
              <Text style={styles.markBtnText}>Mark collected</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={closeLookup}>
            <Text style={styles.clearDetail}>Close lookup</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={<Text style={styles.listHeading}>Awaiting collection</Text>}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No awaiting pickups.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              setQ(item.referenceCode)
              void (async () => {
                setDetailBusy(true)
                try {
                  const data = await fetchAdminCollectionByReference(item.referenceCode)
                  setDetail(data.order)
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Lookup failed')
                } finally {
                  setDetailBusy(false)
                }
              })()
            }}
          >
            <Text style={styles.ref}>{item.referenceCode}</Text>
            <Text style={styles.meta}>{item.collectorName || '-'}</Text>
            {(() => {
              const store = splitStoreLabel(item.collectStoreName)
              return (
                <>
                  <Text style={styles.meta}>{store.name}</Text>
                  {store.address ? <Text style={styles.metaAddress}>{store.address}</Text> : null}
                </>
              )
            })()}
            <Text style={styles.amount}>{centsLabel(item.totalCents, item.currencyCode)}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}

const getStyles = (theme: any) => {
  const border = theme.tileBorderColor || theme.borderColor || 'rgba(0,0,0,0.08)'
  const surface = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#fff'
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    title: {
      fontFamily: theme.boldFont,
      fontSize: 20,
      color: theme.textColor,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    hint: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      paddingHorizontal: 16,
      marginTop: 4,
      marginBottom: 12,
      lineHeight: 18,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: theme.textColor,
      backgroundColor: surface,
    },
    searchBtn: {
      backgroundColor: theme.brandAccent || '#111',
      borderRadius: 12,
      paddingHorizontal: 14,
      justifyContent: 'center',
      minWidth: 84,
      alignItems: 'center',
    },
    searchBtnText: { color: '#fff', fontFamily: theme.semiBoldFont, fontSize: 14 },
    detailCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface,
    },
    ref: { fontFamily: theme.boldFont, fontSize: 18, color: theme.textColor },
    meta: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      marginTop: 4,
    },
    metaAddress: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 17,
      color: theme.mutedForegroundColor,
      marginTop: 2,
      opacity: 0.9,
    },
    linesHeading: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
      marginTop: 12,
      marginBottom: 4,
    },
    line: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.textColor,
      marginTop: 2,
    },
    markBtn: {
      marginTop: 14,
      backgroundColor: theme.brandAccent || '#111',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    markBtnDisabled: { opacity: 0.6 },
    markBtnText: { color: '#fff', fontFamily: theme.semiBoldFont, fontSize: 15 },
    clearDetail: {
      marginTop: 10,
      textAlign: 'center',
      color: theme.brandAccent,
      fontFamily: theme.mediumFont,
    },
    error: { color: '#c00', paddingHorizontal: 16, marginBottom: 8 },
    listPad: { paddingHorizontal: 16, paddingBottom: 40 },
    listHeading: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
      marginBottom: 8,
    },
    empty: { color: theme.mutedForegroundColor, fontFamily: theme.regularFont },
    card: {
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      backgroundColor: surface,
    },
    amount: {
      marginTop: 6,
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
    },
  })
}
