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

export type YocoReturnRoute = 'success' | 'failed' | 'cancelled'

/** Match only our return pages — avoid false positives from unrelated URLs containing "success". */
export function parseYocoReturnRoute(url: string): YocoReturnRoute | null {
  if (!url) return null
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    const match = url.match(/\/payment\/yoco\/(success|failed|cancelled)/i)
    if (match) return match[1].toLowerCase() as YocoReturnRoute
    return null
  }
  if (/\/payment\/yoco\/success\/?$/i.test(path)) return 'success'
  if (/\/payment\/yoco\/failed\/?$/i.test(path)) return 'failed'
  if (/\/payment\/yoco\/cancelled\/?$/i.test(path)) return 'cancelled'
  return null
}

export type YocoFinalizeOutcome = 'paid' | 'pending' | 'failed' | 'cancelled'

export async function finalizeYocoCheckout(orderId: string): Promise<YocoFinalizeOutcome> {
  const result = await syncYocoCheckout(orderId)
  if (result.becamePaid || result.alreadyPaid || result.status === 'paid') {
    return 'paid'
  }
  if (result.yocoStatus === 'cancelled') return 'cancelled'
  if (result.yocoStatus === 'failed' || result.status === 'failed') return 'failed'
  return 'pending'
}

export function yocoOutcomeAlert(outcome: YocoFinalizeOutcome): { title: string; message: string } | null {
  switch (outcome) {
    case 'paid':
      return {
        title: 'Payment complete',
        message: 'Thank you! Your order is paid.',
      }
    case 'cancelled':
      return {
        title: 'Payment cancelled',
        message: 'No charge was made. You can complete payment later from Profile → Orders.',
      }
    case 'failed':
      return {
        title: 'Payment not completed',
        message: 'The card payment did not go through. You can try again from Profile → Orders.',
      }
    case 'pending':
      return {
        title: 'Payment not completed',
        message:
          'We have not confirmed your payment yet. Your order stays pending — you can try again from Profile → Orders.',
      }
    default:
      return null
  }
}
