import { memo } from 'react'
import { View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'

import { combineFlamePhase, getMeteorFlameTopPad, MeteorFlameSvg } from './meteorFlameArt'

export {
  combineFlamePhase,
  getMeteorFlameTopPad,
  MeteorFlameSvg,
  METEOR_FLAME_ART_VERSION,
} from './meteorFlameArt'

export type AsteroidVariant = 'compact' | 'standard' | 'chunk' | 'colossal'

export const METEOR_VARIANT_ORDER: AsteroidVariant[] = ['compact', 'standard', 'chunk', 'colossal']

export type MeteorVariantConfig = {
  label: string
  rockW: number
  rockH: number
  flameTailRatio: number
  flameOverlap: number
  velocityYMin: number
  velocityYMax: number
  spinRateMin: number
  spinRateMax: number
  spawnWeight: number
}

export const METEOR_VARIANT_CONFIG: Record<AsteroidVariant, MeteorVariantConfig> = {
  compact: {
    label: 'Compact',
    rockW: 32,
    rockH: 38,
    flameTailRatio: 0.62,
    flameOverlap: 22,
    velocityYMin: 5.9,
    velocityYMax: 7.9,
    spinRateMin: -0.22,
    spinRateMax: 0.22,
    spawnWeight: 30,
  },
  standard: {
    label: 'Standard',
    rockW: 44,
    rockH: 52,
    flameTailRatio: 0.78,
    flameOverlap: 24,
    velocityYMin: 5.2,
    velocityYMax: 7.5,
    spinRateMin: -0.18,
    spinRateMax: 0.18,
    spawnWeight: 35,
  },
  chunk: {
    label: 'Chunk',
    rockW: 52,
    rockH: 60,
    flameTailRatio: 0.86,
    flameOverlap: 26,
    velocityYMin: 4.75,
    velocityYMax: 7,
    spinRateMin: -0.16,
    spinRateMax: 0.16,
    spawnWeight: 25,
  },
  colossal: {
    label: 'Colossal',
    rockW: 66,
    rockH: 78,
    flameTailRatio: 0.96,
    flameOverlap: 28,
    velocityYMin: 4.1,
    velocityYMax: 6.1,
    spinRateMin: -0.12,
    spinRateMax: 0.12,
    spawnWeight: 10,
  },
}

const SPAWN_WEIGHT_TOTAL = METEOR_VARIANT_ORDER.reduce((s, v) => s + METEOR_VARIANT_CONFIG[v].spawnWeight, 0)

function seededUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function pickAsteroidVariant(seed: number): AsteroidVariant {
  const t = seededUnit(seed)
  let acc = 0
  for (const v of METEOR_VARIANT_ORDER) {
    acc += METEOR_VARIANT_CONFIG[v].spawnWeight / SPAWN_WEIGHT_TOTAL
    if (t <= acc) return v
  }
  return 'standard'
}

export function getMeteorTailHeight(rockH: number, variant: AsteroidVariant): number {
  return Math.round(rockH * METEOR_VARIANT_CONFIG[variant].flameTailRatio)
}

/** Tail length plus top headroom for scaled flame tips (world px above rock top). */
export function getMeteorPlumeReach(rockH: number, variant: AsteroidVariant): number {
  const tailH = getMeteorTailHeight(rockH, variant)
  const overlap = METEOR_VARIANT_CONFIG[variant].flameOverlap
  const topPad = getMeteorFlameTopPad(variant, tailH + overlap)
  return tailH + topPad
}

const ROCK = {
  base: '#5c5854',
  mid: '#6e6964',
  dark: '#3a3634',
  hi: '#9a948c',
  outline: '#1e1c1a',
  shadow: '#4a4642',
}

function StandardRock() {
  return (
    <>
      <Path
        d="M10 28 L6 38 L9 48 L16 54 L26 58 L38 56 L50 50 L58 38 L56 26 L48 16 L36 10 L22 12 Z"
        fill={ROCK.base}
        stroke={ROCK.outline}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path
        d="M14 30 L12 38 L16 46 L24 50 L34 48 L44 42 L48 34 L46 24 L38 18 L26 18 Z"
        fill={ROCK.mid}
        opacity={0.85}
      />
      <Path d="M18 22 L24 28 L30 24 L28 18 Z" fill={ROCK.hi} opacity={0.5} />
      <Path d="M40 28 L46 34 L42 40 L36 36 Z" fill={ROCK.hi} opacity={0.38} />
      <Ellipse cx="22" cy="36" rx="5.5" ry="4" fill={ROCK.dark} opacity={0.55} />
      <Ellipse cx="38" cy="40" rx="4.2" ry="3.2" fill={ROCK.dark} opacity={0.48} />
      <Ellipse cx="44" cy="26" rx="3" ry="2.2" fill={ROCK.dark} opacity={0.4} />
      <Ellipse cx="30" cy="22" rx="2.4" ry="1.8" fill={ROCK.dark} opacity={0.35} />
    </>
  )
}

function ChunkRock() {
  return (
    <>
      <Path
        d="M8 32 L4 42 L8 54 L18 60 L32 62 L46 58 L58 48 L60 34 L52 20 L38 12 L22 14 Z"
        fill={ROCK.base}
        stroke={ROCK.outline}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M12 34 L10 44 L16 52 L28 56 L42 52 L52 42 L50 28 L40 20 L26 20 Z" fill={ROCK.mid} opacity={0.88} />
      <Path d="M14 24 L22 30 L18 38 L12 32 Z" fill={ROCK.hi} opacity={0.45} />
      <Path d="M44 30 L52 38 L48 46 L40 42 Z" fill={ROCK.hi} opacity={0.38} />
      <Path d="M20 28 L34 26 L32 34 L22 34 Z" fill={ROCK.dark} opacity={0.35} />
      <Path d="M8 38 L14 42 L10 48" stroke={ROCK.shadow} strokeWidth={1.2} fill="none" opacity={0.5} />
      <Path d="M48 40 L56 36 L54 48" stroke={ROCK.shadow} strokeWidth={1.2} fill="none" opacity={0.45} />
      <Ellipse cx="24" cy="40" rx="4.5" ry="3.2" fill={ROCK.dark} opacity={0.55} />
      <Ellipse cx="42" cy="44" rx="3.8" ry="2.8" fill={ROCK.dark} opacity={0.5} />
    </>
  )
}

function CompactRock() {
  return (
    <>
      <Path
        d="M18 14 L12 28 L14 42 L24 50 L38 48 L50 40 L52 26 L44 16 L30 12 Z"
        fill={ROCK.base}
        stroke={ROCK.outline}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Path d="M20 18 L16 30 L20 40 L30 44 L40 40 L46 30 L42 20 L32 16 Z" fill={ROCK.mid} opacity={0.86} />
      <Path d="M22 22 L28 28 L26 20 Z" fill={ROCK.hi} opacity={0.48} />
      <Ellipse cx="34" cy="32" rx="3.2" ry="2.4" fill={ROCK.dark} opacity={0.5} />
      <Ellipse cx="26" cy="36" rx="2.4" ry="1.8" fill={ROCK.dark} opacity={0.42} />
    </>
  )
}

function ColossalRock() {
  return (
    <>
      <Path
        d="M6 34 L2 48 L8 58 L20 62 L36 64 L52 60 L60 46 L58 28 L48 14 L32 8 L16 12 Z"
        fill={ROCK.base}
        stroke={ROCK.outline}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Path
        d="M10 36 L8 48 L14 56 L26 60 L40 58 L52 50 L54 36 L46 22 L32 16 L18 18 Z"
        fill={ROCK.mid}
        opacity={0.86}
      />
      <Path d="M14 24 L24 30 L20 38 L12 32 Z" fill={ROCK.hi} opacity={0.48} />
      <Path d="M42 26 L52 34 L48 44 L38 40 Z" fill={ROCK.hi} opacity={0.4} />
      <Ellipse cx="22" cy="42" rx="7" ry="5" fill={ROCK.dark} opacity={0.58} />
      <Ellipse cx="40" cy="46" rx="5.5" ry="4" fill={ROCK.dark} opacity={0.52} />
      <Ellipse cx="48" cy="28" rx="4" ry="3" fill={ROCK.dark} opacity={0.45} />
      <Ellipse cx="28" cy="24" rx="3.2" ry="2.4" fill={ROCK.dark} opacity={0.4} />
      <Path d="M16 20 L26 14 L36 16" stroke={ROCK.hi} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.4} />
      <Path d="M10 50 L18 54 L14 58" fill={ROCK.dark} opacity={0.32} />
    </>
  )
}

