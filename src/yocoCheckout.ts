import { Alert, AppState, Linking, type AppStateStatus } from 'react-native'
import { syncYocoCheckout } from './ordersApi'

/**
 * Hosted Yoco checkout uses card iframes — WebView needs third-party cookies/storage.
 * Do not inject JS into the page; it can break PCI card fields.
 */
export const YOCO_WEBVIEW_PROPS = {
  javaScriptEnabled: true,
  domStorageEnabled: true,
  thirdPartyCookiesEnabled: true,
  sharedCookiesEnabled: true,
  cacheEnabled: true,
  incognito: false,
  autoFillEnabled: false,
  importantForAutofill: 'no' as const,
  textContentType: 'none' as const,
}

export function startYocoPayment(
  orderId: string,
  redirectUrl: string,
  options: {
    onPaid?: () => void
    onPayInApp: () => void
  }
) {
  let appStateSub: { remove: () => void } | null = null
  let syncing = false

  const trySync = () => {
    if (syncing) return
    syncing = true
    void syncYocoCheckout(orderId)
      .then((result) => {
        if (result.status === 'paid' || result.alreadyPaid) {
          appStateSub?.remove()
          appStateSub = null
          options.onPaid?.()
          Alert.alert('Payment confirmed', 'Your order is paid. Thank you!')
        }
      })
      .catch(() => {})
      .finally(() => {
        syncing = false
      })
  }

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') trySync()
  }

  Alert.alert(
    'Card payment',
    'Pay securely with your card. You can complete checkout in the app or in your browser.',
    [
      { text: 'Pay in app', onPress: options.onPayInApp },
      {
        text: 'Pay in browser',
        onPress: () => {
          appStateSub = AppState.addEventListener('change', onAppState)
          void Linking.openURL(redirectUrl)
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  )

  return () => appStateSub?.remove()
}
