import { useMemo } from 'react'
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native'
import { ProductImageSaveHeart, type ProductSavePayload } from './ProductImageSaveHeart'

export type ProductImageHeartAlign = {
  containerWidth: number
  containerHeight: number
  resizeMode: 'contain' | 'cover'
  source: ImageSourcePropType
  /** Natural pixel size when known (e.g. from `Image.getSize`); avoids flaky `resolveAssetSource` on web. */
  bitmapWidth?: number
  bitmapHeight?: number
  /** Same value as `imageTranslateY` on the tile image, so the heart tracks the shifted artwork. */
  imageTranslateY?: number
}

type ProductImageQuickActionsProps = {
  product: ProductSavePayload
  heartIconSize?: number
  /** Inset from the right edge of the media (image) frame. */
  right?: number
  /** Inset from the top of the media frame. */
  top?: number
  /** When set, `top` / `right` are derived from the visible bitmap (any tile size + contain/cover). */
  align?: ProductImageHeartAlign
}

const EDGE_INSET = 10
/** Legacy fallback when `align` is not available yet (first layout frame). */
const TOP_LETTERBOX_NUDGE = 16
const RIGHT_INSET = 6

function offsetsForVisibleBitmap(
  cw: number,
  ch: number,
  nw: number,
  nh: number,
  resizeMode: 'contain' | 'cover',
  edgeTop: number,
  edgeRight: number,
  imageTranslateY = 0,
): { top: number; right: number } {
  if (nw <= 0 || nh <= 0 || cw <= 0 || ch <= 0) {
    return { top: edgeTop + TOP_LETTERBOX_NUDGE + imageTranslateY, right: edgeRight }
  }
  if (resizeMode === 'contain') {
    const s = Math.min(cw / nw, ch / nh)
    const dw = nw * s
    const dh = nh * s
    const ox = (cw - dw) / 2
    const oy = (ch - dh) / 2
    return { top: oy + edgeTop + imageTranslateY, right: ox + edgeRight }
  }
  // cover: frame is filled; heart sits at the viewport’s top-right (inset), same as visible image corner.
  return { top: edgeTop, right: edgeRight }
}

export function ProductImageQuickActions({
  product,
  heartIconSize = 22,
  top: topOverride,
  right: rightOverride,
  align,
}: ProductImageQuickActionsProps) {
  const { top, right } = useMemo(() => {
    if (topOverride !== undefined && rightOverride !== undefined) {
      return { top: topOverride, right: rightOverride }
    }
    if (
      align &&
      align.containerWidth > 0 &&
      align.containerHeight > 0
    ) {
      let nw = align.bitmapWidth
      let nh = align.bitmapHeight
      if (!nw || !nh) {
        try {
          const r = Image.resolveAssetSource(align.source)
          if (r?.width && r?.height) {
            nw = r.width
            nh = r.height
          }
        } catch {
          /* use fallback below */
        }
      }
      if (nw && nh) {
        return offsetsForVisibleBitmap(
          align.containerWidth,
          align.containerHeight,
          nw,
          nh,
          align.resizeMode,
          EDGE_INSET,
          RIGHT_INSET,
          align.imageTranslateY ?? 0,
        )
      }
      if (align.resizeMode === 'cover') {
        return { top: EDGE_INSET, right: RIGHT_INSET }
      }
    }
    return { top: EDGE_INSET + TOP_LETTERBOX_NUDGE, right: RIGHT_INSET }
  }, [
    align?.containerWidth,
    align?.containerHeight,
    align?.resizeMode,
    align?.source,
    align?.bitmapWidth,
    align?.bitmapHeight,
    align?.imageTranslateY,
    topOverride,
    rightOverride,
  ])

  return (
    <View style={[styles.stack, { top, right }]}>
      <ProductImageSaveHeart product={product} iconSize={heartIconSize} inline />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    zIndex: 6,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
})
