import type { ImageSourcePropType } from 'react-native'
import type { WonderBadgeId } from './wonderBadgesCatalog'

export type WonderBadgeImageSource =
  | { kind: 'image'; source: ImageSourcePropType }
  | { kind: 'svg'; uri: string }

const base = String(process.env.EXPO_PUBLIC_DEV_API_URL || '').trim().replace(/\/+$/, '')

/** Mixed source strategy: existing raster badges + SVG leaderboard badges. */
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
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top100.svg` }
    case 'badge:wj_top50':
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top50.svg` }
    case 'badge:wj_top10':
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top10.svg` }
    case 'badge:wj_top3':
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top3.svg` }
    case 'badge:wj_top2':
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top2.svg` }
    case 'badge:wj_top1':
      return { kind: 'svg', uri: `${base}/homepageimgs/badges/Top1.svg` }
  }
}
