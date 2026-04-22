/** Shared Discord-style profile hero layout (banner + overlapping avatar). */

export const PROFILE_HERO_AVATAR = 96

/** Own-profile hero: slightly smaller than `PROFILE_HERO_AVATAR` so more banner shows above/below the circle. */
export const PROFILE_HERO_PROFILE_AVATAR = 84

/** Banner height; overlap pulls avatar up so ~half the circle sits in purple. */
export const PROFILE_HERO_BANNER_H = 108

/**
 * How far the avatar row is pulled up into the banner (~50% of avatar = banner visually
 * bisects the profile circle). Used by edit + community heroes.
 */
export const PROFILE_HERO_BANNER_OVERLAP_PX = Math.round(PROFILE_HERO_AVATAR * 0.5)

/**
 * Own-profile hero: margin above the name row so it starts at the banner bottom, when the avatar is
 * vertically centered in the banner (same value as padding below avatar inside the banner).
 */
export const PROFILE_HERO_PROFILE_NAME_AFTER_AVATAR_PX = Math.round(
  (PROFILE_HERO_BANNER_H - PROFILE_HERO_PROFILE_AVATAR) / 2
)

/** Extra space below the banner before the display name (own profile + edit preview). */
export const PROFILE_HERO_PROFILE_NAME_BELOW_BANNER_EXTRA_PX = 10

/** Total `marginTop` for the name (+ badges / wallet) row under the centered avatar. */
export const PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP =
  PROFILE_HERO_PROFILE_NAME_AFTER_AVATAR_PX + PROFILE_HERO_PROFILE_NAME_BELOW_BANNER_EXTRA_PX

/**
 * Own-profile hero: pull the grey body up so the avatar is vertically centered in the banner
 * (equal space above and below the circle inside the banner).
 */
export function profileHeroProfileOverlapMarginTop(): number {
  return -Math.round((PROFILE_HERO_BANNER_H + PROFILE_HERO_PROFILE_AVATAR) / 2)
}

/** Pushes wallet + edit controls a bit lower vs the avatar. */
export function profileHeroRightColumnPaddingTop(): number {
  return Math.max(10, Math.round(PROFILE_HERO_AVATAR * 0.18) + 20)
}
