import { DOMAIN } from '../constants'

/** Extra fields when `GET /auth/community/users/:id/public` exists (not implemented on server yet). */
export type CommunityUserPublicDetail = {
  bio?: string | null
  tagline?: string | null
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
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}
