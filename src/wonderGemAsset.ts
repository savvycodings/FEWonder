import { Image } from 'react-native'

/** Cropped transparent PNG — do not use WonderGem.svg at runtime (850KB embedded raster). */
export const WONDER_GEM_IMAGE = require('../assets/WonderGem.png')

export function wonderGemImageSource() {
  return WONDER_GEM_IMAGE
}
