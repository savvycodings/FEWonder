import { memo, useEffect, useState, type ReactElement } from 'react'
import { Image, View, type ImageSourcePropType } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import type { WonderBadgeId } from '../wonderBadgesCatalog'
import { wonderBadgeImageSource } from '../wonderBadgeImageSource'

/**
 * Raster badge in a fixed square; `resizeMode="contain"` keeps different source dimensions
 * visually consistent. Uses bundled `require()` sources so profile + store work on native.
 */
export const WonderBadgeImage = memo(function WonderBadgeImage({
  badgeId,
  size,
  fallbackColor = '#CBFF00',
}: {
  badgeId: WonderBadgeId
  size: number
  fallbackColor?: string
}): ReactElement {
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState<ImageSourcePropType>(() => wonderBadgeImageSource(badgeId))

  useEffect(() => {
    setFailed(false)
    setSource(wonderBadgeImageSource(badgeId))
  }, [badgeId])

  const iconSize = Math.max(12, Math.round(size * 0.45))

  if (failed) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <FeatherIcon name="award" size={iconSize} color={fallbackColor} />
      </View>
    )
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityRole="image"
        accessibilityLabel="Badge"
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  )
})
