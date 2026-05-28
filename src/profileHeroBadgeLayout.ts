import type { ProfileHeroBadgeSlots } from './profileHeroPreferences'

export const PROFILE_HERO_BADGE_SLOT_DEFAULT = 38
export const PROFILE_HERO_BADGE_SLOT_MIN = 24
export const PROFILE_HERO_BADGE_GAP = 6
export const PROFILE_HERO_NAME_TO_BADGES_GAP = 10

export function countEquippedProfileHeroBadges(slots: ProfileHeroBadgeSlots): number {
  return slots.filter(Boolean).length
}

/** Shrink badge tiles so a single-line name fits beside them (never shrink below min). */
export function profileHeroBadgeSlotSize(opts: {
  clusterWidth: number
  nameNaturalWidth: number
  badgeCount: number
}): number {
  const { clusterWidth, nameNaturalWidth, badgeCount } = opts
  if (badgeCount <= 0) return PROFILE_HERO_BADGE_SLOT_DEFAULT
  if (clusterWidth <= 0 || nameNaturalWidth <= 0) return PROFILE_HERO_BADGE_SLOT_DEFAULT

  let slot = PROFILE_HERO_BADGE_SLOT_DEFAULT
  const minSlot = PROFILE_HERO_BADGE_SLOT_MIN

  while (slot > minSlot) {
    const badgesWidth = badgeCount * slot + (badgeCount - 1) * PROFILE_HERO_BADGE_GAP
    const availableForName = clusterWidth - badgesWidth - PROFILE_HERO_NAME_TO_BADGES_GAP
    if (nameNaturalWidth <= availableForName + 0.5) return slot
    slot -= 2
  }

  return minSlot
}
