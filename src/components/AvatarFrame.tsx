import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
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
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useContext } from 'react'
import { ThemeContext } from '../context'

const STORAGE_KEY = 'wonderport-avatar-frame-id'

/** Supported avatar border styles (all vector-based for scalable rendering). */
export type BorderFrameId =
  | 'neon'
  | 'gold'
  | 'rainbow'
  | 'prism'
  | 'meridian'
  | 'hex'
  | 'shard'

export type AvatarFrameId = 'none' | BorderFrameId

const BORDER_FRAME_IDS: BorderFrameId[] = [
  'neon',
  'gold',
  'rainbow',
  'prism',
  'meridian',
  'hex',
  'shard',
]

export const AVATAR_FRAME_SHOP: { id: BorderFrameId; name: string; tagline: string }[] = [
  { id: 'neon', name: 'Neon glow', tagline: 'Cyan to violet glass ring' },
  { id: 'gold', name: 'Gold band', tagline: 'Polished gold halo' },
  { id: 'rainbow', name: 'Rainbow pop', tagline: 'Full spectrum ring' },
  { id: 'prism', name: 'Crimson split', tagline: 'Red-black ring with racing stripe' },
  { id: 'meridian', name: 'Meridian flare', tagline: 'Sunset ring with a wide violet band' },
  { id: 'hex', name: 'Hex forge', tagline: 'Faceted metal halo' },
  { id: 'shard', name: 'Crystal crown', tagline: 'Five glass peaks' },
]

/** Old shop / tab ids that are not avatar frames (never map to `gold` frame). */
const LEGACY_REMOVED = new Set(['ticket', 'field', 'ice', 'fire'])

/** Old keys that are not valid anymore (e.g. removed vine asset). */
const LEGACY_TO_FRAME: Record<string, BorderFrameId | 'none'> = {
  floral: 'none',
  aurora: 'none',
  void: 'none',
}

function isBorderFrameId(value: string): value is BorderFrameId {
  return BORDER_FRAME_IDS.includes(value as BorderFrameId)
}

function isAvatarFrameId(value: string): value is AvatarFrameId {
  return value === 'none' || isBorderFrameId(value)
}

export function coerceAvatarFrameId(raw: string | null | undefined): AvatarFrameId {
  if (raw == null || raw === '' || raw === 'none') return 'none'
  if (isAvatarFrameId(raw)) return raw
  return 'none'
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
  gold: 0.7277,
  rainbow: 0.7277,
  prism: 0.7277,
  meridian: 0.7277,
  hex: 0.7277,
  shard: 0.7277,
}

const NEON_HOLE_ASSET_FRAC = FRAME_HOLE_ASSET_FRAC.neon

/**
 * 1 = photo disc matches neon hole diameter in layout math (no deliberate “breathing room”).
 * If art anti-aliases into the hole, nudge down slightly (e.g. 0.98).
 */
const PHOTO_DISC_INSET = 1
const PHOTO_DISC_INSET_PREVIEW = 1
const PHOTO_DISC_INSET_CHAT = 1.26

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
  fit?: 'default' | 'preview' | 'chat'
  innerBackgroundColor: string
  children: ReactNode
}

function snapToPixel(value: number): number {
  return PixelRatio.roundToNearestPixel(value)
}

function NeonVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradMainId = `neonGradMain_${uid}`
  const gradShineId = `neonGradShine_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const innerRadius = Math.max(1, photoDiameter / 2)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, innerRadius + stroke / 2 - 0.6))
  const edgeStroke = Math.max(1, stroke * 0.22)
  const glowStroke = stroke * 1.62

  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradMainId} x1="0%" y1="20%" x2="100%" y2="80%">
          <Stop offset="0%" stopColor="#63E8FF" />
          <Stop offset="35%" stopColor="#5A7CFF" />
          <Stop offset="70%" stopColor="#B058FF" />
          <Stop offset="100%" stopColor="#FF69D7" />
        </LinearGradient>
        <LinearGradient id={gradShineId} x1="25%" y1="10%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.25} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.08} />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#8E73FF" strokeOpacity={0.36} strokeWidth={glowStroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradMainId})`} strokeWidth={stroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradShineId})`} strokeWidth={edgeStroke} />
    </Svg>
  )
}

function GoldVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradMainId = `goldGradMain_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, photoDiameter / 2 + stroke / 2 - 0.6))
  const glowStroke = stroke * 1.58
  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradMainId} x1="0%" y1="18%" x2="100%" y2="82%">
          <Stop offset="0%" stopColor="#FFF5B8" />
          <Stop offset="35%" stopColor="#FFD24A" />
          <Stop offset="68%" stopColor="#E5A90A" />
          <Stop offset="100%" stopColor="#FFF0A0" />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#FFC83A" strokeOpacity={0.34} strokeWidth={glowStroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradMainId})`} strokeWidth={stroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={Math.max(1, stroke * 0.2)} />
    </Svg>
  )
}

function RainbowVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradMainId = `rainbowGradMain_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, photoDiameter / 2 + stroke / 2 - 0.6))
  const glowStroke = stroke * 1.64
  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradMainId} x1="0%" y1="10%" x2="100%" y2="90%">
          <Stop offset="0%" stopColor="#FF5D7A" />
          <Stop offset="20%" stopColor="#FF9B3D" />
          <Stop offset="40%" stopColor="#FFD94D" />
          <Stop offset="60%" stopColor="#44D17A" />
          <Stop offset="80%" stopColor="#4D8CFF" />
          <Stop offset="100%" stopColor="#A75CFF" />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#A76EFF" strokeOpacity={0.32} strokeWidth={glowStroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradMainId})`} strokeWidth={stroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.24} strokeWidth={Math.max(1, stroke * 0.18)} />
    </Svg>
  )
}

function PrismVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradMainId = `prismGradMain_${uid}`
  const gradStripeId = `prismGradStripe_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, photoDiameter / 2 + stroke / 2 - 0.6))
  const glowStroke = stroke * 1.62
  const circumference = 2 * Math.PI * r
  const targetDashCount = Math.max(8, Math.round(side / 4))
  const dashPeriod = circumference / targetDashCount
  const dashLen = Math.max(2.2, dashPeriod * 0.36)
  const gapLen = Math.max(1.6, dashPeriod - dashLen)
  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradMainId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#2C0A0A" />
          <Stop offset="46%" stopColor="#500F0F" />
          <Stop offset="54%" stopColor="#D71F2D" />
          <Stop offset="100%" stopColor="#FF4254" />
        </LinearGradient>
        <LinearGradient id={gradStripeId} x1="10%" y1="15%" x2="92%" y2="88%">
          <Stop offset="0%" stopColor="#FFD9DF" />
          <Stop offset="100%" stopColor="#FFFFFF" />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#FF2E45" strokeOpacity={0.34} strokeWidth={glowStroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradMainId})`} strokeWidth={stroke} />
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={`url(#${gradStripeId})`}
        strokeOpacity={0.95}
        strokeWidth={Math.max(1.1, stroke * 0.2)}
        strokeDasharray={`${dashLen} ${gapLen}`}
        strokeLinecap="round"
      />
    </Svg>
  )
}

function MeridianVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `meridianGrad_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, photoDiameter / 2 + stroke / 2 - 0.6))
  const glowStroke = stroke * 1.56

  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
          <Stop offset="0%" stopColor="#FF8A3D" />
          <Stop offset="20%" stopColor="#FF4A9A" />
          <Stop offset="42%" stopColor="#D946EF" />
          <Stop offset="68%" stopColor="#8B5CF6" />
          <Stop offset="88%" stopColor="#6D28D9" />
          <Stop offset="100%" stopColor="#5B21B6" />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#6D28D9" strokeOpacity={0.26} strokeWidth={glowStroke * 1.12} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#A78BFA" strokeOpacity={0.32} strokeWidth={glowStroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#FF6A9A" strokeOpacity={0.18} strokeWidth={glowStroke * 0.72} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={stroke} />
    </Svg>
  )
}

function HexVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `hexGrad_${uid}`
  const shineId = `hexShine_${uid}`
  const c = side / 2
  const stroke = Math.max(4.1, side * 0.086)
  const pr = photoDiameter / 2
  // Hex circumscribed on the photo circle (flat sides tangent) + hairline clearance — minimizes vertex scallops.
  const Rtan = pr / Math.cos(Math.PI / 6)
  const R = Math.min(c - stroke * 0.32, Rtan + Math.max(0.25, stroke * 0.035))
  let d = ''
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    const x = c + R * Math.cos(a)
    const y = c + R * Math.sin(a)
    d += i === 0 ? `M${x} ${y}` : `L${x} ${y}`
  }
  d += 'Z'
  const glowStroke = stroke * 1.55
  const scallopR = pr + stroke * 0.1

  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradId} x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0%" stopColor="#C4D4E8" />
          <Stop offset="40%" stopColor="#6B8AB8" />
          <Stop offset="72%" stopColor="#2E4A6E" />
          <Stop offset="100%" stopColor="#E8F0FF" />
        </LinearGradient>
        <LinearGradient id={shineId} x1="20%" y1="15%" x2="80%" y2="85%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.12} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.35} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={c}
        cy={c}
        r={scallopR}
        fill="none"
        stroke="#5A7CA8"
        strokeOpacity={0.38}
        strokeWidth={stroke * 1.35}
      />
      <Circle
        cx={c}
        cy={c}
        r={scallopR}
        fill="none"
        stroke="#8FA8C8"
        strokeOpacity={0.22}
        strokeWidth={stroke * 0.55}
      />
      <Path
        d={d}
        fill="none"
        stroke="#4A6FA8"
        strokeOpacity={0.35}
        strokeWidth={glowStroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${shineId})`}
        strokeWidth={Math.max(1, stroke * 0.22)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  )
}

