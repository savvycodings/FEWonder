import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { WonderportAccentCard } from './WonderportAccentCard'
import { getRestockStatus, setRestockNotify } from '../restockApi'

type ProductRestockNotifierProps = {
  productId: string
  sessionToken: string | null
  theme: any
}

export function ProductRestockNotifier({
  productId,
  sessionToken,
  theme,
}: ProductRestockNotifierProps) {
  const navigation = useNavigation<any>()
  const styles = useMemo(() => getStyles(theme), [theme])
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const [loading, setLoading] = useState(Boolean(sessionToken && productId))
  const [busy, setBusy] = useState(false)
  const [notifyOnRestock, setNotifyOnRestock] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!sessionToken || !productId) {
      setNotifyOnRestock(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const state = await getRestockStatus(sessionToken, productId)
      setNotifyOnRestock(Boolean(state.notifyOnRestock))
    } catch (e: any) {
      setError(e?.message || 'Could not load notification status.')
    } finally {
      setLoading(false)
    }
  }, [productId, sessionToken])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleOptIn() {
    if (!sessionToken) {
      navigation.navigate('Login')
      return
    }
    if (!productId || busy) return
    setBusy(true)
    setError('')
    try {
      const state = await setRestockNotify(sessionToken, productId, true)
      setNotifyOnRestock(Boolean(state.notifyOnRestock))
    } catch (e: any) {
      setError(e?.message || 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOptOut() {
    if (!sessionToken || !productId || busy) return
    setBusy(true)
    setError('')
    try {
      const state = await setRestockNotify(sessionToken, productId, false)
      setNotifyOnRestock(Boolean(state.notifyOnRestock))
    } catch (e: any) {
      setError(e?.message || 'Could not remove notification preference.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WonderportAccentCard
      borderWidth={2}
      borderRadius={18}
      innerBackgroundColor={frameFill}
      style={styles.cardOuter}
      contentStyle={styles.cardInner}
    >
      <Text style={styles.title}>Notify me when available again?</Text>
      <Text style={styles.body}>
        We will email you when this item is back in stock. You can remove this alert at any time.
      </Text>

      {!sessionToken ? (
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Sign in to get notified</Text>
        </Pressable>
      ) : loading ? (
        <ActivityIndicator color={theme.brandAccent} style={styles.loader} />
      ) : notifyOnRestock ? (
        <View style={styles.optedInRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>We&apos;ll let you know</Text>
          </View>
          <Pressable
            onPress={() => void handleOptOut()}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeText}>{busy ? 'Saving…' : 'Remove'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.primaryButton, busy ? styles.primaryButtonDisabled : null]}
          onPress={() => void handleOptIn()}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Notify me'}</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </WonderportAccentCard>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    cardOuter: {
      marginTop: 12,
      marginBottom: 4,
    },
    cardInner: {
      padding: 16,
      gap: 10,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: theme.textColor,
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: theme.mutedForegroundColor,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brandAccent,
      marginTop: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#ffffff',
    },
    loader: {
      marginTop: 8,
    },
    optedInRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 4,
    },
    badge: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.tileBorderColor,
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    badgeText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
    },
    removeText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.brandAccent,
    },
    errorText: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.destructiveColor || '#c0392b',
      marginTop: 4,
    },
  })
}
