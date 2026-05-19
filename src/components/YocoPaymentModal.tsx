import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { YOCO_WEBVIEW_PROPS } from '../yocoCheckout'

type Props = {
  visible: boolean
  redirectUrl: string | null
  accentColor: string
  /** Server sync after return URL (confirming payment). */
  syncing?: boolean
  onClose: () => void
  onNavigationStateChange?: (navState: { url?: string }) => void
}

/**
 * Full-screen Yoco hosted checkout. Modals ignore parent SafeAreaView — apply insets explicitly.
 */
export function YocoPaymentModal({
  visible,
  redirectUrl,
  accentColor,
  syncing = false,
  onClose,
  onNavigationStateChange,
}: Props) {
  const insets = useSafeAreaInsets()
  const [webViewLoading, setWebViewLoading] = useState(true)
  const showLoading = syncing || (Boolean(redirectUrl) && webViewLoading)

  useEffect(() => {
    if (visible && redirectUrl) setWebViewLoading(true)
  }, [visible, redirectUrl])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={[styles.headerBar, { borderBottomColor: accentColor }]}>
          <Text style={styles.title}>Card payment</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" disabled={syncing}>
            <Text style={[styles.closeText, syncing ? styles.closeTextDisabled : null]}>Close</Text>
          </TouchableOpacity>
        </View>
        {redirectUrl ? (
          <View style={styles.webWrap}>
            <WebView
              originWhitelist={['*']}
              source={{ uri: redirectUrl }}
              onNavigationStateChange={onNavigationStateChange}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => setWebViewLoading(false)}
              style={styles.web}
              {...YOCO_WEBVIEW_PROPS}
              {...(Platform.OS === 'ios'
                ? { contentInsetAdjustmentBehavior: 'automatic' as const }
                : {})}
            />
            {showLoading ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={accentColor} />
                <Text style={styles.loadingText}>
                  {syncing ? 'Confirming payment…' : 'Loading secure checkout…'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    backgroundColor: '#000000',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
  closeTextDisabled: {
    opacity: 0.4,
  },
  webWrap: {
    flex: 1,
    position: 'relative',
  },
  web: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
})
