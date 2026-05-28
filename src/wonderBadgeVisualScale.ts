import type { WonderBadgeId } from './wonderBadgesCatalog'

/**
 * WonderJump leaderboard SVGs use a tall viewBox with extra transparent padding;
 * raster badges (e.g. heart) fill the slot more — zoom SVGs to match heart on profile.
 */
export function wonderBadgeVisualScale(badgeId: WonderBadgeId): number {
  if (badgeId.startsWith('badge:wj_')) return 1.44
  return 1
}
