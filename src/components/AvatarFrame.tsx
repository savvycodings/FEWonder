import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Image,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useContext } from 'react'
import { ThemeContext } from '../context'

const STORAGE_KEY = 'wonderport-avatar-frame-id'

/** Five hand-authored transparent PNG rings (no sprite sheet). */
export type BorderFrameId = 'neon' | 'ice' | 'fire' | 'gold' | 'purple'

export type AvatarFrameId = 'none' | BorderFrameId

const FRAMES: Record<BorderFrameId, ImageSourcePropType> = {
  neon: require('../../public/homepageimgs/avatar-frames/frame-neon.png'),
  ice: require('../../public/homepageimgs/avatar-frames/frame-ice.png'),
  fire: require('../../public/homepageimgs/avatar-frames/frame-fire.png'),
  gold: require('../../public/homepageimgs/avatar-frames/frame-gold.png'),
  purple: require('../../public/homepageimgs/avatar-frames/frame-purple.png'),
}

export const AVATAR_FRAME_SHOP: { id: BorderFrameId; name: string; tagline: string }[] = [
  { id: 'neon', name: 'Neon glow', tagline: 'Cyan to violet glass ring' },
  { id: 'ice', name: 'Ice crown', tagline: 'Frost around the face' },
  { id: 'fire', name: 'Flame ring', tagline: 'Ember swirl border' },
  { id: 'gold', name: 'Gold band', tagline: 'Polished metal rim' },
  { id: 'purple', name: 'Plasma plum', tagline: 'Purple and pink gloss' },
]

/** Old shop / tab ids that are not avatar frames (never map to `gold` frame). */
const LEGACY_REMOVED = new Set(['ticket', 'field'])

/** Old keys that are not valid anymore (e.g. removed vine asset). */
const LEGACY_TO_FRAME: Record<string, BorderFrameId | 'none'> = {
  floral: 'none',
}

function isBorderFrameId(value: string): value is BorderFrameId {
  return value in FRAMES
}

function isAvatarFrameId(value: string): value is AvatarFrameId {
  return value === 'none' || isBorderFrameId(value)
}

export async function loadEquippedAvatarFrame(): Promise<AvatarFrameId> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return 'none'
    if (LEGACY_REMOVED.has(raw)) {
      await AsyncStorage.removeItem(STORAGE_KEY)
      return 'none'
    }
    if (/^pfp\d{2}$/.test(raw)) {
      await AsyncStorage.removeItem(STORAGE_KEY)
      return 'none'
    }
    if (isAvatarFrameId(raw)) return raw
    if (LEGACY_TO_FRAME[raw] !== undefined) {
      const next = LEGACY_TO_FRAME[raw]
      if (next === 'none') {
        await AsyncStorage.removeItem(STORAGE_KEY)
        return 'none'
      }
      await AsyncStorage.setItem(STORAGE_KEY, next)
      return next
    }
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return 'none'
}

export async function saveEquippedAvatarFrame(id: AvatarFrameId): Promise<void> {
  if (id === 'none') await AsyncStorage.removeItem(STORAGE_KEY)
  else await AsyncStorage.setItem(STORAGE_KEY, id)
}

