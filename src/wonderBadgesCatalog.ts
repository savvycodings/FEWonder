/** Stored in `ProfileHeroPreferences.badgeSlots`; maps to `public/homepageimgs/badges/`. */

export const WONDER_BADGE_IDS = [
  'badge:day7',
  'badge:day30',
  'badge:day90',
  'badge:order1',
  'badge:order5',
  'badge:order10',
  'badge:heart',
  'badge:wj_top100',
  'badge:wj_top50',
  'badge:wj_top10',
  'badge:wj_top3',
  'badge:wj_top2',
  'badge:wj_top1',
] as const

export type WonderBadgeId = (typeof WONDER_BADGE_IDS)[number]

export type WonderBadgeCatalogEntry = {
  file: string
  label: string
  /** Shown under the badge in Wonder Store. */
  acquire: string
}

export const WONDER_BADGE_CATALOG: Record<WonderBadgeId, WonderBadgeCatalogEntry> = {
  'badge:day7': {
    file: 'Day7.png',
    label: '7-day streak',
    acquire: 'Claim all 7 daily rewards by keeping your streak alive.',
  },
  'badge:day30': {
    file: 'Day30.png',
    label: '30-day streak',
    acquire: 'Log in for 30 days in a row.',
  },
  'badge:day90': {
    file: 'Day90.png',
    label: '90-day streak',
    acquire: 'Log in for 90 days in a row.',
  },
  'badge:order1': {
    file: 'order1.png',
    label: 'Bronze box',
    acquire: 'Earned after 1 completed order.',
  },
  'badge:order5': {
    file: 'order5.png',
    label: 'Silver box',
    acquire: 'Earned after 5 completed orders.',
  },
  'badge:order10': {
    file: 'order20.png',
    label: 'Gold box',
    acquire: 'Earned after 10 completed orders.',
  },
  'badge:heart': {
    file: 'Heartbadge.png',
    label: 'Spread the love!',
    acquire: 'Community badge for kindness on Wonderport.',
  },
  'badge:wj_top100': {
    file: 'Top100.svg',
    label: 'WonderJump top 100',
    acquire: 'Reach top 100 on the WonderJump leaderboard.',
  },
  'badge:wj_top50': {
    file: 'Top50.svg',
    label: 'WonderJump top 50',
    acquire: 'Reach top 50 on the WonderJump leaderboard.',
  },
  'badge:wj_top10': {
    file: 'Top10.svg',
    label: 'WonderJump top 10',
    acquire: 'Reach top 10 on the WonderJump leaderboard.',
  },
  'badge:wj_top3': {
    file: 'Top3.svg',
    label: 'WonderJump top 3',
    acquire: 'Reach top 3 on the WonderJump leaderboard.',
  },
  'badge:wj_top2': {
    file: 'Top2.svg',
    label: 'WonderJump top 2',
    acquire: 'Reach rank #2 on the WonderJump leaderboard.',
  },
  'badge:wj_top1': {
    file: 'Top1.svg',
    label: 'WonderJump champion',
    acquire: 'Reach rank #1 on the WonderJump leaderboard.',
  },
}

export function isWonderBadgeId(id: string): id is WonderBadgeId {
  return (WONDER_BADGE_IDS as readonly string[]).includes(id)
}

/** Normalize legacy gold badge id from older app versions. */
export function migrateWonderBadgeSlotId(id: string | null): string | null {
  if (!id) return null
  return id === 'badge:order20' ? 'badge:order10' : id
}
