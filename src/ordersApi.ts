import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { DOMAIN } from '../constants'
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
    throw new Error(data?.error || res.statusText || 'Request failed')
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
    throw new Error(data?.error || res.statusText || 'Request failed')
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

export type CreateOrderPayload = {
  paymentMethod: 'peach' | 'eft'
  items: { productId: string; quantity: number }[]
  deliveryMethod: 'pudo' | 'standard'
  contactPhone: string
  contactEmail?: string
  shippingAddressFull?: string
  shippingAddressLine2?: string
  pudoLockerName?: string
  pudoLockerAddress?: string
  customerEftAccountName?: string
  customerEftBankName?: string
  customerEftAccountNumber?: string
}

export async function createOrder(body: CreateOrderPayload) {
  return userFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{
    orderId: string
    referenceCode: string
    totalCents: number
    currencyCode: string
    paymentMethod: string
    status: string
  }>
}

export async function initPeachCheckout(orderId: string) {
  return userFetch(`/orders/${orderId}/peach/init`, { method: 'POST' }) as Promise<{
    checkoutId: string
    widgetUrl: string
    amount: string
    currency: string
    merchantTransactionId: string
  }>
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
      peachCheckoutId: string | null
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

export async function fetchAdminOrders(paymentMethod: 'peach' | 'eft' | 'all', limit = 50, offset = 0) {
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
