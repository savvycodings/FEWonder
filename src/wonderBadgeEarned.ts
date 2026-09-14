import type { DailyRewardStatus } from '../types'
import { WONDER_BADGE_IDS, type WonderBadgeId } from './wonderBadgesCatalog'

/**
 * WonderJump badges are exclusive tiers — only the single matching badge for your rank.
 * Rank 1 → top1 only; 2 → top2 only; 3 → top3 only;
 * 4–10 → top10; 11–50 → top50; 51–100 → top100.
 */
export function isWonderJumpBadgeEarnedForRank(
  id: WonderBadgeId,
  rank: number | null,
): boolean {
  if (rank === null || !Number.isFinite(rank) || rank < 1) return false
  const r = Math.floor(rank)
  switch (id) {
    case 'badge:wj_top1':
      return r === 1
    case 'badge:wj_top2':
      return r === 2
    case 'badge:wj_top3':
      return r === 3
    case 'badge:wj_top10':
      return r >= 4 && r <= 10
    case 'badge:wj_top50':
      return r >= 11 && r <= 50
    case 'badge:wj_top100':
      return r >= 51 && r <= 100
    default:
      return false
  }
}

/** Matches server `userEarnsProfileBadge` / Daily Rewards badge equip rules. */
export function isWonderBadgeEarned(id: WonderBadgeId, status: DailyRewardStatus): boolean {
  const claimedCount = Math.max(0, Math.floor(status.claimedCount || 0))
  const loginStreak =
    typeof status.currentStreakDays === 'number' && Number.isFinite(status.currentStreakDays)
      ? Math.max(0, Math.floor(status.currentStreakDays))
      : 0
  const paid = Math.max(0, Math.floor(status.paidOrderCount || 0))
  const rank =
    typeof status.wonderJumpRank === 'number' &&
    Number.isFinite(status.wonderJumpRank) &&
    status.wonderJumpRank > 0
      ? Math.floor(status.wonderJumpRank)
      : null

  switch (id) {
    case 'badge:heart':
      return true
    case 'badge:day7':
      return loginStreak >= 7 || claimedCount >= 7
    case 'badge:day30':
      return loginStreak >= 30
    case 'badge:day90':
      return loginStreak >= 90
    case 'badge:order1':
      return paid >= 1
    case 'badge:order5':
      return paid >= 5
    case 'badge:order10':
      return paid >= 10
    case 'badge:wj_top100':
    case 'badge:wj_top50':
    case 'badge:wj_top10':
    case 'badge:wj_top3':
    case 'badge:wj_top2':
    case 'badge:wj_top1':
      return isWonderJumpBadgeEarnedForRank(id, rank)
    default:
      return false
  }
}

export function listEarnedWonderBadgeIds(status: DailyRewardStatus): WonderBadgeId[] {
  return WONDER_BADGE_IDS.filter((id) => isWonderBadgeEarned(id, status))
}

/** Badges that can trigger the home gift alert (excludes always-owned community badge). */
export function listNotifiableEarnedWonderBadgeIds(status: DailyRewardStatus): WonderBadgeId[] {
  return listEarnedWonderBadgeIds(status).filter((id) => id !== 'badge:heart')
}
