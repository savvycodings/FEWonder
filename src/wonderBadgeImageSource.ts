import type { ImageSourcePropType } from 'react-native'
import { DOMAIN } from '../constants'
import type { WonderBadgeId } from './wonderBadgesCatalog'
import { wonderJumpBadgeBundledSvgUri } from './wonderJumpBadgeSvgAsset'

export type WonderBadgeImageSource =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'svg'; uri: string }

/** Remote fallback when bundled SVG URI is unavailable (e.g. web dev). */
function wonderBadgeRemoteSvgUri(fileName: string): string {
  const fromDomain = String(DOMAIN || '').trim().replace(/\/+$/, '')
  const prod = String(process.env.EXPO_PUBLIC_PROD_API_URL || '').trim().replace(/\/+$/, '')
  const dev = String(process.env.EXPO_PUBLIC_DEV_API_URL || '').trim().replace(/\/+$/, '')
  const base = fromDomain || prod || dev
  const path = `/homepageimgs/badges/${fileName}`
  return base ? `${base}${path}` : path
}

function wonderJumpSvgSource(badgeId: WonderBadgeId, fileName: string): WonderBadgeImageSource {
  const bundled = wonderJumpBadgeBundledSvgUri(badgeId)
  return { kind: 'svg', uri: bundled || wonderBadgeRemoteSvgUri(fileName) }
}

/** Mixed source strategy: bundled raster badges + bundled WonderJump SVG badges. */
export function wonderBadgeImageSource(id: WonderBadgeId): WonderBadgeImageSource {
  switch (id) {
    case 'badge:day7':
      return { kind: 'image', source: require('../public/homepageimgs/badges/Day7.png') }
    case 'badge:day30':
      return { kind: 'image', source: require('../public/homepageimgs/badges/Day30.png') }
    case 'badge:day90':
      return { kind: 'image', source: require('../public/homepageimgs/badges/Day90.png') }
    case 'badge:order1':
      return { kind: 'image', source: require('../public/homepageimgs/badges/order1.png') }
    case 'badge:order5':
      return { kind: 'image', source: require('../public/homepageimgs/badges/order5.png') }
    case 'badge:order10':
      return { kind: 'image', source: require('../public/homepageimgs/badges/order20.png') }
    case 'badge:heart':
      return { kind: 'image', source: require('../public/homepageimgs/badges/Heartbadge.png') }
    case 'badge:wj_top100':
      return wonderJumpSvgSource(id, 'Top100.svg')
    case 'badge:wj_top50':
      return wonderJumpSvgSource(id, 'Top50.svg')
    case 'badge:wj_top10':
      return wonderJumpSvgSource(id, 'Top10.svg')
    case 'badge:wj_top3':
      return wonderJumpSvgSource(id, 'Top3.svg')
    case 'badge:wj_top2':
      return wonderJumpSvgSource(id, 'Top2.svg')
    case 'badge:wj_top1':
      return wonderJumpSvgSource(id, 'Top1.svg')
  }
}
