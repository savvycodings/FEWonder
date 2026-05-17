import type { DailyRewardStatus } from '../types'
import { WONDER_BADGE_IDS, type WonderBadgeId } from './wonderBadgesCatalog'

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
      return rank !== null && rank <= 100
    case 'badge:wj_top50':
      return rank !== null && rank <= 50
    case 'badge:wj_top10':
      return rank !== null && rank <= 10
    case 'badge:wj_top3':
      return rank !== null && rank <= 3
    case 'badge:wj_top2':
      return rank !== null && rank <= 2
    case 'badge:wj_top1':
      return rank !== null && rank <= 1
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
