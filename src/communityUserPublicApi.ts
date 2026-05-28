import { DOMAIN } from '../constants'

/** Extra fields when `GET /auth/community/users/:id/public` exists (not implemented on server yet). */
export type CommunityUserPublicDetail = {
  bio?: string | null
  tagline?: string | null
  bannerUrl?: string | null
  badgeSlots?: [string | null, string | null, string | null]
  avatarFrameId?: string | null
  profilePicture?: string | null
}

/**
 * Optional richer community profile from the API. Returns `null` when the route is missing,
 * the user is unknown, or the request fails — the UI should fall back to chat snapshot + stubs.
 */
export async function fetchCommunityUserPublicProfile(
  sessionToken: string,
  userId: string
): Promise<CommunityUserPublicDetail | null> {
  if (!DOMAIN || !sessionToken || !userId) return null
  try {
    const url = `${DOMAIN}/auth/community/users/${encodeURIComponent(userId)}/public`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as CommunityUserPublicDetail
    if (!data || typeof data !== 'object') return null
    const slots = data.badgeSlots
    const badgeSlots: [string | null, string | null, string | null] = Array.isArray(slots)
      ? [
          typeof slots[0] === 'string' ? slots[0] : null,
          typeof slots[1] === 'string' ? slots[1] : null,
          typeof slots[2] === 'string' ? slots[2] : null,
        ]
      : [null, null, null]
    return {
      ...data,
      badgeSlots,
      avatarFrameId:
        typeof data.avatarFrameId === 'string' ? data.avatarFrameId.trim() : null,
      profilePicture:
        typeof data.profilePicture === 'string' && data.profilePicture.trim()
          ? data.profilePicture.trim()
          : null,
      bannerUrl:
        typeof data.bannerUrl === 'string' && data.bannerUrl.trim()
          ? data.bannerUrl.trim()
          : null,
    }
  } catch {
    return null
  }
}
