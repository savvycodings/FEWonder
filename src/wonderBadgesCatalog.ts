/** Stored in `ProfileHeroPreferences.badgeSlots`; maps to `public/homepageimgs/badges/`. */

export const WONDER_BADGE_IDS = [
  'badge:day7',
  'badge:day30',
  'badge:day90',
  'badge:order1',
  'badge:order5',
  'badge:order20',
  'badge:heart',
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
    acquire: 'Reach a 7-day login streak in Daily Rewards and claim the Day 7 reward.',
  },
  'badge:day30': {
    file: 'Day30.png',
    label: '30-day streak',
    acquire: 'Reach a 30-day login streak in Daily Rewards (coming soon to the reward track).',
  },
  'badge:day90': {
    file: 'Day90.png',
    label: '90-day streak',
    acquire: 'Reach a 90-day login streak in Daily Rewards (coming soon to the reward track).',
  },
  'badge:order1': {
    file: 'order1.png',
    label: 'First order',
    acquire: 'Place your first completed order in the app.',
  },
  'badge:order5': {
    file: 'order5.png',
    label: '5 orders',
    acquire: 'Complete 5 orders in total.',
  },
  'badge:order20': {
    file: 'order20.png',
    label: '20 orders',
    acquire: 'Complete 20 orders in total.',
  },
  'badge:heart': {
    file: 'Heartbadge.png',
    label: 'Spread the love!',
    acquire: 'Community badge — share kindness on Wonderport.',
  },
}

export function isWonderBadgeId(id: string): id is WonderBadgeId {
  return (WONDER_BADGE_IDS as readonly string[]).includes(id)
}
