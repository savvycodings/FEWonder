/** Shared Discord-style profile hero layout (banner + overlapping avatar). */

export const PROFILE_HERO_AVATAR = 96

/** Banner height; overlap pulls avatar up so ~half the circle sits in purple. */
export const PROFILE_HERO_BANNER_H = 108

/**
 * How far the avatar row is pulled up into the banner (~50% of avatar = banner visually
 * bisects the profile circle).
 */
export function profileHeroBannerOverlapPx(): number {
  return Math.round(PROFILE_HERO_AVATAR * 0.5)
}

/** Pushes wallet + edit controls a bit lower vs the avatar. */
export function profileHeroRightColumnPaddingTop(): number {
  return Math.max(10, Math.round(PROFILE_HERO_AVATAR * 0.18) + 20)
}
