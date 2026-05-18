import {
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
  onClose,
  onNavigationStateChange,
}: Props) {
  const insets = useSafeAreaInsets()

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
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        {redirectUrl ? (
          <WebView
            originWhitelist={['*']}
            source={{ uri: redirectUrl }}
            onNavigationStateChange={onNavigationStateChange}
            style={styles.web}
            {...YOCO_WEBVIEW_PROPS}
            {...(Platform.OS === 'ios'
              ? { contentInsetAdjustmentBehavior: 'automatic' as const }
              : {})}
          />
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
  web: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
})