export const MeteorRockSvg = memo(function MeteorRockSvg({ variant }: { variant: AsteroidVariant }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 64 64" preserveAspectRatio="none">
      {variant === 'compact' ? (
        <CompactRock />
      ) : variant === 'chunk' ? (
        <ChunkRock />
      ) : variant === 'colossal' ? (
        <ColossalRock />
      ) : (
        <StandardRock />
      )}
    </Svg>
  )
})

export type MeteorCompositeProps = {
  left: number
  top: number
  variant: AsteroidVariant
  flamePhase: number
  /** Display-rate tick (matches design canvas RAF), not sim-only uiAnimTick. */
  flameAnimTick: number
  zIndex?: number
}

export function MeteorComposite({
  left,
  top,
  variant,
  flamePhase,
  flameAnimTick,
  zIndex = 4,
}: MeteorCompositeProps) {
  const cfg = METEOR_VARIANT_CONFIG[variant]
  const rockW = cfg.rockW
  const rockH = cfg.rockH
  const tailH = getMeteorTailHeight(rockH, variant)
  const overlap = cfg.flameOverlap
  const flameBoxH = tailH + overlap
  const topPad = getMeteorFlameTopPad(variant, flameBoxH)
  const phase = combineFlamePhase(flamePhase, flameAnimTick)

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top: top - tailH + overlap - topPad,
        width: rockW,
        height: tailH + rockH + topPad,
        zIndex,
        overflow: 'visible',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          bottom: rockH - overlap,
          width: rockW,
          height: flameBoxH + topPad,
          zIndex: 1,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: flameBoxH + topPad,
          }}
        >
          <MeteorFlameSvg variant={variant} phase={phase} />
        </View>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: rockW,
          height: rockH,
          zIndex: 2,
        }}
      >
        <MeteorRockSvg variant={variant} />
      </View>
    </View>
  )
}

/** For canvas / docs — human-readable variant stats. */
export function meteorVariantCaption(variant: AsteroidVariant): string {
  const c = METEOR_VARIANT_CONFIG[variant]
  const tail = getMeteorTailHeight(c.rockH, variant)
  const pct = Math.round((c.spawnWeight / SPAWN_WEIGHT_TOTAL) * 100)
  return `${c.rockW}×${c.rockH}px rock · ${tail}px flame · ~${pct}% spawn`
}
