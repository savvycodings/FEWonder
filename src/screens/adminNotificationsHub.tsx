import { useCallback, useContext, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ThemeContext } from '../context'
import { ProfileStackBackBar } from '../components/ProfileStackBackBar'
import { getAdminNotifications, sendPendingNotifications } from '../restockApi'

export function AdminNotificationsHub() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAdminNotifications>> | null>(
    null,
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await getAdminNotifications()
      setSummary(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSendPending() {
    setSending(true)
    setError(null)
    setMessage(null)
    try {
      const result = await sendPendingNotifications()
      setSummary(result)
      if (result.skipped > 0 && result.sent === 0 && result.failed === 0) {
        setMessage(
          `No emails sent — Resend may not be configured, or ${result.skipped} pending row(s) were skipped.`,
        )
      } else {
        setMessage(`Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.`)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to send pending emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.page}>
      <ProfileStackBackBar />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Restock email queue</Text>
        <View style={styles.countRow}>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Pending</Text>
            <Text style={styles.countValue}>{summary?.pendingCount ?? '—'}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Sent</Text>
            <Text style={styles.countValue}>{summary?.sentCount ?? '—'}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Failed</Text>
            <Text style={styles.countValue}>{summary?.failedCount ?? '—'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.sendButton, (sending || loading) && styles.sendButtonDisabled]}
          onPress={() => void handleSendPending()}
          disabled={sending || loading}
        >
          {sending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.sendButtonText}>Send pending emails</Text>
          )}
        </TouchableOpacity>
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <FlatList
        data={summary?.recent || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={<Text style={styles.listTitle}>Recent queue</Text>}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No notification rows yet.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.productTitle || `Product #${item.productId}`}
              </Text>
              <Text style={[styles.status, item.status === 'pending' && styles.statusPending]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {item.userEmail || item.userId}
            </Text>
            <Text style={styles.meta}>
              Queued {new Date(item.createdAt).toLocaleString()}
              {item.sentAt ? ` · Sent ${new Date(item.sentAt).toLocaleString()}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    summaryCard: {
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 8,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      backgroundColor: theme.tileBackgroundColor || '#1f1f1f',
      gap: 12,
    },
    summaryTitle: {
      fontFamily: theme.boldFont,
      fontSize: 16,
      color: theme.textColor,
    },
    countRow: {
      flexDirection: 'row',
      gap: 8,
    },
    countPill: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor,
      alignItems: 'center',
    },
    countLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      marginBottom: 4,
    },
    countValue: {
      fontFamily: theme.boldFont,
      fontSize: 18,
      color: theme.textColor,
    },
    sendButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brandAccent,
    },
    sendButtonDisabled: {
      opacity: 0.7,
    },
    sendButtonText: {
      fontFamily: theme.boldFont,
      fontSize: 14,
      color: '#ffffff',
    },
    messageText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: theme.textColor,
    },
    errorText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: '#c62828',
    },
    listTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    listPad: { paddingHorizontal: 12, paddingBottom: 40 },
    empty: {
      textAlign: 'center',
      color: theme.mutedForegroundColor,
      marginTop: 24,
      fontFamily: theme.mediumFont,
    },
    card: {
      backgroundColor: theme.tileBackgroundColor || '#1f1f1f',
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 6,
    },
    cardTitle: {
      flex: 1,
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
    },
    status: {
      fontFamily: theme.boldFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      textTransform: 'uppercase',
    },
    statusPending: {
      color: theme.brandAccent,
    },
    meta: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginTop: 2,
    },
  })
