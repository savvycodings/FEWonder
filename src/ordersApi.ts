import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { DOMAIN } from '../constants'

function yocoReturnBaseUrl(): string {
  return DOMAIN || ''
}
import type { AuthPayload } from '../types'

const ADMIN_JWT_KEY = 'wonderport-admin-orders-jwt'

export async function getUserSessionToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('wonderport-auth')
    if (!raw) return null
    const p = JSON.parse(raw) as AuthPayload
    return p?.sessionToken || null
  } catch {
    return null
  }
}

export async function setAdminOrdersToken(token: string | null) {
  if (token) {
    await SecureStore.setItemAsync(ADMIN_JWT_KEY, token)
  } else {
    try {
      await SecureStore.deleteItemAsync(ADMIN_JWT_KEY)
    } catch {
      /* key may not exist */
    }
  }
}

export async function getAdminOrdersToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ADMIN_JWT_KEY)
  } catch {
    return null
  }
}

async function userFetch(path: string, init: RequestInit = {}) {
  const token = await getUserSessionToken()
  if (!token) throw new Error('Not signed in')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  }
  const res = await fetch(`${DOMAIN}${path}`, { ...init, headers })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(parseApiError(data, res))
  }
  return data
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const token = await getAdminOrdersToken()
  if (!token) throw new Error('Admin not signed in')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  }
  const res = await fetch(`${DOMAIN}${path}`, { ...init, headers })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(parseApiError(data, res))
  }
  return data
}

export async function fetchEftInstructions() {
  const res = await fetch(`${DOMAIN}/orders/eft-instructions`)
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Failed to load bank details')
  return data as {
    accountName: string
    accountNumber: string
    bank: string
    branch: string
    message: string
  }
}

function coerceOrderInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10)
    if (Number.isFinite(n)) return Math.max(0, n)
  }
  return 0
}

function parseApiError(data: any, res: Response): string {
  const parts = [data?.error, data?.detail].filter((x) => typeof x === 'string' && x.trim())
  if (parts.length) return parts.join(' — ')
  if (res.statusText?.trim()) return res.statusText.trim()
  return `Request failed (${res.status})`
}

function normalizeOrderQuote(data: any): OrderQuoteResult {
  return {
    subtotalCents: coerceOrderInt(data?.subtotalCents),
    discountCents: coerceOrderInt(data?.discountCents),
    wonderCoinsRedeemed: coerceOrderInt(data?.wonderCoinsRedeemed),
    wonderCoinsEarned: coerceOrderInt(data?.wonderCoinsEarned),
    shippingCents: coerceOrderInt(data?.shippingCents),
    totalCents: coerceOrderInt(data?.totalCents),
    freeDelivery: data?.freeDelivery === true,
    maxRedeemableCoins: coerceOrderInt(data?.maxRedeemableCoins),
    walletBalance: coerceOrderInt(data?.walletBalance),
    currency: typeof data?.currency === 'string' ? data.currency : 'ZAR',
  }
}

export type CreateOrderPayload = {
  paymentMethod: 'yoco' | 'eft'
  items: { productId: string; quantity: number; packaging?: 'single' | 'set' }[]
  deliveryMethod?: 'pudo'
  pudoLockerTier: 'locker' | 'door'
  contactPhone: string
  contactEmail?: string
  pudoLockerName?: string
  pudoLockerAddress?: string
  shippingAddress?: string
  shippingAddressLine2?: string
  shippingPostalCode?: string
  shippingCity?: string
  shippingProvince?: string
  customerEftAccountName?: string
  customerEftBankName?: string
  customerEftAccountNumber?: string
  wonderCoinsToRedeem?: number
}

export type OrderQuoteResult = {
  subtotalCents: number
  discountCents: number
  wonderCoinsRedeemed: number
  wonderCoinsEarned: number
  shippingCents: number
  totalCents: number
  freeDelivery: boolean
  maxRedeemableCoins: number
  walletBalance: number
  currency: string
}

export type QuoteOrderPayload = {
  items: { productId: string; quantity: number; packaging?: 'single' | 'set' }[]
  pudoLockerTier: 'locker' | 'door'
  wonderCoinsToRedeem?: number
}

