import AsyncStorage from '@react-native-async-storage/async-storage'
import { DOMAIN } from '../constants'
import EventSource from 'react-native-sse'
import {
  AuthPayload,
  CommunityMessage,
  DailyRewardStatus,
  Model,
  ShopifyProduct,
  User,
} from '../types'

/** Client cache so Daily Rewards streak UI can render immediately; refreshed on each fetch. */
export const DAILY_REWARDS_CACHE_KEY = 'wonderport-daily-rewards-cache-v1'
const DAILY_REWARDS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function readDailyRewardsCache(): Promise<DailyRewardStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_REWARDS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; data?: DailyRewardStatus }
    if (!parsed?.data?.rewards?.length) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > DAILY_REWARDS_CACHE_MAX_AGE_MS)
      return null
    return parsed.data
  } catch {
    return null
  }
}

export async function writeDailyRewardsCache(data: DailyRewardStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_REWARDS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* ignore */
  }
}

export function getEventSource({
  headers,
  body,
  type
} : {
  headers?: any,
  body: any,
  type: string
}) {
  const es = new EventSource(`${DOMAIN}/chat/${type}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    method: 'POST',
    body: JSON.stringify(body),
  })

  return es;
}

export function getFirstNCharsOrLess(text:string, numChars:number = 1000) {
  if (text.length <= numChars) {
    return text;
  }
  return text.substring(0, numChars);
}

export function getFirstN({ messages, size = 10 } : { size?: number, messages: any[] }) {
  if (messages.length > size) {
    const firstN = new Array()
    for(let i = 0; i < size; i++) {
      firstN.push(messages[i])
    }
    return firstN
  } else {
    return messages
  }
}

export function getChatType(type: Model) {
  if (type.label.includes('gpt')) {
    return 'gpt'
  }
  if (type.label.includes('gemini')) {
    return 'gemini'
  }
  else return 'claude'
}

export async function registerUser(payload: {
  fullName: string
  email: string
  password: string
  phone: string
  shippingAddress?: string
  shippingAddressLine2?: string
  pudoLockerName?: string
  pudoLockerAddress?: string
  eftBankAccountName?: string
  eftBankName?: string
  eftBankAccountNumber?: string
  eftBankBranch?: string
}): Promise<AuthPayload> {
  const registerUrl = `${DOMAIN}/auth/register`
  console.log('[auth/register] starting request', {
    domain: DOMAIN,
    url: registerUrl,
    email: payload.email,
    fullNameLength: payload.fullName.length,
    passwordLength: payload.password.length,
  })

  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }

  let response: Response
  try {
    response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (networkError: any) {
    console.log('[auth/register] network error', {
      message: networkError?.message,
      name: networkError?.name,
      stack: networkError?.stack,
    })
    throw networkError
  }

  const rawText = await response.text()
  let data: any = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = { rawText }
  }

  console.log('[auth/register] response received', {
    status: response.status,
    ok: response.ok,
    bodyPreview:
      typeof data?.rawText === 'string'
        ? data.rawText.slice(0, 200)
        : JSON.stringify(data).slice(0, 200),
  })

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create account')
  }

  return {
    user: data.user as User,
    sessionToken: String(data.sessionToken || ''),
  }
}

/** Refreshes the current user from the server (includes phone, delivery fields, etc.). */
export async function fetchSessionUser(sessionToken: string): Promise<User> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const response = await fetch(`${DOMAIN}/auth/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load profile')
  }
  return data.user as User
}

export async function loginUser(payload: {
  email: string
  password: string
}): Promise<AuthPayload> {
  const loginUrl = `${DOMAIN}/auth/login`
  console.log('[auth/login] starting request', {
    domain: DOMAIN,
    url: loginUrl,
    email: payload.email,
    passwordLength: payload.password.length,
  })

  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }

  let response: Response
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (networkError: any) {
    console.log('[auth/login] network error', {
      message: networkError?.message,
      name: networkError?.name,
      stack: networkError?.stack,
    })
    throw networkError
  }

  const rawText = await response.text()
  let data: any = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = { rawText }
  }

  console.log('[auth/login] response received', {
    status: response.status,
    ok: response.ok,
    bodyPreview:
      typeof data?.rawText === 'string'
        ? data.rawText.slice(0, 200)
        : JSON.stringify(data).slice(0, 200),
  })

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to sign in')
  }

  return {
    user: data.user as User,
    sessionToken: String(data.sessionToken || ''),
  }
}

export async function uploadProfilePicture(payload: {
  imageBase64: string
  mimeType: string
  sessionToken: string
}): Promise<User> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }

  const response = await fetch(`${DOMAIN}/auth/profile-picture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify({
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType,
    }),
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  console.log('[auth/profile-picture] response', {
    status: response.status,
    ok: response.ok,
    bodyPreview:
      typeof data?.raw === 'string' ? data.raw.slice(0, 200) : JSON.stringify(data).slice(0, 200),
  })

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to upload profile picture')
  }

  return data.user as User
}

export async function logoutUser(sessionToken: string): Promise<void> {
  if (!DOMAIN) return
  try {
    await fetch(`${DOMAIN}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
  } catch (error) {
    console.log('Failed to logout session on server', error)
  }
}

