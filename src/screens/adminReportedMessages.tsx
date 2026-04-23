import { useCallback, useContext, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  AdminCommunityReport,
  deleteAdminReportedCommunityMessage,
  dismissAdminCommunityReport,
  fetchAdminCommunityReports,
} from '../ordersApi'
import { ThemeContext } from '../context'

type Filter = 'open' | 'resolved' | 'all'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function AdminReportedMessages() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [filter, setFilter] = useState<Filter>('open')
  const [reports, setReports] = useState<AdminCommunityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchAdminCommunityReports(filter, 160)
      setReports(data.reports || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports')
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function onKeep(reportId: string) {
    if (busyId) return
    setBusyId(reportId)
    try {
      await dismissAdminCommunityReport(reportId)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not resolve report')
    } finally {
      setBusyId(null)
    }
  }

  async function onDeleteMessage(reportId: string) {
    if (busyId) return
    setBusyId(reportId)
    try {
      await deleteAdminReportedCommunityMessage(reportId)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not delete message')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.segmentRow}>
        {(['open', 'resolved', 'all'] as Filter[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.segment, filter === key ? styles.segmentActive : null]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.segmentText, filter === key ? styles.segmentTextActive : null]}>
              {key === 'open' ? 'Open' : key === 'resolved' ? 'Resolved' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.listPad}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No reports in this section.</Text> : null}
        renderItem={({ item }) => {
          const disabled = busyId === item.id
          return (
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Reported message</Text>
                <Text style={styles.cardStatus}>{item.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.metaText}>Reported: {formatWhen(item.createdAt)}</Text>
              <Text style={styles.metaText}>
                Reporter: {item.reporterName || item.reporterEmail || item.reportedByUserId}
              </Text>
              <Text style={styles.metaText}>
                Message owner: {item.reportedName || item.reportedEmail || item.reportedUserId}
              </Text>
              {item.reason ? <Text style={styles.reasonText}>Reason: {item.reason}</Text> : null}
              <View style={styles.messageBox}>
                <Text style={styles.messageText} numberOfLines={4}>
                  {item.messageMissing ? 'Message already removed.' : item.messageBody || '(Image-only message)'}
                </Text>
              </View>

              {item.status === 'open' ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.keepButton, disabled ? styles.buttonDisabled : null]}
                    disabled={disabled}
                    onPress={() => onKeep(item.id)}
                  >
                    <Text style={styles.keepButtonText}>Keep message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteButton, disabled ? styles.buttonDisabled : null]}
                    disabled={disabled}
                    onPress={() => onDeleteMessage(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete message</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Pressable>
          )
        }}
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
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    cardTitle: {
      fontFamily: theme.boldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    cardStatus: {
      fontFamily: theme.boldFont,
      fontSize: 11,
      color: theme.tintColor || '#CBFF00',
    },
    metaText: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 2,
    },
    reasonText: {
      marginTop: 6,
      marginBottom: 6,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.textColor,
    },
    messageBox: {
      marginTop: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    messageText: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.textColor,
      lineHeight: 19,
    },
    actionsRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
    },
    keepButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tintColor || '#CBFF00',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    keepButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: theme.tintColor || '#CBFF00',
    },
    deleteButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 10,
      backgroundColor: '#b71c1c',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: '#ffffff',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  })
