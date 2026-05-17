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
  WonderJumpChestClaimResult,
  WonderJumpLeaderboardEntry,
  WonderJumpProgress,
} from '../types'

/** Client cache so Daily Rewards streak UI can render immediately; refreshed on each fetch. */
export const DAILY_REWARDS_CACHE_KEY = 'wonderport-daily-rewards-cache-v1'
const DAILY_REWARDS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** IANA timezone from the device (sent on daily-rewards requests for local-day rules). */
export function getDeviceIanaTimeZone(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof z === 'string' && z.trim() ? z.trim() : 'UTC'
  } catch {
    return 'UTC'
  }
}

function dailyRewardsAuthHeaders(sessionToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    'X-User-Timezone': getDeviceIanaTimeZone(),
  }
}

export function normalizeDailyRewardStatus(status: DailyRewardStatus): void {
  if (!Array.isArray(status.ownedStoreItemIds)) {
    status.ownedStoreItemIds = []
  }
  if (typeof status.paidOrderCount !== 'number' || !Number.isFinite(status.paidOrderCount)) {
    status.paidOrderCount = 0
  }
  if (typeof status.currentStreakDays !== 'number' || !Number.isFinite(status.currentStreakDays)) {
    status.currentStreakDays = 0
  }
  if (typeof status.wonderJumpRank !== 'number' || !Number.isFinite(status.wonderJumpRank) || status.wonderJumpRank <= 0) {
    status.wonderJumpRank = null
  } else {
    status.wonderJumpRank = Math.floor(status.wonderJumpRank)
  }
}

export async function readDailyRewardsCache(): Promise<DailyRewardStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_REWARDS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; data?: DailyRewardStatus }
    if (!parsed?.data?.rewards?.length) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > DAILY_REWARDS_CACHE_MAX_AGE_MS)
      return null
    const data = parsed.data
    normalizeDailyRewardStatus(data)
    return data
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
  shippingPostalCode?: string
  shippingCity?: string
  shippingProvince?: string
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
  fullName?: string
  email?: string
  shippingAddress?: string
  shippingAddressLine2?: string
  shippingPostalCode?: string
  shippingCity?: string
  shippingProvince?: string
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
  if (payload.fullName !== undefined) body.fullName = payload.fullName
  if (payload.email !== undefined) body.email = payload.email
  if (payload.shippingAddress !== undefined) body.shippingAddress = payload.shippingAddress
  if (payload.shippingAddressLine2 !== undefined) body.shippingAddressLine2 = payload.shippingAddressLine2
  if (payload.shippingPostalCode !== undefined) body.shippingPostalCode = payload.shippingPostalCode
  if (payload.shippingCity !== undefined) body.shippingCity = payload.shippingCity
  if (payload.shippingProvince !== undefined) body.shippingProvince = payload.shippingProvince
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

export async function changePassword(payload: {
  sessionToken: string
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}): Promise<void> {
  const response = await fetch(`${DOMAIN}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify({
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
      confirmNewPassword: payload.confirmNewPassword,
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to change password')
  }
}

export async function requestForgotPasswordOtp(email: string): Promise<{ devHint?: string }> {
  const response = await fetch(`${DOMAIN}/auth/forgot-password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to send verification code')
  }
  return { devHint: typeof data.devHint === 'string' ? data.devHint : undefined }
}

export async function verifyForgotPasswordOtp(email: string, otp: string): Promise<void> {
  const response = await fetch(`${DOMAIN}/auth/forgot-password/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Invalid verification code')
  }
}

export async function resetPasswordWithOtp(payload: {
  email: string
  otp: string
  newPassword: string
  confirmNewPassword: string
}): Promise<void> {
  const response = await fetch(`${DOMAIN}/auth/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      otp: payload.otp.trim(),
      newPassword: payload.newPassword,
      confirmNewPassword: payload.confirmNewPassword,
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to reset password')
  }
}

