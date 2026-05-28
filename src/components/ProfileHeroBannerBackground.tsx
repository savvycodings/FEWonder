import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { parseProfileBannerColor } from '../profileHeroBanner'

export function ProfileHeroBannerBackground({
  bannerUri,
  defaultBackgroundColor,
  style,
}: {
  bannerUri?: string | null
  defaultBackgroundColor: string
  style?: StyleProp<ViewStyle>
}) {
  const trimmed = bannerUri?.trim() || null
  const solidColor = parseProfileBannerColor(trimmed)
  const imageUri = solidColor ? null : trimmed

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: solidColor ?? defaultBackgroundColor },
        style,
      ]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}
    </View>
  )
}