export async function updateProfileDetails(payload: {
  sessionToken: string
  shippingAddress?: string
  shippingAddressLine2?: string
  phone?: string
  pudoLockerName?: string
  pudoLockerAddress?: string
  eftBankAccountName?: string
  eftBankName?: string
  eftBankAccountNumber?: string
  eftBankBranch?: string
  /** Legacy UI field; server ignores if not mapped. */
  paymentMethod?: string
}): Promise<User> {
  const body: Record<string, string> = {}
  if (payload.shippingAddress !== undefined) body.shippingAddress = payload.shippingAddress
  if (payload.shippingAddressLine2 !== undefined) body.shippingAddressLine2 = payload.shippingAddressLine2
  if (payload.phone !== undefined) body.phone = payload.phone
  if (payload.pudoLockerName !== undefined) body.pudoLockerName = payload.pudoLockerName
  if (payload.pudoLockerAddress !== undefined) body.pudoLockerAddress = payload.pudoLockerAddress
  if (payload.eftBankAccountName !== undefined) body.eftBankAccountName = payload.eftBankAccountName
  if (payload.eftBankName !== undefined) body.eftBankName = payload.eftBankName
  if (payload.eftBankAccountNumber !== undefined) body.eftBankAccountNumber = payload.eftBankAccountNumber
  if (payload.eftBankBranch !== undefined) body.eftBankBranch = payload.eftBankBranch

  const response = await fetch(`${DOMAIN}/auth/profile-details`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to update profile details')
  }
  return data.user as User
}

export async function getDailyRewardStatus(sessionToken: string): Promise<DailyRewardStatus> {
  const response = await fetch(`${DOMAIN}/auth/daily-rewards`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load daily rewards')
  }

  const status = data as DailyRewardStatus
  await writeDailyRewardsCache(status)
  return status
}

export async function claimDailyReward(sessionToken: string): Promise<DailyRewardStatus> {
  const response = await fetch(`${DOMAIN}/auth/daily-rewards/claim`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (response.status === 409 && data?.rewards?.length) {
    const status = data as DailyRewardStatus
    await writeDailyRewardsCache(status)
    return status
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to claim daily reward')
  }

  const status = data as DailyRewardStatus
  await writeDailyRewardsCache(status)
  return status
}

export async function syncEquippedAvatarFrame(
  sessionToken: string,
  avatarFrameId: string
): Promise<void> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const response = await fetch(`${DOMAIN}/auth/avatar-frame`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ avatarFrameId }),
  })
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to sync avatar frame')
  }
}

export async function getCommunityMessages(sessionToken: string): Promise<CommunityMessage[]> {
  const response = await fetch(`${DOMAIN}/community/messages`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load messages')
  }
  return data.messages as CommunityMessage[]
}

export async function sendCommunityMessage(payload: {
  sessionToken: string
  body?: string
  imageBase64?: string
  mimeType?: string
}): Promise<CommunityMessage> {
  const response = await fetch(`${DOMAIN}/community/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify({
      body: payload.body || '',
      imageBase64: payload.imageBase64 || '',
      mimeType: payload.mimeType || 'image/jpeg',
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to send message')
  }
  return data.message as CommunityMessage
}

export async function editCommunityMessage(payload: {
  sessionToken: string
  messageId: string
  body: string
}): Promise<CommunityMessage> {
  const response = await fetch(`${DOMAIN}/community/messages/${payload.messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify({ body: payload.body }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to edit message')
  }
  return data.message as CommunityMessage
}

export async function deleteCommunityMessage(payload: {
  sessionToken: string
  messageId: string
}): Promise<void> {
  const response = await fetch(`${DOMAIN}/community/messages/${payload.messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${payload.sessionToken}`,
    },
  })
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to delete message')
  }
}

export async function listShopifyProducts(params?: {
  first?: number
  query?: string
}): Promise<ShopifyProduct[]> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const first = params?.first ?? 20
  const query = params?.query?.trim() ?? ''
  const url = new URL(`${DOMAIN}/shopify/products`)
  url.searchParams.set('first', String(first))
  if (query) url.searchParams.set('query', query)

  const response = await fetch(url.toString())
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load products')
  }
  return (data.products || []) as ShopifyProduct[]
}

export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const safe = String(handle || '').trim()
  const response = await fetch(`${DOMAIN}/shopify/products/${encodeURIComponent(safe)}`)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load product')
  }
  return data.product as ShopifyProduct
}

export async function listDbProducts(params?: {
  first?: number
  query?: string
}): Promise<ShopifyProduct[]> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const first = params?.first ?? 20
  const query = params?.query?.trim() ?? ''
  const url = new URL(`${DOMAIN}/products`)
  url.searchParams.set('first', String(first))
  if (query) url.searchParams.set('q', query)

  const response = await fetch(url.toString())
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load products')
  }
  return (data.products || []) as ShopifyProduct[]
}