export async function getDailyRewardStatus(sessionToken: string): Promise<DailyRewardStatus> {
  const response = await fetch(`${DOMAIN}/auth/daily-rewards`, {
    headers: dailyRewardsAuthHeaders(sessionToken),
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
  normalizeDailyRewardStatus(status)
  await writeDailyRewardsCache(status)
  return status
}

export async function claimDailyReward(sessionToken: string): Promise<DailyRewardStatus> {
  const response = await fetch(`${DOMAIN}/auth/daily-rewards/claim`, {
    method: 'POST',
    headers: dailyRewardsAuthHeaders(sessionToken),
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
    normalizeDailyRewardStatus(status)
    await writeDailyRewardsCache(status)
    return status
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to claim daily reward')
  }

  const status = data as DailyRewardStatus
  normalizeDailyRewardStatus(status)
  await writeDailyRewardsCache(status)
  return status
}

/** Public: no auth. Returns display high scores saved from WonderJump runs. */
export async function fetchWonderJumpLeaderboard(limit = 50): Promise<WonderJumpLeaderboardEntry[]> {
  const safe = Math.min(100, Math.max(1, Math.floor(limit)))
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-leaderboard?limit=${encodeURIComponent(String(safe))}`)
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load leaderboard')
  }
  const entries = Array.isArray(data.entries) ? data.entries : []
  const out: WonderJumpLeaderboardEntry[] = []
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const userId = typeof (e as any).userId === 'string' ? (e as any).userId : ''
    const username = typeof (e as any).username === 'string' ? (e as any).username : 'Player'
    const score = typeof (e as any).score === 'number' && Number.isFinite((e as any).score) ? (e as any).score : 0
    if (!userId) continue
    out.push({ userId, username, score })
  }
  return out
}

export async function fetchWonderJumpProgress(sessionToken: string): Promise<WonderJumpProgress> {
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-progress`, {
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
    throw new Error(data?.error || 'Unable to load WonderJump progress')
  }

  const highScore = typeof data.highScore === 'number' && Number.isFinite(data.highScore) ? data.highScore : 0
  const unlockedBiomes = Array.isArray(data.unlockedBiomes)
    ? data.unlockedBiomes.filter((x: unknown) => typeof x === 'string')
    : []
  const chestDocked = data.chestDocked === true
  const chestUnlocksAt =
    typeof data.chestUnlocksAt === 'string' && data.chestUnlocksAt.length > 0 ? data.chestUnlocksAt : null
  return { highScore, unlockedBiomes, chestDocked, chestUnlocksAt }
}

export async function saveWonderJumpProgress(
  sessionToken: string,
  payload: { highScore?: number; unlockedBiomes?: string[] }
): Promise<WonderJumpProgress> {
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-progress`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to save WonderJump progress')
  }

  const highScore = typeof data.highScore === 'number' && Number.isFinite(data.highScore) ? data.highScore : 0
  const unlockedBiomes = Array.isArray(data.unlockedBiomes)
    ? data.unlockedBiomes.filter((x: unknown) => typeof x === 'string')
    : []
  const chestDocked = data.chestDocked === true
  const chestUnlocksAt =
    typeof data.chestUnlocksAt === 'string' && data.chestUnlocksAt.length > 0 ? data.chestUnlocksAt : null
  return { highScore, unlockedBiomes, chestDocked, chestUnlocksAt }
}

export async function pickupWonderJumpChest(sessionToken: string): Promise<WonderJumpProgress> {
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-chest/pickup`, {
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
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to pick up chest')
  }
  const highScore = typeof data.highScore === 'number' && Number.isFinite(data.highScore) ? data.highScore : 0
  const unlockedBiomes = Array.isArray(data.unlockedBiomes)
    ? data.unlockedBiomes.filter((x: unknown) => typeof x === 'string')
    : []
  const chestDocked = data.chestDocked === true
  const chestUnlocksAt =
    typeof data.chestUnlocksAt === 'string' && data.chestUnlocksAt.length > 0 ? data.chestUnlocksAt : null
  return { highScore, unlockedBiomes, chestDocked, chestUnlocksAt }
}

export async function startWonderJumpChestOpen(sessionToken: string): Promise<WonderJumpProgress> {
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-chest/start`, {
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
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to start chest timer')
  }
  const highScore = typeof data.highScore === 'number' && Number.isFinite(data.highScore) ? data.highScore : 0
  const unlockedBiomes = Array.isArray(data.unlockedBiomes)
    ? data.unlockedBiomes.filter((x: unknown) => typeof x === 'string')
    : []
  const chestDocked = data.chestDocked === true
  const chestUnlocksAt =
    typeof data.chestUnlocksAt === 'string' && data.chestUnlocksAt.length > 0 ? data.chestUnlocksAt : null
  return { highScore, unlockedBiomes, chestDocked, chestUnlocksAt }
}

export async function claimWonderJumpChest(sessionToken: string): Promise<WonderJumpChestClaimResult> {
  const response = await fetch(`${DOMAIN}/auth/wonder-jump-chest/claim`, {
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
  if (response.ok && data.ok === true) {
    const wonderCoins =
      typeof data.wonderCoins === 'number' && Number.isFinite(data.wonderCoins) ? data.wonderCoins : 0
    return { ok: true, wonderCoins, chestUnlocksAt: null }
  }
  if (response.status === 409) {
    return {
      ok: false,
      error: String(data?.error || 'Chest is still opening'),
      chestUnlocksAt: typeof data.chestUnlocksAt === 'string' ? data.chestUnlocksAt : undefined,
      msRemaining: typeof data.msRemaining === 'number' ? data.msRemaining : undefined,
    }
  }
  return {
    ok: false,
    error: String(data?.error || 'Unable to claim chest'),
  }
}

export async function purchaseWonderStoreItem(
  sessionToken: string,
  itemId: string
): Promise<DailyRewardStatus> {
  const response = await fetch(`${DOMAIN}/auth/wonder-store/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...dailyRewardsAuthHeaders(sessionToken),
    },
    body: JSON.stringify({ itemId }),
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (response.status === 409 && data?.rewards?.length) {
    // "Already purchased" is a valid owned state; return fresh status so UI can switch to Equip.
    const status = data as DailyRewardStatus
    normalizeDailyRewardStatus(status)
    await writeDailyRewardsCache(status)
    return status
  }

  if (response.status === 402 && data?.rewards?.length) {
    const status = data as DailyRewardStatus
    normalizeDailyRewardStatus(status)
    await writeDailyRewardsCache(status)
    throw new Error(String(data?.error || 'Not enough coins'))
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to purchase')
  }

  const status = data as DailyRewardStatus
  normalizeDailyRewardStatus(status)
  await writeDailyRewardsCache(status)
  return status
}

export async function redeemWonderCode(
  sessionToken: string,
  code: string
): Promise<{ wonderCoins: number; message: string }> {
  const response = await fetch(`${DOMAIN}/auth/redeem-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ code }),
  })

  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Unable to redeem code')
  }

  return {
    wonderCoins: Number(data?.wonderCoins) || 0,
    message: String(data?.message || 'Code redeemed.'),
  }
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

function normalizeHeroBadgeSlots(raw: unknown): [string | null, string | null, string | null] {
  if (!Array.isArray(raw)) return [null, null, null]
  const next = raw.slice(0, 3).map((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
  while (next.length < 3) next.push(null)
  return [next[0], next[1], next[2]] as [string | null, string | null, string | null]
}

export async function getProfileHero(sessionToken: string): Promise<{
  bannerUrl: string | null
  badgeSlots: [string | null, string | null, string | null]
}> {
  const response = await fetch(`${DOMAIN}/auth/profile-hero`, {
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
    throw new Error(data?.error || data?.raw || 'Unable to load profile hero')
  }
  return {
    bannerUrl: typeof data?.bannerUrl === 'string' && data.bannerUrl.trim() ? data.bannerUrl.trim() : null,
    badgeSlots: normalizeHeroBadgeSlots(data?.badgeSlots),
  }
}

export async function updateProfileHero(
  sessionToken: string,
  payload: {
    bannerUrl?: string | null
    badgeSlots?: [string | null, string | null, string | null]
  }
): Promise<{
  bannerUrl: string | null
  badgeSlots: [string | null, string | null, string | null]
}> {
  const body: Record<string, unknown> = {}
  if (payload.bannerUrl !== undefined) body.bannerUrl = payload.bannerUrl
  if (payload.badgeSlots !== undefined) body.badgeSlots = payload.badgeSlots
  const response = await fetch(`${DOMAIN}/auth/profile-hero`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to update profile hero')
  }
  return {
    bannerUrl: typeof data?.bannerUrl === 'string' && data.bannerUrl.trim() ? data.bannerUrl.trim() : null,
    badgeSlots: normalizeHeroBadgeSlots(data?.badgeSlots),
  }
}

export async function uploadProfileBanner(payload: {
  sessionToken: string
  imageBase64: string
  mimeType: string
}): Promise<{ bannerUrl: string | null }> {
  const response = await fetch(`${DOMAIN}/auth/profile-banner`, {
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
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to upload profile banner')
  }
  return {
    bannerUrl: typeof data?.bannerUrl === 'string' && data.bannerUrl.trim() ? data.bannerUrl.trim() : null,
  }
}

export async function reportCommunityMessage(payload: {
  sessionToken: string
  messageId: string
  reason?: string
}): Promise<void> {
  const response = await fetch(`${DOMAIN}/community/messages/${payload.messageId}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.sessionToken}`,
    },
    body: JSON.stringify({ reason: payload.reason || '' }),
  })
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to report message')
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

export type ShopifyCollectionSummary = {
  id: string
  title: string
  handle: string
  imageUrl: string | null
}

export type DbCategoryWithProductsResponse = {
  category: {
    shopifyId: string
    handle: string
    title: string
    imageUrl: string | null
    description: string | null
  }
  products: ShopifyProduct[]
}

export async function listShopifyCollectionsByIds(ids: string[]): Promise<ShopifyCollectionSummary[]> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const safeIds = Array.from(
    new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))
  )
  if (!safeIds.length) return []

  const url = new URL(`${DOMAIN}/shopify/collections/by-ids`)
  url.searchParams.set('ids', safeIds.join(','))
  const response = await fetch(url.toString())
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load collections')
  }
  return (data.collections || []) as ShopifyCollectionSummary[]
}

export async function getDbCategoryBySlug(slug: string): Promise<DbCategoryWithProductsResponse> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const safeSlug = String(slug || '').trim()
  const response = await fetch(`${DOMAIN}/categories/${encodeURIComponent(safeSlug)}`)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load category')
  }
  return data as DbCategoryWithProductsResponse
}

export type DbCategorySummary = {
  shopifyId: string
  handle: string
  title: string
  imageUrl: string | null
  productCount: number
}

/** Catalogue collections from Postgres (for matching home chips to real category handles). */
export async function listDbCategories(): Promise<DbCategorySummary[]> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const response = await fetch(`${DOMAIN}/categories`)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load categories')
  }
  return (data.categories || []) as DbCategorySummary[]
}

export async function listDbProducts(params?: {
  first?: number
  query?: string
  /** `new` = newest `created_at`; omit/`updated` style = `updated_at` (fresh catalogue edits). */
  sort?: 'new'
  /** Collection `handle` from `collections` table — filters via `collection_products`. */
  collection?: string
}): Promise<ShopifyProduct[]> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const first = params?.first ?? 20
  const query = params?.query?.trim() ?? ''
  const collection = params?.collection?.trim() ?? ''
  const url = new URL(`${DOMAIN}/products`)
  url.searchParams.set('first', String(first))
  if (query) url.searchParams.set('q', query)
  if (params?.sort === 'new') url.searchParams.set('sort', 'new')
  if (collection) url.searchParams.set('collection', collection)

  const response = await fetch(url.toString())
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load products')
  }
  return (data.products || []) as ShopifyProduct[]
}

export async function getDbProductByHandle(handle: string): Promise<ShopifyProduct> {
  if (!DOMAIN) {
    throw new Error('API domain is not configured. Set EXPO_PUBLIC_DEV_API_URL.')
  }
  const safe = String(handle || '').trim()
  const response = await fetch(`${DOMAIN}/products/${encodeURIComponent(safe)}`)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to load product')
  }
  return data.product as ShopifyProduct
}
