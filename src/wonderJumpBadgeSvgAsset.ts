import { Image } from 'react-native'
import type { WonderBadgeId } from './wonderBadgesCatalog'

const WJ_BADGE_SVG = {
  Top100: require('../public/homepageimgs/badges/Top100.svg'),
  Top50: require('../public/homepageimgs/badges/Top50.svg'),
  Top10: require('../public/homepageimgs/badges/Top10.svg'),
  Top3: require('../public/homepageimgs/badges/Top3.svg'),
  Top2: require('../public/homepageimgs/badges/Top2.svg'),
  Top1: require('../public/homepageimgs/badges/Top1.svg'),
} as const

const WJ_BADGE_ID_TO_FILE: Partial<Record<WonderBadgeId, keyof typeof WJ_BADGE_SVG>> = {
  'badge:wj_top100': 'Top100',
  'badge:wj_top50': 'Top50',
  'badge:wj_top10': 'Top10',
  'badge:wj_top3': 'Top3',
  'badge:wj_top2': 'Top2',
  'badge:wj_top1': 'Top1',
}

/** Bundled Metro URI — works offline and in production without API static hosting. */
export function wonderJumpBadgeBundledSvgUri(badgeId: WonderBadgeId): string | null {
  const fileKey = WJ_BADGE_ID_TO_FILE[badgeId]
  if (!fileKey) return null
  try {
    const resolved = Image.resolveAssetSource(WJ_BADGE_SVG[fileKey])
    const uri = resolved?.uri
    return uri ? String(uri) : null
  } catch {
    return null
  }
}
