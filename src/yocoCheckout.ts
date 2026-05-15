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

  const trySync = (manual = false) => {
    if (syncing) return
    syncing = true
    void syncYocoCheckout(orderId)
      .then((result) => {
        if (result.status === 'paid' || result.alreadyPaid) {
          appStateSub?.remove()
          appStateSub = null
          options.onPaid?.()
          Alert.alert('Payment confirmed', 'Your order is paid. Thank you!')
          return
        }
        if (manual) {
          const yocoStatus = result.yocoStatus ? `Yoco status: ${result.yocoStatus}. ` : ''
          Alert.alert(
            result.pending ? 'Payment not finished yet' : 'Not paid yet',
            `${yocoStatus}If you saw a card error on Yoco, that is not caused by the webhook secret — contact Yoco support or try the test keys from developer.yoco.com/docs/checkout-api/testing.`,
          )
        }
      })
      .catch((e: unknown) => {
        if (manual) {
          const msg = e instanceof Error ? e.message : 'Could not reach the server'
          Alert.alert('Check failed', msg)
        }
      })
      .finally(() => {
        syncing = false
      })
  }

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') trySync()
  }

  Alert.alert(
    'Card payment',
    'Open Yoco in your phone browser. Tap Card (not Google Pay) and copy the orange test box exactly: 4111 1111 1111 1111, expiry 01/30, CVC 123.\n\nEmpty webhook secret does NOT block payment — it only means we confirm via “Check status” until you add a webhook.',
    [
      {
        text: 'Open browser',
        onPress: () => {
          appStateSub = AppState.addEventListener('change', onAppState)
          void Linking.openURL(redirectUrl)
        },
      },
      { text: 'Check status', onPress: () => trySync(true) },
      { text: 'Pay in app', onPress: options.onPayInApp },
      { text: 'Cancel', style: 'cancel' },
    ]
  )

  return () => appStateSub?.remove()
}
