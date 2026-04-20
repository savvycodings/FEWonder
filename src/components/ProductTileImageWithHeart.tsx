import { useEffect, useMemo, useState } from 'react'
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { ProductImageQuickActions, type ProductImageHeartAlign } from './ProductImageQuickActions'
import type { ProductSavePayload } from './ProductImageSaveHeart'

function imageSourceUri(src: ImageSourcePropType): string | undefined {
  if (typeof src === 'number') return undefined
  if (Array.isArray(src)) {
    const first = src.find(
      (s): s is { uri: string } =>
        typeof s === 'object' &&
        s !== null &&
        'uri' in s &&
        typeof (s as { uri: string }).uri === 'string',
    )
    return first?.uri
  }
  if (typeof src === 'object' && src !== null && 'uri' in src && typeof (src as { uri: string }).uri === 'string') {
    return (src as { uri: string }).uri
  }
  return undefined
}

type ProductTileImageWithHeartProps = {
  product: ProductSavePayload
  source: ImageSourcePropType
  resizeMode: 'contain' | 'cover'
  wrapStyle: ViewStyle
  imageStyle: ImageStyle
  onPress: () => void
  heartIconSize?: number
  /** Negative values shift the artwork up inside the frame (contain letterbox). */
  imageTranslateY?: number
}

/** Measures the image frame and passes layout into `ProductImageQuickActions` so the heart stays on the bitmap’s top-right. */
export function ProductTileImageWithHeart({
  product,
  source,
  resizeMode,
  wrapStyle,
  imageStyle,
  onPress,
  heartIconSize,
  imageTranslateY = 0,
}: ProductTileImageWithHeartProps) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [bitmap, setBitmap] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      const r = Image.resolveAssetSource(source)
      if (r?.width && r?.height) {
        if (!cancelled) setBitmap({ w: r.width, h: r.height })
        return () => {
          cancelled = true
        }
      }
    } catch {
      /* fall through */
    }

    const uri = imageSourceUri(source)
    if (uri) {
      Image.getSize(
        uri,
        (w, h) => {
          if (!cancelled && w > 0 && h > 0) setBitmap({ w, h })
        },
        () => {
          if (!cancelled) setBitmap(null)
        },
      )
      return () => {
        cancelled = true
      }
    }

    if (!cancelled) setBitmap(null)
    return () => {
      cancelled = true
    }
  }, [source])

  const align = useMemo<ProductImageHeartAlign | undefined>(() => {
    if (box.w <= 0 || box.h <= 0) return undefined
    const base: ProductImageHeartAlign = {
      containerWidth: box.w,
      containerHeight: box.h,
      resizeMode,
      source,
      ...(imageTranslateY !== 0 ? { imageTranslateY } : {}),
    }
    if (bitmap && bitmap.w > 0 && bitmap.h > 0) {
      base.bitmapWidth = bitmap.w
      base.bitmapHeight = bitmap.h
    }
    return base
  }, [box.w, box.h, resizeMode, source, bitmap?.w, bitmap?.h, imageTranslateY])

  const imageResolvedStyle = useMemo(
    () =>
      imageTranslateY !== 0
        ? [imageStyle, { transform: [{ translateY: imageTranslateY }] }]
        : imageStyle,
    [imageStyle, imageTranslateY],
  )

  return (
    <View
      style={wrapStyle}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
      }}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onPress} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Image source={source} style={imageResolvedStyle} resizeMode={resizeMode} />
      </View>
      <ProductImageQuickActions product={product} heartIconSize={heartIconSize} align={align} />
    </View>
  )
}
