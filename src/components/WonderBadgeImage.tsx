import { memo, useEffect, useState, type ReactElement } from 'react'
import { Image, View, type ImageSourcePropType } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { WebView } from 'react-native-webview'
import type { WonderBadgeId } from '../wonderBadgesCatalog'
import { wonderBadgeImageSource } from '../wonderBadgeImageSource'
import { BRAND_ACCENT_LIME_HEX } from '../brandAccent'

/**
 * Raster badge in a fixed square; `resizeMode="contain"` keeps different source dimensions
 * visually consistent. Uses bundled `require()` sources so profile + store work on native.
 */
export const WonderBadgeImage = memo(function WonderBadgeImage({
  badgeId,
  size,
  fallbackColor = BRAND_ACCENT_LIME_HEX,
}: {
  badgeId: WonderBadgeId
  size: number
  fallbackColor?: string
}): ReactElement {
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(() => wonderBadgeImageSource(badgeId))

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
      {source.kind === 'svg' ? (
        <WebView
          originWhitelist={['*']}
          source={{
            html: `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}img{width:100vw;height:100vh;object-fit:contain;display:block;}</style></head><body><img src="${source.uri}" alt="badge"/></body></html>`,
            baseUrl: source.uri,
          }}
          style={{ width: size, height: size, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled={false}
          domStorageEnabled={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityRole="image"
          accessibilityLabel="Badge"
          source={source.source as ImageSourcePropType}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
})