export async function quoteOrder(body: QuoteOrderPayload) {
  if (!DOMAIN?.trim()) {
    throw new Error(
      'API domain is not configured. Set EXPO_PUBLIC_PROD_API_URL for production builds.',
    )
  }
  const token = await getUserSessionToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${DOMAIN}/orders/quote`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(parseApiError(data, res))
  }
  return normalizeOrderQuote(data)
}

export async function createOrder(body: CreateOrderPayload) {
  return userFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{
    orderId: string
    referenceCode: string
    subtotalCents: number
    discountCents: number
    wonderCoinsRedeemed: number
    wonderCoinsEarned: number
    shippingCents: number
    totalCents: number
    currencyCode: string
    paymentMethod: string
    status: string
  }>
}

export async function initYocoCheckout(orderId: string) {
  return userFetch(`/orders/${orderId}/yoco/init`, {
    method: 'POST',
    body: JSON.stringify({ returnBaseUrl: yocoReturnBaseUrl() }),
  }) as Promise<{
    checkoutId: string
    redirectUrl: string
    amount: string
    currency: string
    referenceCode: string
    processingMode?: string
  }>
}

export async function syncYocoCheckout(orderId: string) {
  return userFetch(`/orders/${orderId}/yoco/sync`, { method: 'POST' }) as Promise<{
    ok: boolean
    status: string
    alreadyPaid?: boolean
    pending?: boolean
    yocoStatus?: string
    becamePaid?: boolean
  }>
}

/** Drop an incomplete checkout (card not paid, or EFT closed without proof). */
export async function abandonOrder(orderId: string) {
  return userFetch(`/orders/${encodeURIComponent(orderId)}/abandon`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; alreadyCancelled?: boolean }>
}

export async function uploadEftProof(orderId: string, imageBase64: string, mimeType: string, note?: string) {
  return userFetch(`/orders/${orderId}/eft-proof`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType, note: note || '' }),
  }) as Promise<{ ok: boolean; proofUrl?: string }>
}

export async function fetchMyOrders() {
  return userFetch('/orders/mine') as Promise<{
    orders: {
      id: string
      referenceCode: string
      status: string
      paymentMethod: string
      currencyCode: string
      totalCents: number
      createdAt: string
      /** First purchased line item image (when stored on the order). */
      previewImageUrl?: string | null
    }[]
  }>
}

export async function fetchMyOrder(orderId: string) {
  return userFetch(`/orders/${encodeURIComponent(orderId)}`) as Promise<{
    order: {
      id: string
      referenceCode: string
      status: string
      paymentMethod: string
      currencyCode: string
      subtotalCents: number
      shippingCents: number
      totalCents: number
      shippingSnapshot: { name: string | null; line1: string | null; line2: string | null }
      yocoCheckoutId: string | null
      eftProofImageUrl: string | null
      eftCustomerNote: string | null
      createdAt: string
    }
    lineItems: {
      id: string
      title: string
      quantity: number
      unitPriceCents: number
      lineTotalCents: number
      currencyCode: string
    }[]
  }>
}

export async function adminOrdersLogin(password: string) {
  const res = await fetch(`${DOMAIN}/admin/orders/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await res.json()
  if (!res.ok) {
    const parts = [data?.error, data?.detail].filter(Boolean)
    throw new Error(parts.join('\n\n') || 'Login failed')
  }
  const token = data.adminToken as string
  await setAdminOrdersToken(token)
  return data as { adminToken: string; expiresInSeconds: number }
}

export async function adminLogout() {
  await setAdminOrdersToken(null)
}

export type AdminCommunityReport = {
  id: string
  messageId: string
  reportedByUserId: string
  reportedUserId: string
  reason: string | null
  status: 'open' | 'resolved'
  createdAt: string
  resolvedAt: string | null
  messageBody: string
  messageImageUrl: string | null
  messageMissing: boolean
  reporterName: string | null
  reporterEmail: string | null
  reportedName: string | null
  reportedEmail: string | null
}

export async function fetchAdminOrders(paymentMethod: 'yoco' | 'eft' | 'all', limit = 50, offset = 0) {
  const q =
    paymentMethod === 'all'
      ? `?limit=${limit}&offset=${offset}`
      : `?paymentMethod=${paymentMethod}&limit=${limit}&offset=${offset}`
  return adminFetch(`/admin/orders${q}`) as Promise<{
    orders: {
      id: string
      referenceCode: string
      status: string
      paymentMethod: string
      currencyCode: string
      totalCents: number
      createdAt: string
      userId: string
      userEmail: string | null
      userName: string | null
    }[]
  }>
}

export async function fetchAdminCommunityReports(
  status: 'open' | 'resolved' | 'all' = 'open',
  limit = 100
) {
  const q = `?status=${encodeURIComponent(status)}&limit=${Math.max(1, Math.min(200, limit))}`
  return adminFetch(`/admin/community/reports${q}`) as Promise<{
    reports: AdminCommunityReport[]
  }>
}

export async function dismissAdminCommunityReport(reportId: string) {
  return adminFetch(`/admin/community/reports/${encodeURIComponent(reportId)}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean }>
}

export async function deleteAdminReportedCommunityMessage(reportId: string) {
  return adminFetch(`/admin/community/reports/${encodeURIComponent(reportId)}/delete-message`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; deleted: boolean }>
}

export async function fetchAdminUserOrders(userId: string) {
  return adminFetch(`/admin/users/${encodeURIComponent(userId)}/orders`) as Promise<{
    user: {
      id: string
      email: string | null
      name: string | null
      image: string | null
      shippingAddress1: string | null
      shippingAddress2: string | null
      createdAt: string
    }
    orders: {
      id: string
      referenceCode: string
      status: string
      paymentMethod: string
      currencyCode: string
      totalCents: number
      createdAt: string
    }[]
  }>
}

export async function fetchAdminOrderDetail(orderId: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(orderId)}`) as Promise<{
    order: Record<string, unknown>
    user: Record<string, unknown>
    lineItems: unknown[]
    paymentEvents: unknown[]
  }>
}

export async function acceptAdminEftPayment(orderId: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/accept-eft`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    alreadyPaid?: boolean
    status?: string
    message?: string
  }>
}

/** Admin: pull catalog + stock from Shopify into the API database. */
export async function adminSyncShopifyCatalog() {
  return adminFetch('/admin/shopify/sync-catalog', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    products: number
    variants: number
    message?: string
    detail?: string
  }>
}

/** Paid order only: mark as physically sold and reduce local + Shopify stock. */
export async function markAdminOrderSold(orderId: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/mark-sold`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    alreadySold?: boolean
    soldAt?: string
    message?: string
  }>
}

/** Paid order only: ask ShipLogic to create shipment / waybill (Pudo or door). */
export async function adminBookCourier(orderId: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/book-courier`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    alreadyBooked?: boolean
    message?: string
    tcgShipmentId?: string | null
    tcgShortTrackingReference?: string | null
    tcgCustomTrackingReference?: string | null
    tcgShipmentStatus?: string | null
    tcgLastError?: string | null
  }>
}
