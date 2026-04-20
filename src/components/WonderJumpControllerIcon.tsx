import { Image, Platform, type ImageStyle, type StyleProp } from 'react-native'

type WonderJumpControllerIconProps = {
  size?: number
  /** Tab bar: `#ffffff` / inactive rgba. Home card: e.g. `#ecf6ff`. */
  color?: string
  style?: StyleProp<ImageStyle>
}

const PNG_WEB = '/wonderjump/controller.png'
const PNG_NATIVE = require('../../public/wonderjump/controller.png')

function isTabInactiveTint(color: string): boolean {
  const c = color.replace(/\s/g, '').toLowerCase()
  return c.startsWith('rgba(') && (c.includes('0.6') || c.includes('.6)'))
}

/**
 * WonderJump logo from `public/wonderjump/controller.svg` (white via SVG filter).
 * App uses the embedded raster as `controller.png` with tint for reliable native rendering.
 */
export function WonderJumpControllerIcon({
  size = 24,
  color = '#ffffff',
  style,
}: WonderJumpControllerIconProps) {
  const inactive = isTabInactiveTint(color)
  const tintColor = inactive
    ? '#ffffff'
    : color === '#ffffff' || color === '#fff'
      ? '#ffffff'
      : color

  return (
    <Image
      source={Platform.OS === 'web' ? { uri: PNG_WEB } : PNG_NATIVE}
      resizeMode="contain"
      style={[
        { width: size, height: size, opacity: inactive ? 0.62 : 1, tintColor },
        style,
      ]}
    />
  )
}
