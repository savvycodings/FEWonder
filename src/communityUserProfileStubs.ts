/** Hard-coded demo text keyed by `user.id` when there is no API profile yet. */
export type CommunityUserLocalStub = {
  bio: string
  tagline?: string
}

export const COMMUNITY_USER_PROFILE_STUBS: Record<string, CommunityUserLocalStub> = {
  // Example:
  // '00000000-0000-0000-0000-000000000001': {
  //   bio: 'Loves collecting figures.',
  //   tagline: 'Wonderport regular',
  // },
}

export function getCommunityUserLocalStub(userId: string): CommunityUserLocalStub | null {
  return COMMUNITY_USER_PROFILE_STUBS[userId] ?? null
}

/** Id-based stub first, then a built-in demo match for the display name “Sky” (no id required). */
export function resolveCommunityUserStub(userId: string, fullName: string): CommunityUserLocalStub | null {
  const byId = getCommunityUserLocalStub(userId)
  if (byId) return byId
  if (/^sky$/i.test(fullName.trim())) {
    return {
      tagline: 'Wonderport community',
      bio: 'Here for figures, chat, and drop alerts. Say hi in global.',
    }
  }
  return null
}
