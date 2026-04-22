import type { ImageSourcePropType } from 'react-native'
import type { WonderBadgeId } from './wonderBadgesCatalog'

/** Metro-bundled PNGs so badges render on profile/native without relying on dev-server URLs. */
export function wonderBadgeImageSource(id: WonderBadgeId): ImageSourcePropType {
  switch (id) {
    case 'badge:day7':
      return require('../public/homepageimgs/badges/Day7.png')
    case 'badge:day30':
      return require('../public/homepageimgs/badges/Day30.png')
    case 'badge:day90':
      return require('../public/homepageimgs/badges/Day90.png')
    case 'badge:order1':
      return require('../public/homepageimgs/badges/order1.png')
    case 'badge:order5':
      return require('../public/homepageimgs/badges/order5.png')
    case 'badge:order20':
      return require('../public/homepageimgs/badges/order20.png')
    case 'badge:heart':
      return require('../public/homepageimgs/badges/Heartbadge.png')
  }
}
