import type { ImageSourcePropType } from 'react-native'
import { DOMAIN } from '../constants'
import type { WonderBadgeId } from './wonderBadgesCatalog'

export type WonderBadgeImageSource =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'svg'; uri: string }

/** Remote SVG from Railway static hosting (WonderJump badges). */
function wonderBadgeRemoteSvgUri(fileName: string): string {
  const fromDomain = String(DOMAIN || '').trim().replace(/\/+$/, '')
  const prod = String(process.env.EXPO_PUBLIC_PROD_API_URL || '').trim().replace(/\/+$/, '')
  const dev = String(process.env.EXPO_PUBLIC_DEV_API_URL || '').trim().replace(/\/+$/, '')
  const base = fromDomain || prod || dev
  const path = `/homepageimgs/badges/${fileName}`
  return base ? `${base}${path}` : path
}

/** Mixed source strategy: bundled raster badges + remote WonderJump SVG badges. */
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
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top100.svg') }
    case 'badge:wj_top50':
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top50.svg') }
    case 'badge:wj_top10':
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top10.svg') }
    case 'badge:wj_top3':
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top3.svg') }
    case 'badge:wj_top2':
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top2.svg') }
    case 'badge:wj_top1':
      return { kind: 'svg', uri: wonderBadgeRemoteSvgUri('Top1.svg') }
  }
}
