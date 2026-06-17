import { DOMAIN } from '../constants'
import { getAdminOrdersToken } from './ordersApi'

export type RestockNotifyState = {
  productId: number
  notifyOnRestock: boolean
  isSaved: boolean
}

export type AdminNotificationsSummary = {
  pendingCount: number
  sentCount: number
  failedCount: number
  recent: {
    id: string
    userId: string
    productId: number
    status: string
    createdAt: string
    sentAt: string | null
    productTitle: string | null
    userEmail: string | null
  }[]
}

async function parseJson(response: Response) {
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  return { data, raw }
}

export async function getRestockStatus(
  sessionToken: string,
  productId: string,
): Promise<RestockNotifyState> {
  const q = encodeURIComponent(productId)
  const response = await fetch(`${DOMAIN}/auth/notify/restock?productId=${q}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to load restock notification status')
  }
  return data as RestockNotifyState
}

export async function setRestockNotify(
  sessionToken: string,
  productId: string,
  notify: boolean,
): Promise<RestockNotifyState> {
  const response = await fetch(`${DOMAIN}/auth/notify/restock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ productId, notify }),
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to update restock notification preference')
  }
  return data as RestockNotifyState
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
    throw new Error(data?.error || data?.raw || `Request failed (${res.status})`)
  }
  return data
}

export async function getAdminNotifications(): Promise<AdminNotificationsSummary> {
  return adminFetch('/admin/notifications') as Promise<AdminNotificationsSummary>
}

export async function sendPendingNotifications(): Promise<
  AdminNotificationsSummary & { ok: boolean; sent: number; failed: number; skipped: number }
> {
  return adminFetch('/admin/notifications', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<
    AdminNotificationsSummary & { ok: boolean; sent: number; failed: number; skipped: number }
  >
}