function ShardVectorFrame({ side, photoDiameter }: { side: number; photoDiameter: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `shardGrad_${uid}`
  const c = side / 2
  const stroke = Math.max(3.7, side * 0.078)
  const r = Math.max(2, Math.min(c - stroke / 2 - 0.5, photoDiameter / 2 + stroke / 2 - 0.6))
  const rTip = Math.min(c - 1.5, r + stroke * 1.28)
  const rBase = Math.max(photoDiameter / 2 + stroke * 0.55, r - stroke * 0.38)
  const dt = 0.11
  const count = 5

  const shards: string[] = []
  for (let i = 0; i < count; i += 1) {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / count
    const tx = c + rTip * Math.cos(t)
    const ty = c + rTip * Math.sin(t)
    const lx = c + rBase * Math.cos(t - dt)
    const ly = c + rBase * Math.sin(t - dt)
    const rx = c + rBase * Math.cos(t + dt)
    const ry = c + rBase * Math.sin(t + dt)
    shards.push(`M${tx} ${ty}L${lx} ${ly}L${rx} ${ry}Z`)
  }

  return (
    <Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#E0F7FF" />
          <Stop offset="35%" stopColor="#7DD3FC" />
          <Stop offset="70%" stopColor="#38BDF8" />
          <Stop offset="100%" stopColor="#C4B5FD" />
        </LinearGradient>
        <RadialGradient id={`shardGlow_${uid}`} cx="50%" cy="40%" rx="55%" ry="55%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={(rTip + rBase) / 2} fill={`url(#shardGlow_${uid})`} />
      <Circle
        cx={c}
        cy={c}
        r={photoDiameter / 2 + stroke * 0.14}
        fill="none"
        stroke="rgba(15, 23, 42, 0.55)"
        strokeWidth={Math.max(2.8, stroke * 1.15)}
      />
      <Circle
        cx={c}
        cy={c}
        r={photoDiameter / 2 + stroke * 0.14}
        fill="none"
        stroke="rgba(56, 189, 248, 0.35)"
        strokeWidth={Math.max(2.2, stroke * 0.95)}
      />
      <Circle
        cx={c}
        cy={c}
        r={photoDiameter / 2 + stroke * 0.14}
        fill="none"
        stroke="rgba(255, 255, 255, 0.72)"
        strokeWidth={Math.max(1.4, stroke * 0.55)}
      />
      {shards.map((d, idx) => (
        <Path
          key={`s${idx}`}
          d={d}
          fill="none"
          stroke="#0EA5E9"
          strokeOpacity={0.4}
          strokeWidth={stroke * 1.1}
          strokeLinejoin="round"
        />
      ))}
      {shards.map((d, idx) => (
        <Path
          key={`f${idx}`}
          d={d}
          fill={`url(#${gradId})`}
          fillOpacity={0.92}
          stroke="#FFFFFF"
          strokeOpacity={0.45}
          strokeWidth={Math.max(0.9, stroke * 0.16)}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

function VectorFrameById({
  frameId,
  side,
  photoDiameter,
}: {
  frameId: BorderFrameId
  side: number
  photoDiameter: number
}) {
  switch (frameId) {
    case 'neon':
      return <NeonVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'gold':
      return <GoldVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'rainbow':
      return <RainbowVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'prism':
      return <PrismVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'meridian':
      return <MeridianVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'hex':
      return <HexVectorFrame side={side} photoDiameter={photoDiameter} />
    case 'shard':
      return <ShardVectorFrame side={side} photoDiameter={photoDiameter} />
    default:
      return null
  }
}

function BorderFrameLayer({ size, frameId, fit = 'default', innerBackgroundColor, children }: BorderFrameLayerProps) {
  const base = fit === 'chat' ? 1 : frameImageBaseScale()
  const holeMatch = frameHoleMatchScale(frameId)
  const imgSide = snapToPixel(size * base * holeMatch)
  const offset = snapToPixel((size - imgSide) / 2)
  const inset = fit === 'preview' ? PHOTO_DISC_INSET_PREVIEW : fit === 'chat' ? PHOTO_DISC_INSET_CHAT : PHOTO_DISC_INSET
  // Neon-matched hole + slight bleed so photo fills soft PNG edges (see PHOTO_HOLE_COVER_BLEED).
  const photoD = snapToPixel(Math.max(
    14,
    Math.min(size - 1, size * base * NEON_HOLE_ASSET_FRAC * inset * PHOTO_HOLE_COVER_BLEED),
  ))
  const photoOffset = snapToPixel((size - photoD) / 2)
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
        <VectorFrameById frameId={frameId} side={imgSide} photoDiameter={photoD} />
      </View>
    </View>
  )
}

type AvatarFrameWrapperProps = {
  frameId: AvatarFrameId
  size: number
  fit?: 'default' | 'preview' | 'chat'
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
    <View
      style={[
        styles.holder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        },
      ]}
    >
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
  const ACCENT = '#CBFF00'
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
          backgroundColor: '#000000',
          borderColor: 'rgba(203,255,0,0.28)',
        },
      ]}
    >
      <View style={styles.tilePreview}>
        <AvatarFrameWrapper frameId={frameId} size={size} fit="preview" innerBackgroundColor="transparent">
          {previewChild}
        </AvatarFrameWrapper>
      </View>
      <Text style={[styles.tileName, { color: '#ffffff' }]}>{meta?.name}</Text>
      <Text style={[styles.tileTagline, { color: 'rgba(255,255,255,0.72)' }]} numberOfLines={2}>
        {meta?.tagline}
      </Text>
      <Text style={[styles.tilePrice, { color: ACCENT }]}>Free</Text>
      <Pressable
        style={[
          styles.tileButton,
          {
            backgroundColor: ACCENT,
          },
          equipped
            ? {
                backgroundColor: 'transparent',
                borderColor: ACCENT,
              }
            : null,
        ]}
        onPress={onEquip}
      >
        <Text
          style={[
            styles.tileButtonText,
            { color: '#050505' },
            equipped ? { color: ACCENT } : null,
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
