import { useContext, useMemo } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { ThemeContext } from '../context'
import { ProfilePageHeading, ProfileStackBackBar } from '../components'

type RouteParams = {
  referenceCode?: string
  collectStoreName?: string
  collectStoreAddress?: string
  collectorName?: string
}

function splitStoreLabel(raw: string): { name: string; address: string } {
  const full = String(raw || '').trim()
  const comma = full.indexOf(', ')
  if (comma > 0) {
    return {
      name: full.slice(0, comma).trim(),
      address: full.slice(comma + 2).trim(),
    }
  }
  return { name: full || 'your store', address: '' }
}

export function CollectOrderSuccess({ navigation }: { navigation: any }) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const route = useRoute()
  const params = (route.params || {}) as RouteParams
  const referenceCode = String(params.referenceCode || '').trim() || '-'
  const split = splitStoreLabel(String(params.collectStoreName || ''))
  const storeName = split.name
  const storeAddress =
    String(params.collectStoreAddress || '').trim() || split.address
  const collectorName = String(params.collectorName || '').trim() || 'the collector'

  async function copyReference() {
    if (!referenceCode || referenceCode === '-') return
    await Clipboard.setStringAsync(referenceCode)
    Alert.alert('Copied', 'Order number copied.')
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ProfileStackBackBar onBack={() => navigation.navigate('Tabs')} />
        <ProfilePageHeading title="Ready to collect" />
      </SafeAreaView>

      <View style={styles.body}>
        <Text style={styles.lead}>
          Payment successful. Go to the store, give them your name and this order number.
        </Text>

        <Text style={styles.label}>Order number</Text>
        <Pressable onPress={() => void copyReference()} style={styles.refCard}>
          <Text style={styles.refCode}>{referenceCode}</Text>
          <Text style={styles.refHint}>Tap to copy</Text>
        </Pressable>

        <Text style={styles.metaLabel}>Store</Text>
        <Text style={styles.metaValue}>{storeName}</Text>
        {storeAddress ? <Text style={styles.metaAddress}>{storeAddress}</Text> : null}

        <Text style={styles.metaLabel}>Collector</Text>
        <Text style={styles.metaValue}>{collectorName}</Text>

        <Pressable style={styles.doneBtn} onPress={() => navigation.navigate('Tabs')}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  )
}

function getStyles(theme: any) {
  const border = theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.12)'
  const surface = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.backgroundColor },
    safe: { paddingHorizontal: 16 },
    body: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
    lead: {
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
      color: theme.textColor,
      marginBottom: 24,
    },
    label: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 8,
    },
    refCard: {
      borderWidth: 1,
      borderColor: border,
      borderRadius: 14,
      backgroundColor: surface,
      paddingVertical: 18,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginBottom: 22,
    },
    refCode: {
      fontFamily: theme.boldFont,
      fontSize: 26,
      letterSpacing: 0.5,
      color: theme.brandAccent || theme.textColor,
    },
    refHint: {
      marginTop: 6,
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
    },
    metaLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginTop: 8,
    },
    metaValue: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: theme.textColor,
      marginBottom: 2,
    },
    metaAddress: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
      color: theme.mutedForegroundColor,
      marginBottom: 8,
    },
    doneBtn: {
      marginTop: 32,
      backgroundColor: theme.brandAccent || '#111',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    doneText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#fff',
    },
  })
}