export function useEquippedAvatarFrame() {
  const [frameId, setFrameId] = useState<AvatarFrameId>('none')
  const refresh = useCallback(async () => {
    setFrameId(await loadEquippedAvatarFrame())
  }, [])
  useEffect(() => {
    let cancelled = false
    loadEquippedAvatarFrame().then((id) => {
      if (!cancelled) setFrameId(id)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return { frameId, setFrameId, refresh }
}

/**
 * Transparent hole size (min of horiz / vert alpha walk at image center), as a
 * fraction of that PNG dimension, used to match every frame’s on-screen hole to neon.
 * (Re-measure if frame art changes.)
 */
const FRAME_HOLE_ASSET_FRAC: Record<BorderFrameId, number> = {
  neon: 0.7277,
  ice: 0.5609,
  fire: 0.5676,
  gold: 0.7184,
  purple: 0.6351,
}

const NEON_HOLE_ASSET_FRAC = FRAME_HOLE_ASSET_FRAC.neon

/**
 * 1 = photo disc matches neon hole diameter in layout math (no deliberate “breathing room”).
 * If art anti-aliases into the hole, nudge down slightly (e.g. 0.98).
 */
const PHOTO_DISC_INSET = 1
const PHOTO_DISC_INSET_PREVIEW = 1

/**
 * Hole-edge fix (works on iOS + Android; no extra assets):
 *
 * Frame PNGs don’t cut a perfectly sharp hole. Near the inner rim, pixels are *partly* transparent
 * (anti-alias / glow). The compositor blends those with whatever is *behind* the PNG, usually your
 * light card/screen color, so you see a thin uneven “white ring”. Ice looks fine when the art overlaps
 * the face; other rings leave that soft zone exposed.
 *
 * We already *mask* the photo to a circle (`overflow: 'hidden'` + `borderRadius`). Here we also make
 * that circle slightly **larger** than the math hole so real face pixels sit **under** the soft rim
 * instead of the screen showing through.
 */
const PHOTO_HOLE_COVER_BLEED = 1.075

function photoContentScale(): number {
  return 1
}

/** Outer `size` passed to `AvatarFrameWrapper` on the profile screen (dp / iOS points). */
export const AVATAR_FRAME_SIZE_PROFILE = 62

/** Outer `size` for Daily Rewards frame shop preview tiles. */
export const AVATAR_FRAME_SIZE_PREVIEW_TILE = 72

/**
 * Diameter of the circular photo in the **same units as `size`** (density-independent points).
 * Use with `AVATAR_FRAME_SIZE_PROFILE` / `AVATAR_FRAME_SIZE_PREVIEW_TILE` and `PixelRatio.get()` for px.
 */
export function avatarPhotoDiscDiameterPoints(
  size: number,
  fit: 'default' | 'preview' = 'default',
): number {
  const base = frameImageBaseScale()
  const inset = fit === 'preview' ? PHOTO_DISC_INSET_PREVIEW : PHOTO_DISC_INSET
  return Math.max(
    14,
    Math.min(size - 1, size * base * NEON_HOLE_ASSET_FRAC * inset * PHOTO_HOLE_COVER_BLEED),
  )
}

/** Photo disc diameter in device pixels (multiply layout points by current pixel ratio). */
export function avatarPhotoDiscDiameterPx(
  size: number,
  fit: 'default' | 'preview' = 'default',
): number {
  return avatarPhotoDiscDiameterPoints(size, fit) * PixelRatio.get()
}

/** Scale ring art with device density so thin rims stay crisp on 3× phones. */
function frameImageBaseScale(): number {
  const pr = PixelRatio.get()
  return 1.14 + Math.min(0.14, (pr - 2) * 0.045)
}

/** Enlarge/smaller the frame PNG so its hole matches neon’s (neon = 1). */
function frameHoleMatchScale(frameId: BorderFrameId): number {
  return NEON_HOLE_ASSET_FRAC / FRAME_HOLE_ASSET_FRAC[frameId]
}

function plainRingStyle(): ViewStyle {
  return {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
  }
}

type BorderFrameLayerProps = {
  size: number
  frameId: BorderFrameId
  fit?: 'default' | 'preview'
  innerBackgroundColor: string
  children: ReactNode
}

function BorderFrameLayer({ size, frameId, fit = 'default', innerBackgroundColor, children }: BorderFrameLayerProps) {
  const base = frameImageBaseScale()
  const holeMatch = frameHoleMatchScale(frameId)
  const imgSide = size * base * holeMatch
  const offset = (size - imgSide) / 2
  const inset = fit === 'preview' ? PHOTO_DISC_INSET_PREVIEW : PHOTO_DISC_INSET
  // Neon-matched hole + slight bleed so photo fills soft PNG edges (see PHOTO_HOLE_COVER_BLEED).
  const photoD = Math.max(
    14,
    Math.min(size - 1, size * base * NEON_HOLE_ASSET_FRAC * inset * PHOTO_HOLE_COVER_BLEED),
  )
  const photoOffset = (size - photoD) / 2
  const contentScale = photoContentScale()

  return (
    <View style={[styles.holder, styles.frameRoot, { width: size, height: size }]}>
      <View
        collapsable={false}
        needsOffscreenAlphaCompositing={Platform.OS === 'android'}
        style={[
          styles.photoUnderlay,
          {
            width: photoD,
            height: photoD,
            borderRadius: photoD / 2,
            left: photoOffset,
            top: photoOffset,
            backgroundColor: innerBackgroundColor,
          },
        ]}
      >
        <View style={[styles.photoZoom, { transform: [{ scale: contentScale }] }]}>
          <View style={styles.photoFill}>{children}</View>
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.frameImageWrap,
          {
            width: imgSide,
            height: imgSide,
            left: offset,
            top: offset,
          },
        ]}
      >
        <Image source={FRAMES[frameId]} resizeMode="contain" style={styles.frameImageFill} />
      </View>
    </View>
  )
}

type AvatarFrameWrapperProps = {
  frameId: AvatarFrameId
  size: number
  fit?: 'default' | 'preview'
  innerBackgroundColor?: string
  children: ReactNode
}

export function AvatarFrameWrapper({
  frameId,
  size,
  fit = 'default',
  innerBackgroundColor = 'transparent',
  children,
}: AvatarFrameWrapperProps) {
  if (frameId !== 'none' && isBorderFrameId(frameId)) {
    return (
      <BorderFrameLayer
        size={size}
        frameId={frameId}
        fit={fit}
        innerBackgroundColor={innerBackgroundColor}
      >
        {children}
      </BorderFrameLayer>
    )
  }

  const inner = Math.max(14, size - 4)
  const ring = plainRingStyle()
  return (
    <View style={[styles.holder, { width: size, height: size }]}>
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          ring,
        ]}
      />
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: innerBackgroundColor,
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

type AvatarFramePreviewTileProps = {
  frameId: BorderFrameId
  size: number
  equipped: boolean
  onEquip: () => void
  previewUri?: string | null
  previewInitial?: string
}

export function AvatarFramePreviewTile({
  frameId,
  size,
  equipped,
  onEquip,
  previewUri,
  previewInitial = '?',
}: AvatarFramePreviewTileProps) {
  const { theme } = useContext(ThemeContext)
  const meta = AVATAR_FRAME_SHOP.find((f) => f.id === frameId)
  const uri = previewUri?.trim() ? previewUri : null

  const previewChild = uri ? (
    <Image source={{ uri }} style={styles.tilePreviewImage} resizeMode="cover" />
  ) : (
    <View
      style={[
        styles.tilePreviewFallback,
        {
          backgroundColor: theme.appBackgroundColor || '#c5cad6',
        },
      ]}
    >
      <Text
        style={[
          styles.tilePreviewInitial,
          {
            color: theme.textColor,
          },
        ]}
      >
        {previewInitial}
      </Text>
    </View>
  )

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.tileBackgroundColor || '#f6f7fa',
          borderColor: theme.tileBorderColor || '#e2e6ef',
        },
      ]}
    >
      <View style={styles.tilePreview}>
        <AvatarFrameWrapper frameId={frameId} size={size} fit="preview" innerBackgroundColor="transparent">
          {previewChild}
        </AvatarFrameWrapper>
      </View>
      <Text style={[styles.tileName, { color: theme.textColor }]}>{meta?.name}</Text>
      <Text style={[styles.tileTagline, { color: theme.mutedForegroundColor }]} numberOfLines={2}>
        {meta?.tagline}
      </Text>
      <Text style={styles.tilePrice}>Free</Text>
      <Pressable
        style={[
          styles.tileButton,
          {
            backgroundColor: theme.tileActiveBackgroundColor || '#111111',
          },
          equipped
            ? {
                backgroundColor: theme.tileBackgroundColor || '#e8ebf2',
                borderColor: theme.tileActiveBackgroundColor || '#111111',
              }
            : null,
        ]}
        onPress={onEquip}
      >
        <Text
          style={[
            styles.tileButtonText,
            { color: theme.tileActiveTextColor || '#ffffff' },
            equipped ? { color: theme.textColor } : null,
          ]}
        >
          {equipped ? 'Equipped' : 'Equip'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  holder: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameRoot: {
    overflow: 'visible',
  },
  frameImageWrap: {
    position: 'absolute',
    zIndex: 2,
  },
  frameImageFill: {
    width: '100%',
    height: '100%',
  },
  photoUnderlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  photoZoom: {
    width: '100%',
    height: '100%',
  },
  photoFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  inner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tile: {
    width: '48%',
    backgroundColor: '#f6f7fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e6ef',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  tilePreview: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 80,
    overflow: 'visible',
  },
  tilePreviewImage: {
    width: '100%',
    height: '100%',
  },
  tilePreviewFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#c5cad6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePreviewInitial: {
    color: '#2a3142',
    fontFamily: 'Geist-Bold',
    fontSize: 20,
  },
  tileName: {
    color: '#111111',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  tileTagline: {
    color: '#6c768f',
    fontFamily: 'Geist-Regular',
    fontSize: 10,
    lineHeight: 14,
    minHeight: 28,
    marginBottom: 6,
  },
  tilePrice: {
    color: '#3d7a52',
    fontFamily: 'Geist-Medium',
    fontSize: 10,
    marginBottom: 6,
  },
  tileButton: {
    borderRadius: 8,
    backgroundColor: '#111111',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileButtonEquipped: {
    backgroundColor: '#e8ebf2',
    borderWidth: 1,
    borderColor: '#111111',
  },
  tileButtonText: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
  },
  tileButtonTextEquipped: {
    color: '#111111',
  },
})
