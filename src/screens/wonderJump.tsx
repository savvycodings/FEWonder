import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type RunMode = 'menu' | 'playing' | 'paused' | 'gameOver'
type PlatformKind = 'normal' | 'bouncy' | 'moving' | 'breakable'
type ControlScheme = 'touchSplit' | 'dpad'

/** Starting biome from Home or in-game menu (affects visuals + mushroom surface mix). */
export type WonderJumpStartBiome = 'grassland' | 'mushroom' | 'tropical'

type PlatformSurfaceKind = 'grass' | 'sand' | 'mushroom_grey' | 'mushroom_red'

type PlatformMushroomDecoKind = 'single' | 'group'
type PlatformFlowerDecoKind =
  | 'rosePink'
  | 'daisyBlue'
  | 'petalPeach'
  | 'violet'
  | 'hydrangea'
  | 'marigold'
  | 'azure'
  | 'sunburst'

type PlatformTopMushroom = {
  /** Horizontal center relative to platform left edge (stable when the platform moves). */
  offsetX: number
  kind: PlatformMushroomDecoKind
}

type PlatformTopPalmTree = {
  /** Horizontal center relative to platform left edge (stable when the platform moves). */
  offsetX: number
  /** Small vertical jitter so it feels hand-placed. */
  offsetY: number
}

type PlatformTopFlower = {
  /** Horizontal center relative to platform left edge (stable when the platform moves). */
  offsetX: number
  /** Small vertical jitter so groups feel hand-placed, not grid-stamped. */
  offsetY: number
  kind: PlatformFlowerDecoKind
}

type PlatformItem = {
  id: string
  x: number
  y: number
  width: number
  height: number
  kind: PlatformKind
  moveMinX: number
  moveMaxX: number
  moveDir: -1 | 1
  moveSpeed: number
  breakProgress: number
  isFalling: boolean
  fallingVelocityY: number
  surface: PlatformSurfaceKind
  /** Decorative mushrooms on mushroom-surface platforms (1–2, non-overlapping). */
  topMushrooms?: PlatformTopMushroom[]
  /** Decorative palm tree on tropical platforms (0–1, collision-aware). */
  topPalmTree?: PlatformTopPalmTree
  /** Decorative flowers on grassland-surface platforms (1–4, non-overlapping). */
  topFlowers?: PlatformTopFlower[]
}

type Spike = {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Horizontal offset from host platform’s left edge (stable when platform moves). */
  offsetX: number
}

type Coin = {
  id: string
  x: number
  y: number
  radius: number
  collected: boolean
  /** Stable horizontal offset from host platform’s left edge (world x = host.x + offsetX) */
  offsetX: number
  /** When set, coin follows the host platform each tick; otherwise it stays in world coords (drops). */
  hostPlatformId: string | null
}

type JetpackPickup = {
  id: string
  x: number
  y: number
  width: number
  height: number
  collected: boolean
  hoverPhase: number
}

type Crab = {
  id: string
  hostPlatformId: string
  /** Local X within host platform. */
  localX: number
  minLocalX: number
  maxLocalX: number
  dir: -1 | 1
  speed: number
  width: number
  height: number
  alive: boolean
  deathMs: number
  plus2Ms: number
}

type Player = {
  x: number
  y: number
  width: number
  height: number
  velocityX: number
  velocityY: number
  onGround: boolean
  groundPlatformId: string | null
  groundKind: PlatformKind | null
}

type GameState = {
  mode: RunMode
  player: Player
  platforms: PlatformItem[]
  spikes: Spike[]
  coins: Coin[]
  jetpacks: JetpackPickup[]
  crabs: Crab[]
  cameraY: number
  heightScore: number
  coinScore: number
  /** World Y of last platform that spawned a coin — keeps new coins vertically separated */
  lastCoinHostY: number | null
  /** World X of last spawned coin — avoids a straight vertical column up the lane */
  lastCoinWorldX: number | null
  /** World Y of last jetpack spawn to avoid clustering. */
  lastJetpackY: number | null
  /** Milliseconds of jetpack boost remaining while equipped. */
  jetpackFuelMs: number
  /** Brief anti-spike grace right after jetpack fuel ends. */
  jetpackEndGraceMs: number
  /** Frame counter for flame animation while jetpack is active. */
  jetpackAnimTick: number
  /** Global UI animation tick for hover/shake effects. */
  uiAnimTick: number
  startBiome: WonderJumpStartBiome
}

type InputState = {
  leftPressed: boolean
  rightPressed: boolean
}

const PLAYER_SIZE = 24
const PLATFORM_HEIGHT = 12
/** Extra pixels drawn below hitbox so dirt “hangs” like the reference sprite (collision stays 12px). */
const PLATFORM_VISUAL_OVERHANG = 7
/** Tiny props along the platform rim — spacing uses half-width so two decos never touch. */
const PLATFORM_MUSHROOM_HALF_W = 12
const PLATFORM_MUSHROOM_MIN_CENTER_GAP = 26
const PLATFORM_MUSHROOM_EDGE_PAD = 10
const PLATFORM_FLOWER_HALF_W = 8
const PLATFORM_FLOWER_EDGE_PAD = 7
const PLATFORM_FLOWER_MIN_CENTER_GAP = 13
/** Tropical props along the platform rim. */
const PLATFORM_PALM_HALF_W = 18
const PLATFORM_PALM_EDGE_PAD = 14

const PALM_TREE_W = 44
const PALM_TREE_H = 74
const PALM_TREE_BASE_Y = 20
const PALM_TREE_IMAGE = require('../../public/wonderjump/palm-tree.png')
const CRAB_W = 26
const CRAB_H = 20
const CRAB_SPAWN_CHANCE = 0.14
const CRAB_PLUS2_MS = 650
const CRAB_DEATH_MS = 520
/** Bouncy platforms collide on spring tray, not grass top. */
const SPRING_COLLISION_RAISE = 6

const SPIKE_VISUAL_HEIGHT = 14
/** Spikes start once you’ve climbed this high (see heightScore in game loop). */
const SPIKE_MIN_HEIGHT_SCORE_GRASS = 70
const SPIKE_MIN_HEIGHT_SCORE_MUSHROOM = 0
/** First N main-chain platforms in the initial world never get spikes. */
const SPIKE_START_INITIAL_INDEX_GRASS = 8
const SPIKE_START_INITIAL_INDEX_MUSHROOM = 4
/** Procedural `while` can add many platforms in one tick — keep mints tiny so coins never “rain”. */
const MAX_COINS_MINTED_PER_TICK = 2
/** Hard cap on simultaneous coins; procedural + initial spawns both respect this when minting. */
const MAX_COINS_ALIVE = 16
const MAX_JETPACKS_ALIVE = 2
const MIN_JETPACK_VERTICAL_SEP = 220
const JETPACK_SPAWN_P_GRASS = 0.04
const JETPACK_SPAWN_P_MUSHROOM = 0.065
const JETPACK_PICKUP_W = 30
const JETPACK_PICKUP_H = 34
const JETPACK_DURATION_MS = 1650
const JETPACK_THRUST_VELOCITY = -12.2
const JETPACK_END_SPIKE_GRACE_MS = 420
/** Min |ΔY| between coin host platforms so they don’t stack into vertical clusters */
const MIN_COIN_VERTICAL_SEP = 64
/** Min |ΔX| from previous coin when spawning so they don’t form a vertical line */
const MIN_COIN_HORIZONTAL_SEP = 26
/** Doodle-style: faster lateral, floaty jump, pass-through platforms */
const BASE_SPEED = 6.2
const GRAVITY = 0.52
const NORMAL_JUMP_VELOCITY = -10.8
/** Spring pad — a clear boost over normal, not a sky launch */
const BOUNCY_JUMP_VELOCITY = -13.4
/**
 * Physics are tuned for a fixed ~60 Hz tick. `requestAnimationFrame` follows display refresh
 * (90–120 Hz) and applies velocity/gravity extra times per second, which makes jumps feel “broken”.
 */
const SIM_TICK_MS = 1000 / 60
const MAX_FALL_VELOCITY = 13
const TILE_HORIZONTAL_MARGIN = 12
/** Fewer starting rows = less crowded climbs (tune with vertical gaps below). */
const INITIAL_PLATFORM_COUNT = 22

/**
 * Vertical distance between chained platforms must stay within a normal hop (~112px max rise).
 * Caps + post-pass guarantee every main-chain step is always jumpable.
 */
const MIN_CHAIN_VERTICAL_GAP = 40
const MAX_CHAIN_VERTICAL_GAP = 78

/** ~50 main-chain steps × average vertical gap → switch into mushroom blend band */
const MUSHROOM_BIOME_HEIGHT_START = 50 * 58
/** Height score distance over which grassland scenery lerps into mushroom isles */
const MUSHROOM_BIOME_BLEND_RANGE = 780
/** When blend ≥ this, mushroom-biome gameplay tuning applies (sparser rows, fewer coins/pads). */
const MUSHROOM_GAMEPLAY_BLEND = 0.5
/** After mushroom isles, transition into the tropical archipelago biome. */
const TROPICAL_BIOME_HEIGHT_START = MUSHROOM_BIOME_HEIGHT_START + 50 * 58
/** Height score distance over which mushroom scenery lerps into tropical. */
const TROPICAL_BIOME_BLEND_RANGE = 820
/** When tropical blend ≥ this, tropical gameplay tuning applies (matches mushroom rates). */
const TROPICAL_GAMEPLAY_BLEND = 0.5
/** Extra vertical gap range for main-chain spawns in mushroom (still clamped jump-safe). */
const MUSHROOM_CHAIN_GAP_EXTRA_MIN = 8
const MUSHROOM_CHAIN_GAP_EXTRA_MAX = 10
/** P(attempt sibling row) — lower in mushroom for sparser side platforms */
const SIBLING_TRY_CHANCE_GRASS = 0.12
const SIBLING_TRY_CHANCE_MUSHROOM = 0.07
const COIN_SPAWN_P_GRASS = 0.15
const COIN_SPAWN_P_MUSHROOM = 0.12
const BOUNCY_CHANCE_GRASS = 0.21
const BOUNCY_CHANCE_MUSHROOM = 0.17

const GRASSLAND_THEME = {
  screenBg: '#c4e4f5',
  tileBg: '#7ec4ea',
  sky: '#92d2f5',
  sunGlow: 'rgba(255, 248, 210, 0.52)',
  hillFar: '#63a86a',
  hillNear: '#4f9a58',
  platformFill: '#59a84e',
  platformBorder: '#2d6a2a',
  platformHighlight: '#8edc72',
  platformDirt: '#7a5c3e',
  platformDirtDark: '#5c4228',
  movingAccent: '#4a8ecf',
  breakableFill: '#c4a06a',
  breakableBorder: '#7d5a28',
}

/** Minecraft-ish mushroom island: grey mycelium + maroon caps */
const MUSHROOM_THEME = {
  screenBg: '#c8c0dc',
  tileBg: '#8f85ae',
  sky: '#9f92bc',
  sunGlow: 'rgba(220, 200, 255, 0.42)',
  hillFar: '#6e6288',
  hillNear: '#5a4f72',
}
/** Warm tropical palette: sand + teal sky + island greens. */
const TROPICAL_THEME = {
  screenBg: '#c8f1ee',
  tileBg: '#74cfd0',
  sky: '#61cfe0',
  sunGlow: 'rgba(255, 240, 205, 0.46)',
  hillFar: '#2f8e79',
  hillNear: '#277a67',
  tree: 'rgba(18, 70, 60, 0.45)',
  treeDark: 'rgba(12, 50, 44, 0.55)',
}
const CLASSIC_GAME_FONT = Platform.select({
  ios: 'Courier',
  default: 'monospace',
})
const CLASSIC_GAME_FONT_BOLD = Platform.select({
  ios: 'Courier-Bold',
  default: 'monospace',
})

const BIOME_UI_ACCENTS: Record<
  WonderJumpStartBiome,
  {
    label: string
    accent: string
    accentSoft: string
  }
> = {
  grassland: {
    label: 'Grasslands',
    accent: '#2d6a3a',
    accentSoft: 'rgba(45, 106, 58, 0.34)',
  },
  mushroom: {
    label: 'Mushroom Isles',
    accent: '#6b3d55',
    accentSoft: 'rgba(107, 61, 85, 0.34)',
  },
  tropical: {
    label: 'Sunset Keys',
    accent: '#1d7f75',
    accentSoft: 'rgba(29, 127, 117, 0.34)',
  },
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function lerpColor(a: string, b: string, t: number) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const u = clamp(t, 0, 1)
  return rgbToHex(A.r + (B.r - A.r) * u, A.g + (B.g - A.g) * u, A.b + (B.b - A.b) * u)
}

function lerp3Color(a: string, b: string, c: string, tAB: number, tBC: number) {
  return lerpColor(lerpColor(a, b, tAB), c, tBC)
}

/** 0 = full grassland scene, 1 = full mushroom isles (used for sky/hills + platform surface mix). */
function getMushroomBlend(heightScore: number, startBiome: WonderJumpStartBiome): number {
  if (startBiome === 'mushroom' || startBiome === 'tropical') return 1
  return clamp((heightScore - MUSHROOM_BIOME_HEIGHT_START) / MUSHROOM_BIOME_BLEND_RANGE, 0, 1)
}

/** 0 = mushroom, 1 = tropical (used for sky/hills + platform surface mix). */
function getTropicalBlend(heightScore: number, startBiome: WonderJumpStartBiome): number {
  if (startBiome === 'tropical') return 1
  return clamp((heightScore - TROPICAL_BIOME_HEIGHT_START) / TROPICAL_BIOME_BLEND_RANGE, 0, 1)
}

function isMushroomGameplay(startBiome: WonderJumpStartBiome, mushroomBlend: number, tropicalBlend: number) {
  return (
    startBiome === 'mushroom' ||
    startBiome === 'tropical' ||
    mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND ||
    tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
  )
}

function pickPlatformSurface(mushroomBlend: number, tropicalBlend: number): PlatformSurfaceKind {
  if (tropicalBlend >= 0.08) {
    const sandChance = clamp(0.56 + tropicalBlend * 0.28, 0.55, 0.86)
    return Math.random() < sandChance ? 'sand' : 'grass'
  }
  if (mushroomBlend < 0.1) return 'grass'
  const roll = Math.random()
  if (mushroomBlend < 0.42) {
    const mushChance = (mushroomBlend - 0.1) / 0.32
    if (roll > mushChance * 0.85) return 'grass'
    return roll < 0.55 ? 'mushroom_grey' : 'mushroom_red'
  }
  if (mushroomBlend < 0.88) {
    if (roll < 0.22) return 'grass'
    return roll < 0.61 ? 'mushroom_grey' : 'mushroom_red'
  }
  return roll < 0.5 ? 'mushroom_grey' : 'mushroom_red'
}

function biomeHudLabel(mushroomBlend: number, tropicalBlend: number, startBiome: WonderJumpStartBiome): string {
  if (startBiome === 'tropical') return 'Sunset Keys'
  if (startBiome === 'mushroom') return tropicalBlend > 0.88 ? 'Sunset Keys' : 'Mushroom Isles'
  if (tropicalBlend > 0.9) return 'Sunset Keys'
  if (mushroomBlend > 0.9) return 'Mushroom Isles'
  if (mushroomBlend < 0.08) return 'Grasslands'
  return 'Mushroom frontier'
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** How far the player can drift sideways during one jump for this vertical gap (tuned for auto-bounce + air control). */
function maxReachXForVerticalGap(
  verticalGap: number,
  playWidth: number,
  heightDifficulty: number
) {
  const g = clamp(verticalGap, MIN_CHAIN_VERTICAL_GAP, MAX_CHAIN_VERTICAL_GAP)
  const reach = 50 + g * 0.85 + heightDifficulty * 36
  return clamp(reach, 76, playWidth * 0.52)
}

/** Force the next main-chain platform to be within a normal jump of `prev` (vertical + horizontal). */
function enforceChainReachable(
  prev: PlatformItem,
  next: PlatformItem,
  playWidth: number,
  heightDifficulty: number
): PlatformItem {
  const rawGap = prev.y - next.y
  const gap = clamp(rawGap, MIN_CHAIN_VERTICAL_GAP, MAX_CHAIN_VERTICAL_GAP)
  let fixed: PlatformItem = { ...next, y: prev.y - gap }

  const reach = maxReachXForVerticalGap(gap, playWidth, heightDifficulty) * 0.96
  const prevCx = prev.x + prev.width / 2
  const w = fixed.width
  const minX = 8
  const maxX = playWidth - w - 8
  const cMin = minX + w / 2
  const cMax = maxX + w / 2
  let c1 = fixed.x + w / 2
  if (Math.abs(c1 - prevCx) > reach) {
    c1 = prevCx + (c1 > prevCx ? reach : -reach)
  }
  c1 = clamp(c1, cMin, cMax)
  const x1 = c1 - w / 2
  fixed = { ...fixed, x: x1 }

  if (fixed.kind === 'moving') {
    const span = clamp(fixed.moveMaxX - fixed.moveMinX, 28, 88)
    fixed = {
      ...fixed,
      moveMinX: Math.max(6, x1 - span / 2),
      moveMaxX: Math.min(playWidth - w - 6, x1 + span / 2),
    }
  }
  return fixed
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Tighter AABB inside the triangle so hits feel like the pointy spike, not a big box. */
function playerHitsSpike(player: Player, spike: Spike) {
  const shrinkX = spike.width * 0.24
  const padTop = 2
  const hitX = spike.x + shrinkX
  const hitY = spike.y + padTop
  const hitW = spike.width - 2 * shrinkX
  const hitH = spike.height - padTop
  if (!rectsOverlap(player, { x: hitX, y: hitY, width: hitW, height: hitH })) {
    return false
  }

  const vx = player.velocityX
  const vy = player.velocityY
  const playerBottom = player.y + player.height

  // Falling onto / through the spike from above — lethal.
  if (vy > 0.28) {
    return true
  }

  // Clear sideways motion into the hazard — lethal (walk / air strafe into the sides).
  if (Math.abs(vx) > 1.2) {
    return true
  }

  // Rising: allow passing through the underside so heads don’t clip the spike base on the way up.
  if (vy < -0.1) {
    return false
  }

  // Jump apex / tiny vertical speed: still safe if the body is mostly in the lower (wide) part of the spike.
  const baseZoneBottom = hitY + hitH * 0.58
  if (playerBottom > baseZoneBottom) {
    return false
  }

  return true
}

function isSolid(platform: PlatformItem) {
  return !platform.isFalling
}

function platformTopY(platform: PlatformItem) {
  return platform.kind === 'bouncy' ? platform.y - SPRING_COLLISION_RAISE : platform.y
}

function horizontalLandOverlap(player: Player, platform: PlatformItem) {
  return (
    player.x + player.width - 6 >= platform.x &&
    player.x + 6 <= platform.x + platform.width
  )
}

function overlapWidth(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

function filterUnfairSpikes(spikes: Spike[], platforms: PlatformItem[]) {
  const platformBySpikeId = new Map(platforms.map((platform) => [`spike-${platform.id}`, platform]))
  return spikes.filter((spike) => {
    const host = platformBySpikeId.get(spike.id)
    if (!host) return false

    /*
     * Only drop spikes when a platform sits almost directly underneath with ~full width overlap
     * (true “ceiling” traps). The old thresholds used typical chain overlap (~40% width), which
     * matched almost every main-chain step — so every spike was filtered and none rendered.
     */
    const blocksJumpCorridor = platforms.some((candidate) => {
      if (candidate.id === host.id) return false
      const verticalGap = candidate.y - host.y
      if (verticalGap <= 24 || verticalGap > 38) return false
      const overlap = overlapWidth(
        host.x,
        host.x + host.width,
        candidate.x,
        candidate.x + candidate.width
      )
      const w = Math.min(host.width, candidate.width)
      return overlap >= w * 0.995
    })

    return !blocksJumpCorridor
  })
}

function spikeStartIndex(startBiome: WonderJumpStartBiome) {
  return startBiome === 'mushroom' || startBiome === 'tropical'
    ? SPIKE_START_INITIAL_INDEX_MUSHROOM
    : SPIKE_START_INITIAL_INDEX_GRASS
}

function spikeActivationHeight(startBiome: WonderJumpStartBiome, mushroomBlend: number, tropicalBlend: number) {
  if (isMushroomGameplay(startBiome, mushroomBlend, tropicalBlend)) {
    return SPIKE_MIN_HEIGHT_SCORE_MUSHROOM
  }
  return SPIKE_MIN_HEIGHT_SCORE_GRASS
}

function spawnPlatform(
  y: number,
  idSeed: number,
  playWidth: number,
  heightDifficulty: number,
  allowBreakable: boolean,
  previousPlatform?: PlatformItem,
  verticalGapFromPrevious?: number,
  mushroomBlend = 0,
  tropicalBlend = 0
): PlatformItem {
  const width =
    tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
      ? randomInRange(54, 112)
      : mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND
        ? randomInRange(60, 118)
        : randomInRange(64, 124)
  const minX = 8
  const maxX = playWidth - width - 8
  const centerMin = minX + width / 2
  const centerMax = playWidth - 8 - width / 2

  let x: number
  if (!previousPlatform || verticalGapFromPrevious === undefined) {
    x = randomInRange(minX, maxX)
  } else {
    const prevCx = previousPlatform.x + previousPlatform.width / 2
    const reach = maxReachXForVerticalGap(verticalGapFromPrevious, playWidth, heightDifficulty)

    const roll = Math.random()
    let targetCx: number

    if (roll < 0.28) {
      const biasHigh = prevCx > playWidth * 0.52
      const lo = biasHigh ? centerMin : (centerMin + centerMax) / 2
      const hi = biasHigh ? (centerMin + centerMax) / 2 : centerMax
      targetCx = randomInRange(lo, hi)
      if (Math.abs(targetCx - prevCx) > reach) {
        targetCx = clamp(prevCx + (targetCx > prevCx ? reach : -reach), centerMin, centerMax)
      }
    } else if (roll < 0.66) {
      const lo = clamp(prevCx - reach, centerMin, centerMax)
      const hi = clamp(prevCx + reach, centerMin, centerMax)
      targetCx = hi <= lo ? randomInRange(centerMin, centerMax) : randomInRange(lo, hi)
    } else {
      targetCx = clamp(prevCx + randomInRange(-reach, reach), centerMin, centerMax)
    }

    x = clamp(targetCx - width / 2, minX, maxX)
  }
  const tropicalHard = tropicalBlend >= TROPICAL_GAMEPLAY_BLEND ? 0.06 + tropicalBlend * 0.05 : 0
  const movingChance = clamp(0.14 + heightDifficulty * 0.16 + tropicalHard, 0.12, 0.46)
  const breakableChance = allowBreakable
    ? Math.min(0.06 + heightDifficulty * 0.08, 0.18)
    : 0
  const bouncyChance =
    mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND || tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
      ? BOUNCY_CHANCE_MUSHROOM
      : BOUNCY_CHANCE_GRASS
  let kind: PlatformKind = 'normal'
  const roll = Math.random()
  if (roll < movingChance) kind = 'moving'
  else if (roll < movingChance + breakableChance) kind = 'breakable'
  else if (roll < movingChance + breakableChance + bouncyChance) kind = 'bouncy'

  const moveDistance = randomInRange(34, 92)
  const surface = pickPlatformSurface(mushroomBlend, tropicalBlend)
  return {
    id: `platform-${idSeed}-${Math.round(y)}`,
    x,
    y,
    width,
    height: PLATFORM_HEIGHT,
    kind,
    moveMinX: Math.max(6, x - moveDistance),
    moveMaxX: Math.min(playWidth - width - 6, x + moveDistance),
    moveDir: Math.random() < 0.5 ? -1 : 1,
    moveSpeed: randomInRange(0.45, 1.1 + heightDifficulty * 0.6),
    breakProgress: 0,
    isFalling: false,
    fallingVelocityY: 0,
    surface,
    topMushrooms: buildPlatformTopMushrooms(surface, width, kind),
    topPalmTree: undefined,
    topFlowers: buildPlatformTopFlowers(surface, width, kind),
  }
}

/** Second platform on the same row — alternate route, not stacked in a straight column. */
function trySpawnSiblingPlatform(
  y: number,
  seed: number,
  playWidth: number,
  heightDifficulty: number,
  avoid: PlatformItem[],
  mushroomBlend: number,
  tropicalBlend: number
): PlatformItem | null {
  const siblingTry =
    mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND || tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
      ? SIBLING_TRY_CHANCE_MUSHROOM
      : SIBLING_TRY_CHANCE_GRASS
  if (Math.random() > siblingTry) return null
  for (let t = 0; t < 12; t += 1) {
    const p = spawnPlatform(
      y,
      seed * 1000 + t + 404,
      playWidth,
      heightDifficulty,
      false,
      undefined,
      undefined,
      mushroomBlend,
      tropicalBlend
    )
    if (!avoid.some((o) => rectsOverlap(o, p))) {
      return p
    }
  }
  return null
}

function spikeSpawnChance(mushroomBlend: number, tropicalBlend: number, startBiome: WonderJumpStartBiome, heightDifficulty: number) {
  const effectiveBlend = startBiome === 'tropical' ? 1 : Math.max(mushroomBlend, tropicalBlend)
  const biomeBase =
    effectiveBlend >= MUSHROOM_GAMEPLAY_BLEND
      ? 0.18 + (effectiveBlend - MUSHROOM_GAMEPLAY_BLEND) * 0.16
      : 0.05 + effectiveBlend * 0.05
  return clamp(biomeBase + heightDifficulty * 0.1, 0.04, 0.42)
}

function createSpikeOnPlatform(platform: PlatformItem): Spike | null {
  if (platform.kind === 'breakable' || platform.kind === 'bouncy' || platform.kind === 'moving') return null
  const width = clamp(Math.min(22, platform.width - 18), 14, 24)
  if (width < 12) return null
  const edgePad = 5
  const minX = platform.x + edgePad
  const maxX = platform.x + platform.width - width - edgePad
  if (maxX < minX) return null
  const cx = platform.x + platform.width / 2
  const centerClearW = clamp(platform.width * 0.3, 16, 26)
  const centerStart = cx - centerClearW / 2
  const centerEnd = cx + centerClearW / 2

  const leftMin = minX
  const leftMax = Math.min(maxX, centerStart - width)
  const rightMin = Math.max(minX, centerEnd)
  const rightMax = maxX
  const flowerZones =
    platform.topFlowers?.map((flower) => {
      const left = platform.x + flower.offsetX - PLATFORM_FLOWER_HALF_W - 3
      const right = platform.x + flower.offsetX + PLATFORM_FLOWER_HALF_W + 3
      return { left, right }
    }) ?? []

  const violatesFlowerZone = (x: number) => {
    const left = x
    const right = x + width
    return flowerZones.some((zone) => right > zone.left && left < zone.right)
  }
  const leftOk = leftMax >= leftMin
  const rightOk = rightMax >= rightMin
  if (!leftOk && !rightOk) return null

  let x: number | null = null
  for (let attempt = 0; attempt < 10 && x === null; attempt += 1) {
    const useLeft = leftOk && (!rightOk || Math.random() < 0.5)
    const candidate = useLeft
      ? randomInRange(leftMin, leftMax)
      : randomInRange(rightMin, rightMax)
    if (!violatesFlowerZone(candidate)) x = candidate
  }
  if (x === null) {
    const fallback = [leftMin, leftMax, rightMin, rightMax]
      .filter((v) => Number.isFinite(v))
      .find((v) => !violatesFlowerZone(v))
    if (fallback === undefined) return null
    x = fallback
  }
  return {
    id: `spike-${platform.id}`,
    x,
    y: platform.y - SPIKE_VISUAL_HEIGHT,
    width,
    height: SPIKE_VISUAL_HEIGHT,
    offsetX: x - platform.x,
  }
}

function spawnSpikes(
  platform: PlatformItem,
  allowSpikes: boolean,
  mushroomBlend: number,
  tropicalBlend: number,
  startBiome: WonderJumpStartBiome,
  heightDifficulty: number,
  forceSpawn = false
): Spike[] {
  if (!allowSpikes) return []
  if (!forceSpawn && Math.random() > spikeSpawnChance(mushroomBlend, tropicalBlend, startBiome, heightDifficulty)) return []
  const spike = createSpikeOnPlatform(platform)
  return spike ? [spike] : []
}

function pickCoinOffsetX(platform: PlatformItem, lastCoinWorldX: number | null): number {
  const pad = 10
  const lo = pad
  const hi = Math.max(lo + 4, platform.width - pad)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ox = randomInRange(lo, hi)
    if (lastCoinWorldX === null) return ox
    if (Math.abs(platform.x + ox - lastCoinWorldX) >= MIN_COIN_HORIZONTAL_SEP) return ox
  }
  if (lastCoinWorldX === null) return randomInRange(lo, hi)
  const towardLeft = lastCoinWorldX > platform.x + platform.width / 2
  return clamp(towardLeft ? lo + 3 : hi - 3, lo, hi)
}

function spawnCoin(
  platform: PlatformItem,
  hasSpike: boolean,
  currentAliveCount: number,
  lastCoinHostY: number | null,
  lastCoinWorldX: number | null,
  mushroomBlend: number,
  tropicalBlend: number,
  startBiome: WonderJumpStartBiome
): Coin[] {
  if (hasSpike) return []
  if (currentAliveCount >= MAX_COINS_ALIVE) return []
  if (
    lastCoinHostY !== null &&
    Math.abs(platform.y - lastCoinHostY) < MIN_COIN_VERTICAL_SEP
  ) {
    return []
  }
  const coinP = isMushroomGameplay(startBiome, mushroomBlend, tropicalBlend)
    ? COIN_SPAWN_P_MUSHROOM
    : COIN_SPAWN_P_GRASS
  if (Math.random() > coinP) return []
  const offsetX = pickCoinOffsetX(platform, lastCoinWorldX)
  const x = platform.x + offsetX
  return [
    {
      id: `coin-${platform.id}`,
      x,
      offsetX,
      y: platform.y - 20,
      radius: 6,
      collected: false,
      hostPlatformId: platform.id,
    },
   ]
}

function buildPlatformTopMushrooms(
  surface: PlatformSurfaceKind,
  width: number,
  kind: PlatformKind
): PlatformTopMushroom[] | undefined {
  if (surface !== 'mushroom_grey' && surface !== 'mushroom_red') return undefined

  const pickKind = (): PlatformMushroomDecoKind => (Math.random() < 0.52 ? 'single' : 'group')

  const baseLo = PLATFORM_MUSHROOM_EDGE_PAD + PLATFORM_MUSHROOM_HALF_W
  const baseHi = width - PLATFORM_MUSHROOM_EDGE_PAD - PLATFORM_MUSHROOM_HALF_W
  if (baseHi <= baseLo + 2) {
    return [{ offsetX: width / 2, kind: pickKind() }]
  }

  const reservedZones: Array<{ left: number; right: number }> = []
  if (kind === 'bouncy') {
    const spring = springPadBoundsForPlatform(width)
    reservedZones.push({
      left: spring.left - PLATFORM_MUSHROOM_HALF_W - 2,
      right: spring.right + PLATFORM_MUSHROOM_HALF_W + 2,
    })
  }

  const outsideReserved = (centerX: number) =>
    reservedZones.every((zone) => centerX < zone.left || centerX > zone.right)

  const centers: number[] = []
  const twoOk = baseHi - baseLo >= PLATFORM_MUSHROOM_MIN_CENTER_GAP + 2
  const target = twoOk && Math.random() < 0.5 ? 2 : 1
  for (let i = 0; i < target * 10 && centers.length < target; i += 1) {
    const c = randomInRange(baseLo, baseHi)
    if (!outsideReserved(c)) continue
    if (centers.some((existing) => Math.abs(existing - c) < PLATFORM_MUSHROOM_MIN_CENTER_GAP)) continue
    centers.push(c)
  }

  if (centers.length === 0) {
    const middle = width / 2
    if (outsideReserved(middle)) centers.push(clamp(middle, baseLo, baseHi))
  }
  if (centers.length === 0) return undefined

  return centers.map((offsetX) => ({ offsetX, kind: pickKind() }))
}

function canPlacePalmTree(
  platform: PlatformItem,
  offsetX: number,
  offsetY: number,
  otherPlatforms: PlatformItem[]
) {
  const palmRect = {
    x: platform.x + offsetX - PALM_TREE_W / 2,
    y: platform.y - PALM_TREE_H + PALM_TREE_BASE_Y + offsetY,
    width: PALM_TREE_W,
    height: PALM_TREE_H,
  }
  return !otherPlatforms.some((p) => {
    if (p.id === platform.id) return false
    // Only care about platforms above-ish the host; avoid visual collisions.
    if (p.y >= platform.y) return false
    const dy = platform.y - p.y
    if (dy > PALM_TREE_H + 10) return false
    // Fast reject if far in X.
    if (p.x > palmRect.x + palmRect.width + 8) return false
    if (p.x + p.width < palmRect.x - 8) return false
    return rectsOverlap(palmRect, {
      x: p.x - 4,
      y: p.y - 8,
      width: p.width + 8,
      height: PLATFORM_HEIGHT + 16,
    })
  })
}

function maybeAttachPalmTree(
  platform: PlatformItem,
  otherPlatforms: PlatformItem[],
  tropicalBlend: number,
  hasSpike: boolean
): PlatformItem {
  if (hasSpike) return { ...platform, topPalmTree: undefined }
  if (tropicalBlend < TROPICAL_GAMEPLAY_BLEND) return { ...platform, topPalmTree: undefined }
  if (platform.surface !== 'grass' && platform.surface !== 'sand') return { ...platform, topPalmTree: undefined }
  // 0–1 per platform.
  const spawnChance = clamp(0.38 + tropicalBlend * 0.36, 0.38, 0.72)
  if (Math.random() > spawnChance) return { ...platform, topPalmTree: undefined }

  const lo = PLATFORM_PALM_EDGE_PAD + PLATFORM_PALM_HALF_W
  const hi = platform.width - PLATFORM_PALM_EDGE_PAD - PLATFORM_PALM_HALF_W
  if (hi <= lo + 2) return { ...platform, topPalmTree: undefined }

  const reservedZones: Array<{ left: number; right: number }> = []
  if (platform.kind === 'bouncy') {
    const spring = springPadBoundsForPlatform(platform.width)
    reservedZones.push({
      left: spring.left - PLATFORM_PALM_HALF_W - 2,
      right: spring.right + PLATFORM_PALM_HALF_W + 2,
    })
  }
  const outsideReserved = (centerX: number) =>
    reservedZones.every((zone) => centerX < zone.left || centerX > zone.right)

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const offsetX = randomInRange(lo, hi)
    if (!outsideReserved(offsetX)) continue
    const offsetY = Math.round(randomInRange(-1, 2))
    if (!canPlacePalmTree(platform, offsetX, offsetY, otherPlatforms)) continue
    return { ...platform, topPalmTree: { offsetX, offsetY } }
  }

  return { ...platform, topPalmTree: undefined }
}

function spawnCrabOnPlatform(
  platform: PlatformItem,
  hasSpike: boolean,
  tropicalBlend: number,
  startBiome: WonderJumpStartBiome,
  seed: number
): Crab[] {
  if (hasSpike) return []
  if (startBiome !== 'tropical' && tropicalBlend < TROPICAL_GAMEPLAY_BLEND) return []
  if (platform.isFalling || platform.kind === 'breakable') return []
  if (platform.surface !== 'grass' && platform.surface !== 'sand') return []
  if (platform.width < 78) return []
  if (Math.random() > CRAB_SPAWN_CHANCE) return []

  const edge = 10
  let minLocalX = edge
  let maxLocalX = platform.width - edge - CRAB_W
  if (maxLocalX <= minLocalX + 6) return []

  // Don't walk through spring pad on bouncy platforms: pick a lane.
  if (platform.kind === 'bouncy') {
    const spring = springPadBoundsForPlatform(platform.width)
    const leftLaneMax = spring.left - 4 - CRAB_W
    const rightLaneMin = spring.right + 4
    const leftOk = leftLaneMax >= minLocalX + 4
    const rightOk = maxLocalX >= rightLaneMin + 4
    if (leftOk && rightOk) {
      if (Math.random() < 0.5) maxLocalX = leftLaneMax
      else minLocalX = rightLaneMin
    } else if (leftOk) {
      maxLocalX = leftLaneMax
    } else if (rightOk) {
      minLocalX = rightLaneMin
    } else {
      return []
    }
  }

  const localX = randomInRange(minLocalX, maxLocalX)
  return [
    {
      id: `crab-${platform.id}-${seed}`,
      hostPlatformId: platform.id,
      localX,
      minLocalX,
      maxLocalX,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: randomInRange(0.55, 0.9),
      width: CRAB_W,
      height: CRAB_H,
      alive: true,
      deathMs: 0,
      plus2Ms: 0,
    },
  ]
}

function spawnJetpack(
  platform: PlatformItem,
  currentAliveCount: number,
  lastJetpackY: number | null,
  mushroomBlend: number,
  tropicalBlend: number,
  startBiome: WonderJumpStartBiome
): JetpackPickup[] {
  if (platform.kind === 'breakable') return []
  if (currentAliveCount >= MAX_JETPACKS_ALIVE) return []
  const spawnP = isMushroomGameplay(startBiome, mushroomBlend, tropicalBlend)
    ? JETPACK_SPAWN_P_MUSHROOM
    : JETPACK_SPAWN_P_GRASS
  if (Math.random() > spawnP) return []
  const candidateY = platform.y - randomInRange(46, 90)
  if (lastJetpackY !== null && Math.abs(candidateY - lastJetpackY) < MIN_JETPACK_VERTICAL_SEP) return []
  const minX = 10
  const maxX = Math.max(minX, platform.x + platform.width - JETPACK_PICKUP_W / 2)
  const left = clamp(
    platform.x + platform.width / 2 + randomInRange(-64, 64) - JETPACK_PICKUP_W / 2,
    minX,
    maxX
  )
  return [
    {
      id: `jetpack-${platform.id}`,
      x: left,
      y: candidateY,
      width: JETPACK_PICKUP_W,
      height: JETPACK_PICKUP_H,
      collected: false,
      hoverPhase: randomInRange(0, Math.PI * 2),
    },
  ]
}

function springPadBoundsForPlatform(width: number) {
  const padW = clamp(Math.max(32, width - 8), 36, 78)
  const left = (width - padW) / 2
  return { left, right: left + padW }
}

function buildPlatformTopFlowers(
  surface: PlatformSurfaceKind,
  width: number,
  kind: PlatformKind
): PlatformTopFlower[] | undefined {
  if (surface !== 'grass' && surface !== 'sand') return undefined

  const kindPool: PlatformFlowerDecoKind[] = [
    'rosePink',
    'daisyBlue',
    'petalPeach',
    'violet',
    'hydrangea',
    'marigold',
    'azure',
    'sunburst',
  ]
  const pickFlowerKind = (): PlatformFlowerDecoKind =>
    kindPool[Math.floor(Math.random() * kindPool.length)]!

  const baseLo = PLATFORM_FLOWER_EDGE_PAD + PLATFORM_FLOWER_HALF_W
  const baseHi = width - PLATFORM_FLOWER_EDGE_PAD - PLATFORM_FLOWER_HALF_W
  if (baseHi <= baseLo + 2) {
    return [
      {
        offsetX: width / 2,
        offsetY: Math.round(randomInRange(-1, 2)),
        kind: pickFlowerKind(),
      },
    ]
  }

  const reservedZones: Array<{ left: number; right: number }> = []
  if (kind === 'bouncy') {
    const spring = springPadBoundsForPlatform(width)
    reservedZones.push({
      left: spring.left - PLATFORM_FLOWER_HALF_W - 2,
      right: spring.right + PLATFORM_FLOWER_HALF_W + 2,
    })
  }

  const outsideReserved = (centerX: number) =>
    reservedZones.every((zone) => centerX < zone.left || centerX > zone.right)

  const span = baseHi - baseLo
  const maxBySpacing = Math.min(4, Math.max(1, 1 + Math.floor(span / PLATFORM_FLOWER_MIN_CENTER_GAP)))
  const target = 1 + Math.floor(Math.random() * maxBySpacing)

  const centers: number[] = []
  for (let i = 0; i < target * 24 && centers.length < target; i += 1) {
    const c = randomInRange(baseLo, baseHi)
    if (!outsideReserved(c)) continue
    if (centers.some((existing) => Math.abs(existing - c) < PLATFORM_FLOWER_MIN_CENTER_GAP)) continue
    centers.push(c)
  }

  if (centers.length === 0) {
    const middle = width / 2
    if (outsideReserved(middle)) centers.push(clamp(middle, baseLo, baseHi))
  }
  if (centers.length === 0) return undefined

  return centers.map((offsetX) => ({
    offsetX,
    offsetY: Math.round(randomInRange(-1, 2)),
    kind: pickFlowerKind(),
  }))
}

function createInitialWorld(
  playWidth: number,
  playHeight: number,
  startBiome: WonderJumpStartBiome
) {
  const platforms: PlatformItem[] = []
  const spikes: Spike[] = []
  const coins: Coin[] = []
  const jetpacks: JetpackPickup[] = []
  const crabs: Crab[] = []
  const mainChainIndices: number[] = []
  let lastCoinHostY: number | null = null
  let lastCoinWorldX: number | null = null
  let lastJetpackY: number | null = null
  const initMushroomBlend = getMushroomBlend(0, startBiome)
  const initTropicalBlend = getTropicalBlend(0, startBiome)
  const firstSpikeIndex = spikeStartIndex(startBiome)

  let y = playHeight - 70
  let lastChainPlatform: PlatformItem | undefined
  for (let i = 0; i < INITIAL_PLATFORM_COUNT; i += 1) {
    const verticalGap = lastChainPlatform ? lastChainPlatform.y - y : undefined
    const platform = spawnPlatform(
      y,
      i,
      playWidth,
      0,
      false,
      lastChainPlatform,
      verticalGap,
      initMushroomBlend,
      initTropicalBlend
    )
    platforms.push(platform)
    mainChainIndices.push(platforms.length - 1)
    lastChainPlatform = platform
    const spikeAllowed = i >= firstSpikeIndex
    const newSpikes = spawnSpikes(platform, spikeAllowed, initMushroomBlend, initTropicalBlend, startBiome, 0)
    spikes.push(...newSpikes)
    platforms[platforms.length - 1] = maybeAttachPalmTree(
      { ...platforms[platforms.length - 1], topPalmTree: undefined },
      platforms,
      initTropicalBlend,
      newSpikes.length > 0
    )
    crabs.push(...spawnCrabOnPlatform(platforms[platforms.length - 1], newSpikes.length > 0, initTropicalBlend, startBiome, i))
    const fromChain = spawnCoin(
      platform,
      newSpikes.length > 0,
      coins.length,
      lastCoinHostY,
      lastCoinWorldX,
      initMushroomBlend,
      initTropicalBlend,
      startBiome
    )
    coins.push(...fromChain)
    if (fromChain.length) {
      lastCoinHostY = platform.y
      lastCoinWorldX = fromChain[0].x
    }
    const jetpackFromChain = spawnJetpack(platform, jetpacks.length, lastJetpackY, initMushroomBlend, initTropicalBlend, startBiome)
    if (jetpackFromChain.length) {
      jetpacks.push(...jetpackFromChain)
      lastJetpackY = jetpackFromChain[0].y
    }
    if (i > 1) {
      const sibling = trySpawnSiblingPlatform(y, i + 9000, playWidth, 0, platforms, initMushroomBlend, initTropicalBlend)
      if (sibling) {
        platforms.push(sibling)
        const sSpikes = spawnSpikes(sibling, spikeAllowed, initMushroomBlend, initTropicalBlend, startBiome, 0)
        spikes.push(...sSpikes)
        platforms[platforms.length - 1] = maybeAttachPalmTree(
          { ...platforms[platforms.length - 1], topPalmTree: undefined },
          platforms,
          initTropicalBlend,
          sSpikes.length > 0
        )
        crabs.push(...spawnCrabOnPlatform(platforms[platforms.length - 1], sSpikes.length > 0, initTropicalBlend, startBiome, i + 9000))
        /* Same row as chain — only allow a sibling coin if the chain didn’t get one (no horizontal pairs) */
        if (fromChain.length === 0) {
          const fromSib = spawnCoin(
            sibling,
            sSpikes.length > 0,
            coins.length,
            lastCoinHostY,
            lastCoinWorldX,
            initMushroomBlend,
            initTropicalBlend,
            startBiome
          )
          coins.push(...fromSib)
          if (fromSib.length) {
            lastCoinHostY = sibling.y
            lastCoinWorldX = fromSib[0].x
          }
        }
        const jetpackFromSib = spawnJetpack(sibling, jetpacks.length, lastJetpackY, initMushroomBlend, initTropicalBlend, startBiome)
        if (jetpackFromSib.length) {
          jetpacks.push(...jetpackFromSib)
          lastJetpackY = jetpackFromSib[0].y
        }
      }
    }
    const stepLo = isMushroomGameplay(startBiome, initMushroomBlend, initTropicalBlend) ? 54 : 48
    const step = clamp(randomInRange(stepLo, 88), MIN_CHAIN_VERTICAL_GAP, MAX_CHAIN_VERTICAL_GAP)
    y -= step
  }

  const spawnSurface = pickPlatformSurface(initMushroomBlend, initTropicalBlend)
  platforms[mainChainIndices[0]] = {
    ...platforms[mainChainIndices[0]],
    x: playWidth / 2 - 58,
    y: playHeight - 52,
    width: 116,
    kind: 'normal',
    moveMinX: playWidth / 2 - 58,
    moveMaxX: playWidth / 2 - 58,
    moveSpeed: 0,
    moveDir: 1,
    surface: spawnSurface,
    topMushrooms: buildPlatformTopMushrooms(spawnSurface, 116, 'normal'),
    topPalmTree: undefined,
    topFlowers: buildPlatformTopFlowers(spawnSurface, 116, 'normal'),
  }

  for (let k = 1; k < mainChainIndices.length; k += 1) {
    const prevI = mainChainIndices[k - 1]
    const curI = mainChainIndices[k]
    platforms[curI] = enforceChainReachable(platforms[prevI], platforms[curI], playWidth, 0)
  }

  const platformByIdInit = new Map(platforms.map((p) => [p.id, p]))
  const spikesResynced = spikes.map((spike) => {
    const hostId = spike.id.replace('spike-', '')
    const host = platformByIdInit.get(hostId)
    if (!host) return spike
    return { ...spike, x: host.x + spike.offsetX, y: host.y - spike.height }
  })

  const spawn = platforms[0]
  const player: Player = {
    x: spawn.x + spawn.width / 2 - PLAYER_SIZE / 2,
    y: spawn.y - PLAYER_SIZE,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityX: 0,
    velocityY: 0,
    onGround: true,
    groundPlatformId: spawn.id,
    groundKind: spawn.kind,
  }

  let safeSpikes = filterUnfairSpikes(spikesResynced, platforms)
    const minInitialSpikes = startBiome === 'mushroom' || startBiome === 'tropical' ? 3 : 2
  if (safeSpikes.length < minInitialSpikes) {
    const usedHostIds = new Set(safeSpikes.map((s) => s.id.replace('spike-', '')))
    const candidateChain = mainChainIndices
      .map((idx) => platforms[idx])
      .filter((p, idx) => idx >= (startBiome === 'mushroom' || startBiome === 'tropical' ? 2 : 4))
      .filter((p) => p.kind !== 'breakable' && p.kind !== 'bouncy' && !usedHostIds.has(p.id))
    for (const host of candidateChain) {
      if (safeSpikes.length >= minInitialSpikes) break
      const extra = createSpikeOnPlatform(host)
      if (!extra) continue
      safeSpikes.push(extra)
      usedHostIds.add(host.id)
    }
  }

  return {
    player,
    platforms,
    spikes: safeSpikes,
    coins,
    jetpacks,
    crabs,
    lastCoinHostY,
    lastCoinWorldX,
    lastJetpackY,
  }
}

function createInitialState(
  mode: RunMode,
  playWidth: number,
  playHeight: number,
  startBiome: WonderJumpStartBiome
): GameState {
  const world = createInitialWorld(playWidth, playHeight, startBiome)
  const player =
    mode === 'playing'
      ? {
          ...world.player,
          onGround: false,
          groundPlatformId: null,
          groundKind: null,
          velocityY: NORMAL_JUMP_VELOCITY,
        }
      : world.player

  return {
    mode,
    player,
    platforms: world.platforms,
    spikes: world.spikes,
    coins: world.coins,
    jetpacks: world.jetpacks,
    crabs: world.crabs,
    cameraY: 0,
    heightScore: 0,
    coinScore: 0,
    lastCoinHostY: world.lastCoinHostY,
    lastCoinWorldX: world.lastCoinWorldX,
    lastJetpackY: world.lastJetpackY,
    jetpackFuelMs: 0,
    jetpackEndGraceMs: 0,
    jetpackAnimTick: 0,
    uiAnimTick: 0,
    startBiome,
  }
}

/** Doodle-style spring: wood tray + metal coil (SVG only — no `Line` primitive). */
const DoodleSpringPad = memo(function DoodleSpringPad({ platformWidth }: { platformWidth: number }) {
  const padW = clamp(Math.max(32, platformWidth - 8), 36, 78)
  const left = (platformWidth - padW) / 2
  return (
    <Svg
      pointerEvents="none"
      style={[styles.springPadSvg, { width: padW, left, top: -15 }]}
      width={padW}
      height={17}
      viewBox="0 0 100 17"
      preserveAspectRatio="none"
    >
      <Path
        d="M4 12.5 L6 14.2 L94 14.2 L96 12.5 L96 11 L94 9.5 L6 9.5 L4 11 Z"
        fill="#4a3018"
        stroke="#2a1a0e"
        strokeWidth={0.35}
      />
      <Path d="M7 10.2 L93 10.2 L91 8.6 L9 8.6 Z" fill="#7a5230" opacity={0.92} />
      <Rect x={8} y={11.2} width={84} height={2.2} rx={0.4} fill="#3d2814" opacity={0.55} />
      <Path
        d="M18 8.8 C22 4.5 26 4.5 30 8.8 C34 13.1 38 13.1 42 8.8 C46 4.5 50 4.5 54 8.8 C58 13.1 62 13.1 66 8.8 C70 4.5 74 4.5 78 8.8 C82 13.1 86 13.1 90 8.8"
        fill="none"
        stroke="#6a7580"
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 8.8 C22 4.5 26 4.5 30 8.8 C34 13.1 38 13.1 42 8.8 C46 4.5 50 4.5 54 8.8 C58 13.1 62 13.1 66 8.8 C70 4.5 74 4.5 78 8.8 C82 13.1 86 13.1 90 8.8"
        fill="none"
        stroke="#9aa8b5"
        strokeWidth={0.45}
        strokeLinecap="round"
        opacity={0.65}
      />
      <Ellipse cx={50} cy={6.2} rx={10} ry={2.1} fill="#c4d0dc" opacity={0.35} />
      <Path
        d="M12 9.2 L88 9.2"
        stroke="#a89078"
        strokeWidth={0.35}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  )
})

const SURFACE_PALETTES: Record<
  PlatformSurfaceKind,
  { dirtA: string; dirtB: string; top: string; topLine: string; topHi: string; blade: string }
> = {
  grass: {
    dirtA: '#4a2c16',
    dirtB: '#5c3822',
    top: '#5ec24f',
    topLine: '#3f8f38',
    topHi: '#8ee678',
    blade: '#2d6a28',
  },
  sand: {
    dirtA: '#8a6a41',
    dirtB: '#9a7647',
    top: '#f2d38a',
    topLine: '#d1ae62',
    topHi: '#fff2c7',
    blade: '#c69e4f',
  },
  mushroom_grey: {
    dirtA: '#35383f',
    dirtB: '#434750',
    top: '#8b929e',
    topLine: '#6a717d',
    topHi: '#b8c0cc',
    blade: '#4a5058',
  },
  mushroom_red: {
    dirtA: '#3d2428',
    dirtB: '#4f2e34',
    top: '#8f3d4f',
    topLine: '#6d2c38',
    topHi: '#c45a6e',
    blade: '#4a2830',
  },
}

/** Pixel-style grass / mycelium cap + jagged dirt; palette from biome surface. */
const BiomePlatformFace = memo(function BiomePlatformFace({
  width,
  height,
  surface,
}: {
  width: number
  height: number
  surface: PlatformSurfaceKind
}) {
  const W = 100
  const H = 14
  const grassH = 5.25
  const p = SURFACE_PALETTES[surface]
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path
        fill={p.dirtA}
        d="M0,5.6 L0,12.6 L2.5,13.9 L7,12 L13.5,13.4 L21,11.7 L29.5,12.9 L38,11.1 L48,13 L56.5,11.4 L66,12.7 L74,11 L82.5,13.1 L90,11.6 L95.5,12.9 L100,11.8 L100,5.6 Z"
      />
      <Path
        fill={p.dirtB}
        d="M0,5.6 L0,11.8 L3,13.2 L9,11.5 L16,12.8 L25,10.9 L34,12.2 L44,10.6 L54,12.4 L63,10.8 L72.5,12.5 L81,11 L89.5,12.6 L96,11.2 L100,12 L100,5.6 Z"
      />
      <Rect x="0" y="0" width={W} height={grassH} fill={p.top} />
      <Rect x="0" y={grassH - 0.35} width={W} height={0.55} fill={p.topLine} opacity={0.88} />
      <Rect x="0" y="0" width={W} height={1.15} fill={p.topHi} opacity={0.55} />
      {[6, 18, 30, 44, 58, 71, 85, 94].map((cx, i) => (
        <Rect
          key={i}
          x={cx - 0.45}
          y={grassH - 1.35}
          width={0.9}
          height={1.45}
          rx={0.2}
          fill={p.blade}
          opacity={0.45}
        />
      ))}
    </Svg>
  )
})

type GrasslandPlatformKind = 'normal' | 'moving' | 'breakable'

/** Two clipped halves + center void so it reads as “cracked”; halves sit slightly lower (fixed) until gameplay drops the tile. */
const BreakableSplitPlatformFace = memo(function BreakableSplitPlatformFace({
  width,
  height,
  surface,
}: {
  width: number
  height: number
  surface: PlatformSurfaceKind
}) {
  const gap = Math.max(6, Math.min(11, width * 0.095))
  const halfW = width / 2 - gap / 2
  const crackW = gap + 9
  const crackLeft = width / 2 - crackW / 2
  return (
    <View style={styles.platformGraphicWrap} pointerEvents="none">
      <View
        style={[
          styles.breakableHalfClip,
          {
            left: 0,
            top: 4.5,
            width: halfW,
            height,
          },
        ]}
      >
        <BiomePlatformFace width={width} height={height} surface={surface} />
      </View>
      <View
        style={[
          styles.breakableHalfClip,
          {
            left: width / 2 + gap / 2,
            top: 7.5,
            width: halfW,
            height,
          },
        ]}
      >
        <View style={{ marginLeft: -(width / 2 + gap / 2) }}>
          <BiomePlatformFace width={width} height={height} surface={surface} />
        </View>
      </View>
      <Svg
        pointerEvents="none"
        style={[styles.breakableCrackSvg, { left: crackLeft, top: 0, width: crackW, height }]}
        width={crackW}
        height={height}
        viewBox="0 0 10 20"
        preserveAspectRatio="none"
      >
        <Path
          d="M5 0 L3.4 3.5 L6.2 7 L3.9 10.5 L6.1 14 L4.3 17.2 L5.4 20"
          fill="none"
          stroke="#120c08"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M5 0.8 L4.2 5 L5.7 9.5 L4 13.5 L5.9 17 L5.1 19.6"
          fill="none"
          stroke="#3d2818"
          strokeWidth={0.45}
          strokeLinecap="round"
          opacity={0.85}
        />
      </Svg>
    </View>
  )
})

const GrasslandPlatformGraphic = memo(function GrasslandPlatformGraphic({
  width,
  height,
  kind,
  surface,
}: {
  width: number
  height: number
  kind: GrasslandPlatformKind
  surface: PlatformSurfaceKind
}) {
  if (kind === 'breakable') {
    return <BreakableSplitPlatformFace width={width} height={height} surface={surface} />
  }
  return (
    <View style={styles.platformGraphicWrap} pointerEvents="none">
      <BiomePlatformFace width={width} height={height} surface={surface} />
      {kind === 'moving' ? <View style={styles.platformTintMoving} /> : null}
    </View>
  )
})

const SpikeGraphic = memo(function SpikeGraphic({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}) {
  const mid = width / 2
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left, top, width, height }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Polygon
        points={`${mid},0.5 ${width - 0.4},${height} 0.4,${height}`}
        fill="#6a7380"
        stroke="#252b33"
        strokeWidth="1"
      />
      <Polygon
        points={`${mid},2.5 ${width - 3.5},${height - 0.8} 3.5,${height - 0.8}`}
        fill="#9aa3ad"
      />
      <Path
        stroke="#c5ccd4"
        strokeWidth="0.6"
        d={`M${mid * 0.55},${height * 0.55} L${mid * 1.45},${height * 0.72}`}
      />
    </Svg>
  )
})

/** Tiny vector fly-agaric props (no raster assets). */
const DecoMushroomSingleSvg = memo(function DecoMushroomSingleSvg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 14 18" preserveAspectRatio="xMidYMax meet">
      <Path
        d="M 4.5 17.2 L 3.6 11.2 L 10.4 11.2 L 9.5 17.2 L 8.2 18 L 5.8 18 Z"
        fill="#f2eee8"
        stroke="#1c1c1c"
        strokeWidth={0.85}
        strokeLinejoin="round"
      />
      <Rect x={4.2} y={10.5} width={5.6} height={1.1} fill="#d8d4ce" />
      <Path
        d="M 1.8 11.2 Q 7 2.2 12.2 11.2 Z"
        fill="#d92323"
        stroke="#1c1c1c"
        strokeWidth={0.85}
        strokeLinejoin="round"
      />
      <Circle cx={4.8} cy={7.2} r={1.15} fill="#faf8f5" />
      <Circle cx={9.1} cy={8.4} r={0.85} fill="#faf8f5" />
      <Circle cx={7} cy={5.3} r={0.75} fill="#faf8f5" />
    </Svg>
  )
})

const DecoMushroomGroupSvg = memo(function DecoMushroomGroupSvg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 30 20" preserveAspectRatio="xMidYMax meet">
      <Path
        d="M 5.2 18.5 L 4.2 12.5 L 11.8 12.5 L 10.8 18.5 L 9 19.2 L 7 19.2 Z"
        fill="#f2eee8"
        stroke="#1c1c1c"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <Rect x={5} y={11.8} width={6} height={1} fill="#d8d4ce" />
      <Path
        d="M 2.2 12.5 Q 8.5 3.5 14.8 12.5 Z"
        fill="#d92323"
        stroke="#1c1c1c"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <Circle cx={6} cy={8.5} r={1.2} fill="#faf8f5" />
      <Circle cx={11} cy={9.5} r={0.9} fill="#faf8f5" />
      <Circle cx={8.5} cy={6} r={0.8} fill="#faf8f5" />

      <Path
        d="M 19.8 18.8 L 19.1 14.2 L 24.9 14.2 L 24.2 18.8 L 23.2 19.3 L 20.8 19.3 Z"
        fill="#ebe7e0"
        stroke="#1c1c1c"
        strokeWidth={0.75}
        strokeLinejoin="round"
      />
      <Rect x={20.8} y={13.6} width={3.4} height={0.85} fill="#d0ccc5" />
      <Path
        d="M 18.2 14.2 Q 22.5 7.2 26.8 14.2 Z"
        fill="#d01e1e"
        stroke="#1c1c1c"
        strokeWidth={0.75}
        strokeLinejoin="round"
      />
      <Circle cx={20.5} cy={11.2} r={0.75} fill="#faf8f5" />
      <Circle cx={24} cy={12} r={0.65} fill="#faf8f5" />
    </Svg>
  )
})

const FLOWER_PALETTES: Record<PlatformFlowerDecoKind, { petal: string; petal2: string; center: string }> = {
  rosePink: { petal: '#c93e73', petal2: '#ef7aa5', center: '#ffdb6c' },
  daisyBlue: { petal: '#2d76d9', petal2: '#6da8f4', center: '#ffd34f' },
  petalPeach: { petal: '#cf684f', petal2: '#f2a67f', center: '#ffc93d' },
  violet: { petal: '#6c2d9f', petal2: '#9a63d1', center: '#ffc36b' },
  hydrangea: { petal: '#4b67b9', petal2: '#7993df', center: '#d9e8ff' },
  marigold: { petal: '#ce6312', petal2: '#ef973f', center: '#ffd14b' },
  azure: { petal: '#1c8fc8', petal2: '#4dc0e8', center: '#ff9fbe' },
  sunburst: { petal: '#d78b00', petal2: '#f0bf3d', center: '#ffe077' },
}

const DecoFlowerSvg = memo(function DecoFlowerSvg({ kind }: { kind: PlatformFlowerDecoKind }) {
  const p = FLOWER_PALETTES[kind]
  return (
    <Svg width="100%" height="100%" viewBox="0 0 16 22" preserveAspectRatio="xMidYMax meet">
      <Rect x="7" y="11" width="2" height="10" fill="#2a9c4d" />
      <Rect x="6" y="12" width="1" height="6" fill="#2fbe5f" />
      <Rect x="9" y="13" width="1" height="6" fill="#2fbe5f" />
      <Rect x="4" y="13" width="2" height="2" fill="#7bd66f" />
      <Rect x="4" y="15" width="2" height="2" fill="#5acb63" />
      <Rect x="10" y="14" width="2" height="2" fill="#7bd66f" />
      <Rect x="10" y="16" width="2" height="2" fill="#5acb63" />
      <Rect x="3" y="14" width="1" height="2" fill="#1f7f3f" opacity={0.8} />
      <Rect x="12" y="15" width="1" height="2" fill="#1f7f3f" opacity={0.8} />
      <Rect x="7" y="2" width="2" height="3" fill={p.petal2} />
      <Rect x="7" y="7" width="2" height="3" fill={p.petal2} />
      <Rect x="4" y="5" width="3" height="2" fill={p.petal2} />
      <Rect x="9" y="5" width="3" height="2" fill={p.petal2} />
      <Rect x="5" y="3" width="2" height="2" fill={p.petal} />
      <Rect x="9" y="3" width="2" height="2" fill={p.petal} />
      <Rect x="5" y="7" width="2" height="2" fill={p.petal} />
      <Rect x="9" y="7" width="2" height="2" fill={p.petal} />
      <Rect x="6" y="4" width="4" height="4" fill={p.petal} />
      <Rect x="7" y="5" width="2" height="2" fill={p.center} />
      <Rect x="6" y="1" width="4" height="1" fill="#143d8b" opacity={0.5} />
      <Rect x="3" y="4" width="1" height="4" fill="#143d8b" opacity={0.5} />
      <Rect x="12" y="4" width="1" height="4" fill="#143d8b" opacity={0.5} />
      <Rect x="6" y="9" width="4" height="1" fill="#142f63" opacity={0.62} />
      <Rect x="3" y="5" width="1" height="2" fill="#142f63" opacity={0.62} />
      <Rect x="12" y="5" width="1" height="2" fill="#142f63" opacity={0.62} />
    </Svg>
  )
})

const PlatformTopMushroomsLayer = memo(function PlatformTopMushroomsLayer({
  mushrooms,
}: {
  mushrooms: PlatformTopMushroom[]
}) {
  return (
    <>
      {mushrooms.map((m, i) => {
        const w = m.kind === 'single' ? 17 : 30
        const h = m.kind === 'single' ? 21 : 22
        return (
          <View
            key={`${m.kind}-${m.offsetX.toFixed(1)}-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: m.offsetX - w / 2,
              top: -h + 5,
              width: w,
              height: h,
            }}
          >
            {m.kind === 'single' ? <DecoMushroomSingleSvg /> : <DecoMushroomGroupSvg />}
          </View>
        )
      })}
    </>
  )
})

const PlatformTopFlowersLayer = memo(function PlatformTopFlowersLayer({
  flowers,
}: {
  flowers: PlatformTopFlower[]
}) {
  return (
    <>
      {flowers.map((f, i) => {
        const w = 16
        const h = 22
        return (
          <View
            key={`${f.kind}-${f.offsetX.toFixed(1)}-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: f.offsetX - w / 2,
              top: -h + 5 + f.offsetY,
              width: w,
              height: h,
            }}
          >
            <DecoFlowerSvg kind={f.kind} />
          </View>
        )
      })}
    </>
  )
})

const JumpPlatformRow = memo(function JumpPlatformRow({
  left,
  top,
  width,
  shellHeight,
  graphicKind,
  surface,
  isBouncy,
  isFalling,
  topMushrooms,
  topPalmTree,
  topFlowers,
}: {
  left: number
  top: number
  width: number
  shellHeight: number
  graphicKind: GrasslandPlatformKind
  surface: PlatformSurfaceKind
  isBouncy: boolean
  isFalling: boolean
  topMushrooms?: PlatformTopMushroom[]
  topPalmTree?: PlatformTopPalmTree
  topFlowers?: PlatformTopFlower[]
}) {
  return (
    <View
      style={[
        styles.platformShell,
        isFalling ? styles.platformFalling : null,
        { left, top, width, height: shellHeight },
      ]}
      collapsable={false}
    >
      <GrasslandPlatformGraphic width={width} height={shellHeight} kind={graphicKind} surface={surface} />
      {topMushrooms?.length ? <PlatformTopMushroomsLayer mushrooms={topMushrooms} /> : null}
      {topPalmTree ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: topPalmTree.offsetX - PALM_TREE_W / 2,
            top: -PALM_TREE_H + PALM_TREE_BASE_Y + topPalmTree.offsetY,
            width: PALM_TREE_W,
            height: PALM_TREE_H,
          }}
        >
          <Image
            source={PALM_TREE_IMAGE}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>
      ) : null}
      {topFlowers?.length ? <PlatformTopFlowersLayer flowers={topFlowers} /> : null}
      {isBouncy ? <DoodleSpringPad platformWidth={width} /> : null}
    </View>
  )
})

const CoinView = memo(function CoinView({
  left,
  top,
  diameter,
}: {
  left: number
  top: number
  diameter: number
}) {
  const r = diameter / 2
  return (
    <View
      style={[
        styles.coin,
        {
          left,
          top,
          width: diameter,
          height: diameter,
          borderRadius: r,
        },
      ]}
    >
      <View style={styles.coinInner} />
    </View>
  )
})

const JetpackPickupView = memo(function JetpackPickupView({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}) {
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left, top, width, height }}
      width={width}
      height={height}
      viewBox="0 0 30 34"
      preserveAspectRatio="none"
    >
      <Rect x="9" y="10" width="12" height="14" fill="#2a2e34" />
      <Rect x="8" y="9" width="14" height="1" fill="#505761" />
      <Rect x="10" y="12" width="10" height="7" fill="#3e434b" />
      <Rect x="3" y="12" width="6" height="12" fill="#f0f2f4" />
      <Rect x="21" y="12" width="6" height="12" fill="#f0f2f4" />
      <Rect x="3" y="11" width="6" height="1" fill="#d91b1b" />
      <Rect x="21" y="11" width="6" height="1" fill="#d91b1b" />
      <Rect x="13" y="3" width="4" height="6" fill="#ef1d27" />
      <Rect x="14" y="2" width="2" height="1" fill="#f6a6ab" />
      <Rect x="9" y="24" width="12" height="2" fill="#cdd2d8" />
      <Rect x="11" y="26" width="8" height="4" fill="#8d939a" />
      <Rect x="10" y="30" width="10" height="2" fill="#121417" />
      <Rect x="7" y="14" width="1" height="8" fill="#111318" opacity={0.35} />
      <Rect x="22" y="14" width="1" height="8" fill="#111318" opacity={0.35} />
      <Rect x="12" y="20" width="6" height="1" fill="#68707b" opacity={0.45} />
    </Svg>
  )
})

const CrabView = memo(function CrabView({
  left,
  top,
  width,
  height,
  deadProgress,
  legFrame,
}: {
  left: number
  top: number
  width: number
  height: number
  deadProgress: number
  legFrame: 0 | 1
}) {
  const squash = deadProgress > 0 ? clamp(1 - deadProgress * 0.65, 0.35, 1) : 1
  const fade = deadProgress > 0 ? clamp(1 - deadProgress * 1.15, 0, 1) : 1
  const splat = deadProgress > 0 ? clamp(deadProgress * 1.4, 0, 1) : 0
  const shell = '#e10000'
  const shellDark = '#b10000'
  const outline = '#000000'
  const eye = '#f4f4f4'
  const clawsFrameA = [
    'M2 11 L0 7 L2 5 L4 7 Z',
    'M24 11 L26 7 L24 5 L22 7 Z',
  ]
  const clawsFrameB = [
    'M2 10 L0 6 L2 4 L4 6 Z',
    'M24 10 L26 6 L24 4 L22 6 Z',
  ]
  const legsFrameA = [
    { x: 4, y: 15, w: 3, h: 2 },
    { x: 8, y: 17, w: 3, h: 2 },
    { x: 15, y: 17, w: 3, h: 2 },
    { x: 19, y: 15, w: 3, h: 2 },
  ]
  const legsFrameB = [
    { x: 3, y: 16, w: 3, h: 2 },
    { x: 8, y: 15, w: 3, h: 2 },
    { x: 15, y: 15, w: 3, h: 2 },
    { x: 20, y: 16, w: 3, h: 2 },
  ]
  const claws = legFrame === 0 ? clawsFrameA : clawsFrameB
  const legs = legFrame === 0 ? legsFrameA : legsFrameB
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        opacity: fade,
        transform: [{ scaleY: squash }],
      }}
    >
      {deadProgress > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width * 0.1,
            top: height * (0.65 + (1 - squash) * 0.18),
            width: width * 0.8,
            height: Math.max(3, height * 0.28),
            borderRadius: 10,
            backgroundColor: `rgba(180, 20, 20, ${0.5 * splat})`,
          }}
        />
      ) : null}
      <Svg width="100%" height="100%" viewBox="0 0 26 20" preserveAspectRatio="none">
        {claws.map((d, i) => (
          <Path key={`cl-${i}`} d={d} fill={shell} stroke={outline} strokeWidth={0.9} strokeLinejoin="round" />
        ))}
        {legs.map((r, i) => (
          <Rect
            key={`lg-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={shell}
            stroke={outline}
            strokeWidth={0.8}
          />
        ))}
        <Path
          d="M4 11 C4 7 7 5.6 13 5.6 C19 5.6 22 7 22 11 C22 15.2 19 17 13 17 C7 17 4 15.1 4 11 Z"
          fill={shell}
          stroke={outline}
          strokeWidth={1}
        />
        <Ellipse cx="13" cy="12" rx="6.8" ry="3.5" fill={shellDark} opacity={0.45} />
        <Path d="M6 7.2 C8.4 6.4 17.8 6.4 20 7.2" stroke="#ff8d8d" strokeWidth={1.1} strokeLinecap="round" opacity={0.62} />
        <Rect x="9.2" y="4.4" width="2.4" height="2.2" fill={eye} stroke={outline} strokeWidth={0.8} />
        <Rect x="14.4" y="4.4" width="2.4" height="2.2" fill={eye} stroke={outline} strokeWidth={0.8} />
        <Rect x="10" y="5" width="0.9" height="1.2" fill={outline} />
        <Rect x="15.2" y="5" width="0.9" height="1.2" fill={outline} />
      </Svg>
    </View>
  )
})

const PlayerJetpackFx = memo(function PlayerJetpackFx({
  left,
  top,
  frame,
}: {
  left: number
  top: number
  frame: number
}) {
  const flameTall = frame % 2 === 0
  const flameLeftH = flameTall ? 22 : 17
  const flameRightH = flameTall ? 17 : 22
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: 44, height: 60 }}>
      <Svg width={44} height={60} viewBox="0 0 44 60" preserveAspectRatio="none">
        <Rect x="10" y="11" width="14" height="16" fill="#2b2f35" />
        <Rect x="11" y="12" width="12" height="7" fill="#40454d" />
        <Rect x="5" y="13" width="6" height="13" fill="#f0f2f4" />
        <Rect x="23" y="13" width="6" height="13" fill="#f0f2f4" />
        <Rect x="5" y="12" width="6" height="1" fill="#d82020" />
        <Rect x="23" y="12" width="6" height="1" fill="#d82020" />
        <Rect x="15" y="4" width="4" height="7" fill="#ef1d27" />
        <Rect x="16" y="3" width="2" height="1" fill="#f6a6ab" />
        <Rect x="10" y="27" width="14" height="2" fill="#cfd4d9" />
        <Rect x="13" y="29" width="8" height="2" fill="#8a8f95" />
        <Rect x="5" y={31} width="5" height={flameLeftH} fill="#ff6b11" />
        <Rect x="6" y={34} width="3" height={Math.max(8, flameLeftH - 6)} fill="#ffd85a" />
        <Rect x="7" y={37} width="1" height={Math.max(5, flameLeftH - 10)} fill="#fff2c5" />
        <Rect x="24" y={31} width="5" height={flameRightH} fill="#ff6b11" />
        <Rect x="25" y={34} width="3" height={Math.max(8, flameRightH - 6)} fill="#ffd85a" />
        <Rect x="26" y={37} width="1" height={Math.max(5, flameRightH - 10)} fill="#fff2c5" />
      </Svg>
    </View>
  )
})

const GrasslandCloud = memo(function GrasslandCloud({ left, top, width }: { left: number; top: number; width: number }) {
  const h = 40
  return (
    <View style={[styles.cloudRoot, { left, top, width, height: h }]} pointerEvents="none">
      <View
        style={[
          styles.cloudBlob,
          { width: width * 0.55, height: h * 0.52, left: width * 0.06, top: h * 0.34 },
        ]}
      />
      <View
        style={[
          styles.cloudBlob,
          { width: width * 0.42, height: h * 0.44, left: width * 0.38, top: h * 0.4 },
        ]}
      />
      <View
        style={[
          styles.cloudBlob,
          { width: width * 0.36, height: h * 0.4, left: width * 0.54, top: h * 0.26 },
        ]}
      />
      <View
        style={[
          styles.cloudBlob,
          { width: width * 0.48, height: h * 0.48, left: width * 0.14, top: h * 0.1 },
        ]}
      />
      <View style={[styles.cloudShadowBase, { width: width * 0.72 }]} />
      {[
        [0.18, 0.38],
        [0.42, 0.52],
        [0.66, 0.34],
        [0.28, 0.62],
        [0.52, 0.48],
        [0.78, 0.56],
      ].map(([fx, fy], i) => (
        <View
          key={`sp-${i}`}
          style={[
            styles.cloudSpeck,
            {
              left: width * fx,
              top: h * fy,
            },
          ]}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <View
          key={`ln-${i}`}
          style={[
            styles.cloudHatch,
            {
              top: 8 + i * 11,
              left: 6 + i * 5,
              width: width - 16,
            },
          ]}
        />
      ))}
    </View>
  )
})

const WonderSkyBackdrop = memo(function WonderSkyBackdrop({
  width,
  height,
  mushroomBlend,
  tropicalBlend,
}: {
  width: number
  height: number
  mushroomBlend: number
  tropicalBlend: number
}) {
  const gradId = useRef(`wjSky_${Math.random().toString(36).slice(2, 9)}`).current
  const m = clamp(mushroomBlend, 0, 1)
  const t = clamp(tropicalBlend, 0, 1)
  const bottom = lerp3Color(GRASSLAND_THEME.sky, MUSHROOM_THEME.sky, TROPICAL_THEME.sky, m * 0.38, t)
  const mid = lerp3Color(GRASSLAND_THEME.sky, MUSHROOM_THEME.sky, TROPICAL_THEME.sky, m * 0.72, t)
  const top = lerp3Color(GRASSLAND_THEME.sky, MUSHROOM_THEME.sky, TROPICAL_THEME.sky, m, t)
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={bottom} stopOpacity={1} />
          <Stop offset="0.52" stopColor={mid} stopOpacity={1} />
          <Stop offset="1" stopColor={top} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId})`} />
    </Svg>
  )
})

export function WonderJump({ navigation, route }: any) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const fallbackWindow = Dimensions.get('screen')
  const resolvedWidth = windowWidth > 0 ? windowWidth : fallbackWindow.width || 390
  const resolvedHeight = windowHeight > 0 ? windowHeight : fallbackWindow.height || 780

  const playWidth = Math.max(280, resolvedWidth - TILE_HORIZONTAL_MARGIN * 2)
  const tileBottomSpace = insets.bottom + 88
  const playHeight = Math.max(430, resolvedHeight - insets.top - insets.bottom - 170)
  const panelTop = Math.max(70, playHeight * 0.24)

  const routeSeedBiome: WonderJumpStartBiome =
    route?.params?.startBiome === 'mushroom'
      ? 'mushroom'
      : route?.params?.startBiome === 'tropical'
        ? 'tropical'
        : 'grassland'

  const [menuStartBiome, setMenuStartBiome] = useState<WonderJumpStartBiome>(routeSeedBiome)
  const [controlScheme, setControlScheme] = useState<ControlScheme>('touchSplit')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bestScore, setBestScore] = useState(0)
  const menuWorldCacheRef = useRef<
    Partial<Record<WonderJumpStartBiome, ReturnType<typeof createInitialWorld>>>
  >({})
  const getMenuPreviewWorld = (biome: WonderJumpStartBiome) => {
    const cached = menuWorldCacheRef.current[biome]
    if (cached) return cached
    const created = createInitialWorld(playWidth, playHeight, biome)
    menuWorldCacheRef.current[biome] = created
    return created
  }
  const createMenuPreviewState = (biome: WonderJumpStartBiome): GameState => {
    const world = getMenuPreviewWorld(biome)
    return {
      mode: 'menu',
      player: { ...world.player },
      platforms: world.platforms.map((p) => ({ ...p })),
      spikes: world.spikes.map((s) => ({ ...s })),
      coins: world.coins.map((c) => ({ ...c })),
      jetpacks: world.jetpacks.map((j) => ({ ...j })),
      crabs: world.crabs.map((c) => ({ ...c })),
      cameraY: 0,
      heightScore: 0,
      coinScore: 0,
      lastCoinHostY: world.lastCoinHostY,
      lastCoinWorldX: world.lastCoinWorldX,
      lastJetpackY: world.lastJetpackY,
      jetpackFuelMs: 0,
      jetpackEndGraceMs: 0,
      jetpackAnimTick: 0,
      uiAnimTick: 0,
      startBiome: biome,
    }
  }
  const [gameState, setGameState] = useState<GameState>(() => createMenuPreviewState(routeSeedBiome))
  const panelEntryAnim = useRef(new Animated.Value(0)).current
  const inputRef = useRef<InputState>({
    leftPressed: false,
    rightPressed: false,
  })

  useEffect(() => {
    const p = route?.params?.startBiome
    if (p !== 'grassland' && p !== 'mushroom' && p !== 'tropical') return
    setMenuStartBiome(p)
    setGameState((prev) => (prev.mode === 'menu' ? createMenuPreviewState(p) : prev))
  }, [route?.params?.startBiome, playWidth, playHeight])

  useEffect(() => {
    menuWorldCacheRef.current = {}
    setGameState((prev) => (prev.mode === 'menu' ? createMenuPreviewState(menuStartBiome) : prev))
  }, [playWidth, playHeight])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') inputRef.current.leftPressed = true
      if (key === 'arrowright' || key === 'd') inputRef.current.rightPressed = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') inputRef.current.leftPressed = false
      if (key === 'arrowright' || key === 'd') inputRef.current.rightPressed = false
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }
  }, [])

  useEffect(() => {
    if (gameState.mode !== 'playing') return

    const intervalId = setInterval(() => {
      setGameState((previous) => {
        if (previous.mode !== 'playing') return previous

        const difficulty = Math.min(1, previous.heightScore / 2200)
        const mushroomBlendTick = getMushroomBlend(previous.heightScore, previous.startBiome)
        const tropicalBlendTick = getTropicalBlend(previous.heightScore, previous.startBiome)
        const speed = BASE_SPEED + difficulty * 1.5
        const nextPlatforms = previous.platforms.map((platform) => {
          let x = platform.x
          let y = platform.y
          let moveDir = platform.moveDir
          let breakProgress = platform.breakProgress
          let isFalling = platform.isFalling
          let fallingVelocityY = platform.fallingVelocityY

          if (platform.kind === 'moving' && !isFalling) {
            x += platform.moveSpeed * moveDir
            if (x <= platform.moveMinX) {
              x = platform.moveMinX
              moveDir = 1
            } else if (x >= platform.moveMaxX) {
              x = platform.moveMaxX
              moveDir = -1
            }
          }

          if (isFalling) {
            fallingVelocityY = Math.min(fallingVelocityY + 0.36, 12)
            y += fallingVelocityY
          }

          return {
            ...platform,
            x,
            y,
            moveDir,
            breakProgress,
            isFalling,
            fallingVelocityY,
          }
        })

        const prevById = new Map(previous.platforms.map((p) => [p.id, p]))
        const nextById = new Map(nextPlatforms.map((p) => [p.id, p]))

        const prevPlayer = previous.player
        const player: Player = { ...prevPlayer }
        const prevY = player.y

        const direction = (inputRef.current.rightPressed ? 1 : 0) - (inputRef.current.leftPressed ? 1 : 0)
        player.velocityX = direction * speed

        // Doodle-style: no wall collision with platforms — only screen wrap.
        player.x += player.velocityX

        if (player.x + player.width < 0) player.x = playWidth
        else if (player.x > playWidth) player.x = -player.width

        // If standing on a moving platform, carry the player.
        if (player.onGround && player.groundPlatformId) {
          const currentPlatform = nextById.get(player.groundPlatformId)
          const previousPlatform = prevById.get(player.groundPlatformId)
          if (currentPlatform && previousPlatform && currentPlatform.kind === 'moving' && !currentPlatform.isFalling) {
            const deltaX = currentPlatform.x - previousPlatform.x
            player.x += deltaX
          }
        }

        if (player.onGround) {
          const support = nextPlatforms.find((platform) => {
            if (!isSolid(platform)) return false
            const topY = platformTopY(platform)
            const closeToTop = Math.abs(player.y + player.height - topY) <= 2
            const overlapX =
              player.x + player.width - 4 >= platform.x &&
              player.x + 4 <= platform.x + platform.width
            return closeToTop && overlapX
          })
          if (!support) {
            player.onGround = false
            player.groundPlatformId = null
            player.groundKind = null
          } else {
            player.groundPlatformId = support.id
            player.groundKind = support.kind
          }
        }

        const prevBottom = prevY + player.height
        const prevJetpackFuelMs = previous.jetpackFuelMs
        let jetpackFuelMs = previous.jetpackFuelMs
        let jetpackEndGraceMs = Math.max(0, previous.jetpackEndGraceMs - SIM_TICK_MS)
        let jetpackAnimTick = previous.jetpackAnimTick
        const uiAnimTick = previous.uiAnimTick + 1
        if (jetpackFuelMs > 0) {
          player.onGround = false
          player.groundPlatformId = null
          player.groundKind = null
          player.velocityY = Math.min(player.velocityY, JETPACK_THRUST_VELOCITY)
          jetpackFuelMs = Math.max(0, jetpackFuelMs - SIM_TICK_MS)
          jetpackAnimTick += 1
        } else {
          jetpackAnimTick = 0
        }
        if (prevJetpackFuelMs > 0 && jetpackFuelMs <= 0) {
          jetpackEndGraceMs = Math.max(jetpackEndGraceMs, JETPACK_END_SPIKE_GRACE_MS)
        }

        if (!player.onGround) {
          player.velocityY = Math.min(player.velocityY + GRAVITY, MAX_FALL_VELOCITY)
          const nextVelocityY = player.velocityY
          player.y += player.velocityY
          const newBottom = player.y + player.height

          // Pass-through platforms: only land when falling through the top surface.
          if (nextVelocityY > 0) {
            let best: PlatformItem | null = null
            let bestTopY = -Infinity
            for (const platform of nextPlatforms) {
              if (!isSolid(platform)) continue
              if (!horizontalLandOverlap(player, platform)) continue
              const topY = platformTopY(platform)
              if (prevBottom <= topY && newBottom >= topY) {
                if (topY > bestTopY) {
                  bestTopY = topY
                  best = platform
                }
              }
            }
            if (best) {
              player.y = platformTopY(best) - player.height
              player.velocityY = 0
              player.onGround = true
              player.groundPlatformId = best.id
              player.groundKind = best.kind
            }
          }
        } else {
          player.velocityY = 0
        }

        let crumblePlatformId: string | null = null
        if (player.onGround) {
          player.velocityY =
            player.groundKind === 'bouncy' ? BOUNCY_JUMP_VELOCITY : NORMAL_JUMP_VELOCITY
          if (player.groundKind === 'breakable' && player.groundPlatformId) {
            crumblePlatformId = player.groundPlatformId
          }
          player.onGround = false
          player.groundPlatformId = null
          player.groundKind = null
        }

        const mutatedPlatforms = nextPlatforms.map((platform) => {
          if (crumblePlatformId && platform.id === crumblePlatformId) {
            return {
              ...platform,
              isFalling: true,
              fallingVelocityY: 1.4,
            }
          }
          if (platform.isFalling) {
            return platform
          }
          return platform
        })

        const platformById = crumblePlatformId
          ? new Map(mutatedPlatforms.map((p) => [p.id, p]))
          : nextById

        const currentSpikes = filterUnfairSpikes(
          previous.spikes
            .filter((spike) => spike.y - previous.cameraY < playHeight + 140)
            .map((spike) => {
              const hostId = spike.id.replace('spike-', '')
              const host = platformById.get(hostId)
              if (!host) return spike
              return {
                ...spike,
                x: host.x + spike.offsetX,
                y: host.y - spike.height,
              }
            }),
          mutatedPlatforms
        )

        const currentCoins = previous.coins
          .filter((coin) => !coin.collected && coin.y - previous.cameraY < playHeight + 150)
          .flatMap((coin) => {
            if (!coin.hostPlatformId) return [coin]
            const host = platformById.get(coin.hostPlatformId)
            /* Host culled from simulation → drop coin; keeping it caused frozen world coords + vertical “trails” */
            if (!host) return []
            const ox = Number.isFinite(coin.offsetX) ? coin.offsetX : host.width * 0.5
            return [{ ...coin, offsetX: ox, x: host.x + ox, y: host.y - 20 }]
          })

        const currentJetpacks = previous.jetpacks
          .filter((jetpack) => !jetpack.collected)
          .filter((jetpack) => {
            const y = jetpack.y - previous.cameraY
            return y > -playHeight - 170 && y < playHeight + 220
          })

        let coinScoreGain = 0
        const resolvedCoins = currentCoins.map((coin) => {
          if (coin.collected) return coin
          const hit =
            player.x < coin.x + coin.radius &&
            player.x + player.width > coin.x - coin.radius &&
            player.y < coin.y + coin.radius &&
            player.y + player.height > coin.y - coin.radius
          if (hit) {
            coinScoreGain += 1
            return { ...coin, collected: true }
          }
          return coin
        })

        const resolvedJetpacks = currentJetpacks.map((jetpack) => {
          const hit =
            player.x < jetpack.x + jetpack.width &&
            player.x + player.width > jetpack.x &&
            player.y < jetpack.y + jetpack.height &&
            player.y + player.height > jetpack.y
          if (hit) {
            jetpackFuelMs = Math.max(jetpackFuelMs, JETPACK_DURATION_MS)
            if (jetpackAnimTick === 0) jetpackAnimTick = 1
            return { ...jetpack, collected: true }
          }
          return jetpack
        })

        const hitSpike =
          jetpackFuelMs > 0 || jetpackEndGraceMs > 0
            ? false
            : currentSpikes.some((spike) => playerHitsSpike(player, spike))

        const followThreshold = playHeight * 0.38
        let cameraY = previous.cameraY
        const playerOnScreenY = player.y - cameraY
        if (playerOnScreenY < followThreshold) cameraY = player.y - followThreshold

        let platforms = [...mutatedPlatforms]
        let spikes = [...currentSpikes]
        let coins = [...resolvedCoins]
        let jetpacks = [...resolvedJetpacks]
        let crabs = [...previous.crabs]
        let lastCoinHostY = previous.lastCoinHostY
        let lastCoinWorldX = previous.lastCoinWorldX
        let lastJetpackY = previous.lastJetpackY
        const hostById = platformById
        const tickMs = SIM_TICK_MS
        // Update crabs (walk back/forth on their host platform).
        crabs = crabs
          .map((crab) => {
            if (!crab.alive) {
              return {
                ...crab,
                deathMs: crab.deathMs + tickMs,
                plus2Ms: Math.max(0, crab.plus2Ms - tickMs),
              }
            }
            const host = hostById.get(crab.hostPlatformId)
            if (!host) return crab
            if (host.kind === 'moving') {
              return { ...crab, plus2Ms: Math.max(0, crab.plus2Ms - tickMs) }
            }
            let localX = crab.localX + crab.speed * crab.dir
            let dir = crab.dir
            if (localX <= crab.minLocalX) {
              localX = crab.minLocalX
              dir = 1
            } else if (localX >= crab.maxLocalX) {
              localX = crab.maxLocalX
              dir = -1
            }
            return { ...crab, localX, dir, plus2Ms: Math.max(0, crab.plus2Ms - tickMs) }
          })
          .filter((crab) => crab.alive || crab.deathMs < CRAB_DEATH_MS + 240)
        const countCoinsAlive = (list: Coin[]) => list.filter((c) => !c.collected).length
        const countJetpacksAlive = (list: JetpackPickup[]) => list.filter((j) => !j.collected).length
        let highestY = Math.min(...platforms.map((platform) => platform.y))
        let seed = platforms.length + 1
        let chainPlatform = platforms.reduce((top, p) => (p.y < top.y ? p : top), platforms[0])
        let coinsMintedThisTick = 0
        while (highestY > cameraY - playHeight * 2.55) {
          let gapMin = 42 + difficulty * 8
          let gapMax = 62 + difficulty * 24
          if (isMushroomGameplay(previous.startBiome, mushroomBlendTick, tropicalBlendTick)) {
            gapMin += MUSHROOM_CHAIN_GAP_EXTRA_MIN
            gapMax += MUSHROOM_CHAIN_GAP_EXTRA_MAX
          }
          if (tropicalBlendTick >= TROPICAL_GAMEPLAY_BLEND) {
            gapMin += 6 + tropicalBlendTick * 6
            gapMax += 10 + tropicalBlendTick * 10
          }
          const verticalGap = clamp(
            randomInRange(gapMin, gapMax),
            MIN_CHAIN_VERTICAL_GAP,
            MAX_CHAIN_VERTICAL_GAP
          )
          highestY -= verticalGap
          const allowBreakable =
            difficulty > 0.22 &&
            chainPlatform?.kind !== 'breakable' &&
            chainPlatform?.kind !== 'moving'
          let platform = spawnPlatform(
            highestY,
            seed,
            playWidth,
            difficulty,
            allowBreakable,
            chainPlatform,
            verticalGap,
            mushroomBlendTick,
            tropicalBlendTick
          )
          platform = enforceChainReachable(chainPlatform, platform, playWidth, difficulty)
          highestY = platform.y
          platforms.push(platform)
          chainPlatform = platform
          const spikeAllowed =
            previous.heightScore >= spikeActivationHeight(previous.startBiome, mushroomBlendTick, tropicalBlendTick)
          const forceInterval = isMushroomGameplay(previous.startBiome, mushroomBlendTick, tropicalBlendTick) ? 4 : 11
          const forceSpike = seed % forceInterval === 0
          const newSpikes = spawnSpikes(
            platform,
            spikeAllowed,
            mushroomBlendTick,
            tropicalBlendTick,
            previous.startBiome,
            difficulty,
            forceSpike
          )
          spikes.push(...newSpikes)
          platforms[platforms.length - 1] = maybeAttachPalmTree(
            { ...platforms[platforms.length - 1], topPalmTree: undefined },
            platforms,
            tropicalBlendTick,
            newSpikes.length > 0
          )
          chainPlatform = platforms[platforms.length - 1]
          let chainGotCoin = false
          if (coinsMintedThisTick < MAX_COINS_MINTED_PER_TICK) {
            const added = spawnCoin(
              platform,
              newSpikes.length > 0,
              countCoinsAlive(coins),
              lastCoinHostY,
              lastCoinWorldX,
              mushroomBlendTick,
              tropicalBlendTick,
              previous.startBiome
            )
            if (added.length) {
              coins.push(...added)
              coinsMintedThisTick += 1
              lastCoinHostY = platform.y
              lastCoinWorldX = added[0].x
              chainGotCoin = true
            }
          }
          const jetpackAdded = spawnJetpack(
            platform,
            countJetpacksAlive(jetpacks),
            lastJetpackY,
            mushroomBlendTick,
            tropicalBlendTick,
            previous.startBiome
          )
          if (jetpackAdded.length) {
            jetpacks.push(...jetpackAdded)
            lastJetpackY = jetpackAdded[0].y
          }
          crabs.push(...spawnCrabOnPlatform(chainPlatform, newSpikes.length > 0, tropicalBlendTick, previous.startBiome, seed))
          const sibling = trySpawnSiblingPlatform(
            highestY,
            seed + 60000,
            playWidth,
            difficulty,
            platforms,
            mushroomBlendTick,
            tropicalBlendTick
          )
          if (sibling) {
            platforms.push(sibling)
            const sSpikes = spawnSpikes(
              sibling,
              spikeAllowed,
              mushroomBlendTick,
              tropicalBlendTick,
              previous.startBiome,
              difficulty
            )
            spikes.push(...sSpikes)
            platforms[platforms.length - 1] = maybeAttachPalmTree(
              { ...platforms[platforms.length - 1], topPalmTree: undefined },
              platforms,
              tropicalBlendTick,
              sSpikes.length > 0
            )
            crabs.push(
              ...spawnCrabOnPlatform(platforms[platforms.length - 1], sSpikes.length > 0, tropicalBlendTick, previous.startBiome, seed + 60000)
            )
            const jetpackSibling = spawnJetpack(
              sibling,
              countJetpacksAlive(jetpacks),
              lastJetpackY,
              mushroomBlendTick,
              tropicalBlendTick,
              previous.startBiome
            )
            if (jetpackSibling.length) {
              jetpacks.push(...jetpackSibling)
              lastJetpackY = jetpackSibling[0].y
            }
            if (
              !chainGotCoin &&
              coinsMintedThisTick < MAX_COINS_MINTED_PER_TICK
            ) {
              const addedS = spawnCoin(
                sibling,
                sSpikes.length > 0,
                countCoinsAlive(coins),
                lastCoinHostY,
                lastCoinWorldX,
                mushroomBlendTick,
                tropicalBlendTick,
                previous.startBiome
              )
              if (addedS.length) {
                coins.push(...addedS)
                coinsMintedThisTick += 1
                lastCoinHostY = sibling.y
                lastCoinWorldX = addedS[0].x
              }
            }
          }
          seed += 1
        }

        platforms = platforms.filter((platform) => {
          const screenY = platform.y - cameraY
          return screenY > -220 && screenY < playHeight + 220
        })
        const alivePlatformIds = new Set(platforms.map((p) => p.id))
        const livePlatformById = new Map(platforms.map((p) => [p.id, p]))
        spikes = filterUnfairSpikes(spikes, platforms)
        spikes = spikes.filter((spike) => {
          const screenY = spike.y - cameraY
          /*
           * Keep spikes much farther above camera than visible bounds.
           * If we cull them at -80, newly generated hazards are deleted before they ever scroll into view.
           */
          return screenY > -playHeight - 140 && screenY < playHeight + 180
        })
        coins = coins.filter((coin) => {
          if (coin.collected) return false
          if (coin.hostPlatformId && !alivePlatformIds.has(coin.hostPlatformId)) return false
          const screenY = coin.y - cameraY
          /* ~1 screen above camera: enough lead time to jump, without hoarding hundreds off-screen */
          return screenY > -playHeight - 100 && screenY < playHeight + 220
        })
        crabs = crabs.filter((crab) => {
          const host = livePlatformById.get(crab.hostPlatformId)
          if (!host) return false
          const y = host.y - cameraY
          return y > -playHeight - 180 && y < playHeight + 280
        })
        jetpacks = jetpacks.filter((jetpack) => {
          if (jetpack.collected) return false
          const screenY = jetpack.y - cameraY
          return screenY > -playHeight - 170 && screenY < playHeight + 250
        })

        // Crab collisions + stomps.
        let crabsKilledThisTick = 0
        let touchedCrab = false
        if (jetpackFuelMs <= 0) {
          const prevBottom2 = prevBottom
          const newBottom2 = player.y + player.height
          for (const crab of crabs) {
            if (!crab.alive) continue
            const host = livePlatformById.get(crab.hostPlatformId)
            if (!host) continue
            const crabX = host.x + crab.localX
            const crabY = host.y - crab.height + 2
            const overlaps =
              player.x < crabX + crab.width &&
              player.x + player.width > crabX &&
              player.y < crabY + crab.height &&
              player.y + player.height > crabY
            const stompHorizontal =
              player.x + player.width >= crabX - 8 &&
              player.x <= crabX + crab.width + 8
            const stompTop = crabY + 6
            const stomping =
              player.velocityY > 0 &&
              stompHorizontal &&
              prevBottom2 <= stompTop &&
              newBottom2 >= crabY - 2
            if (stomping) {
              crabsKilledThisTick += 1
              // Tiny bounce on kill.
              player.velocityY = Math.min(player.velocityY, -6.4)
              crab.alive = false
              crab.deathMs = 0
              crab.plus2Ms = CRAB_PLUS2_MS
              const dropY = crabY - 10
              coins.push(
                {
                  id: `coin-drop-${crab.id}-a-${previous.uiAnimTick}`,
                  x: crabX + crab.width * 0.35,
                  y: dropY,
                  radius: 6,
                  collected: false,
                  offsetX: 0,
                  hostPlatformId: null,
                },
                {
                  id: `coin-drop-${crab.id}-b-${previous.uiAnimTick}`,
                  x: crabX + crab.width * 0.65,
                  y: dropY,
                  radius: 6,
                  collected: false,
                  offsetX: 0,
                  hostPlatformId: null,
                }
              )
            } else if (overlaps) {
              touchedCrab = true
            }
          }
        }

        const heightScore = Math.max(previous.heightScore, Math.floor(-cameraY))
        const coinScore = previous.coinScore + coinScoreGain + crabsKilledThisTick * 2
        const fallenOut = player.y - cameraY > playHeight + 120
        const shouldEnd = fallenOut || hitSpike || touchedCrab

        if (shouldEnd) {
          const finalScore = coinScore
          setBestScore((current) => Math.max(current, finalScore))
          return {
            ...previous,
            mode: 'gameOver',
            player,
            platforms,
            spikes,
            coins,
            jetpacks,
            crabs,
            cameraY,
            heightScore,
            coinScore,
            lastCoinHostY,
            lastCoinWorldX,
            lastJetpackY,
            jetpackFuelMs,
            jetpackEndGraceMs,
            jetpackAnimTick,
            uiAnimTick,
            startBiome: previous.startBiome,
          }
        }

        return {
          mode: 'playing',
          player,
          platforms,
          spikes,
          coins,
          jetpacks,
          crabs,
          cameraY,
          heightScore,
          coinScore,
          lastCoinHostY,
          lastCoinWorldX,
          lastJetpackY,
          jetpackFuelMs,
          jetpackEndGraceMs,
          jetpackAnimTick,
          uiAnimTick,
          startBiome: previous.startBiome,
        }
      })
    }, SIM_TICK_MS)

    return () => clearInterval(intervalId)
  }, [gameState.mode, playHeight, playWidth])

  const clouds = useMemo(
    () => [
      { id: 'c1', x: 34, y: -520, width: 100 },
      { id: 'c2', x: playWidth - 168, y: -730, width: 126 },
      { id: 'c3', x: 72, y: -1020, width: 78 },
      { id: 'c4', x: playWidth - 188, y: -1250, width: 128 },
      { id: 'c5', x: 20, y: -1560, width: 108 },
    ],
    [playWidth]
  )

  const skyBlend = useMemo(() => {
    if (gameState.mode !== 'menu') {
      return {
        mushroom: getMushroomBlend(gameState.heightScore, gameState.startBiome),
        tropical: getTropicalBlend(gameState.heightScore, gameState.startBiome),
      }
    }
    return {
      mushroom: getMushroomBlend(0, menuStartBiome),
      tropical: getTropicalBlend(0, menuStartBiome),
    }
  }, [gameState.mode, gameState.heightScore, gameState.startBiome, menuStartBiome])

  const sceneColors = useMemo(() => {
    return {
      screenBg: lerp3Color(GRASSLAND_THEME.screenBg, MUSHROOM_THEME.screenBg, TROPICAL_THEME.screenBg, skyBlend.mushroom, skyBlend.tropical),
      tileBg: lerp3Color(GRASSLAND_THEME.tileBg, MUSHROOM_THEME.tileBg, TROPICAL_THEME.tileBg, skyBlend.mushroom, skyBlend.tropical),
      sunCore: lerp3Color('#fff8d2', '#e8dcf8', '#fff0cf', skyBlend.mushroom, skyBlend.tropical),
      hillFar: lerp3Color(GRASSLAND_THEME.hillFar, MUSHROOM_THEME.hillFar, TROPICAL_THEME.hillFar, skyBlend.mushroom, skyBlend.tropical),
      hillNear: lerp3Color(GRASSLAND_THEME.hillNear, MUSHROOM_THEME.hillNear, TROPICAL_THEME.hillNear, skyBlend.mushroom, skyBlend.tropical),
    }
  }, [skyBlend])
  const jetpackShake = useMemo(() => {
    if (gameState.mode !== 'playing' || gameState.jetpackFuelMs <= 0) return { x: 0, y: 0 }
    const t = gameState.uiAnimTick
    // Snap to integer pixels to avoid sub-pixel shimmer/glitching.
    return {
      x: Math.round(Math.sin(t * 0.85) * 0.8),
      y: Math.round(Math.cos(t * 0.9) * 0.6),
    }
  }, [gameState.mode, gameState.jetpackFuelMs, gameState.uiAnimTick])

  const hudBiomeLabel = useMemo(() => {
    const m = getMushroomBlend(gameState.heightScore, gameState.startBiome)
    const t = getTropicalBlend(gameState.heightScore, gameState.startBiome)
    return biomeHudLabel(m, t, gameState.startBiome)
  }, [gameState.heightScore, gameState.startBiome])
  const activePanelBiome: WonderJumpStartBiome =
    gameState.mode === 'menu' ? menuStartBiome : gameState.startBiome
  const panelAccent = BIOME_UI_ACCENTS[activePanelBiome]
  const primaryButtonTone = {
    backgroundColor: panelAccent.accent,
    borderColor: panelAccent.accent,
  }
  const panelAccentGlow = {
    borderColor: panelAccent.accentSoft,
    shadowColor: panelAccent.accent,
  }
  const panelBiomeLabel = panelAccent.label
  const activeOverlay =
    settingsOpen
      ? 'settings'
      : gameState.mode === 'menu'
        ? 'menu'
        : gameState.mode === 'paused'
          ? 'paused'
          : gameState.mode === 'gameOver'
            ? 'gameOver'
            : null
  const panelEntryStyle = {
    opacity: panelEntryAnim,
    transform: [
      {
        scale: panelEntryAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  }

  useEffect(() => {
    if (!activeOverlay) return
    panelEntryAnim.stopAnimation()
    panelEntryAnim.setValue(0)
    Animated.spring(panelEntryAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 17,
      stiffness: 190,
      mass: 0.9,
    }).start()
  }, [activeOverlay, panelEntryAnim])

  const startGame = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    setGameState(createInitialState('playing', playWidth, playHeight, menuStartBiome))
  }
  const restartRun = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    setGameState(createInitialState('playing', playWidth, playHeight, menuStartBiome))
  }
  const pauseGame = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    setGameState((prev) => (prev.mode === 'playing' ? { ...prev, mode: 'paused' } : prev))
  }
  const resumeGame = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    setGameState((prev) => (prev.mode === 'paused' ? { ...prev, mode: 'playing' } : prev))
  }
  const backToMenu = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    setGameState(createMenuPreviewState(menuStartBiome))
  }
  const goHome = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    navigation?.navigate?.('Tabs' as never, { screen: 'Home' } as never)
  }
  const selectMenuBiome = (biome: WonderJumpStartBiome) => {
    setMenuStartBiome(biome)
    setGameState((prev) => (prev.mode === 'menu' ? createMenuPreviewState(biome) : prev))
  }

  const platformByIdForRender = new Map(gameState.platforms.map((p) => [p.id, p]))

  return (
    <View style={[styles.screen, { backgroundColor: sceneColors.screenBg }]}>
      <View
        style={[
          styles.gameTile,
          {
            marginBottom: tileBottomSpace,
            height: playHeight,
            backgroundColor: sceneColors.tileBg,
            transform: [{ translateX: jetpackShake.x }, { translateY: jetpackShake.y }],
          },
        ]}
      >
        <WonderSkyBackdrop width={playWidth} height={playHeight} mushroomBlend={skyBlend.mushroom} tropicalBlend={skyBlend.tropical} />
        <View style={[styles.sunGlow, { backgroundColor: sceneColors.sunCore }]} />
        <View style={[styles.horizonLayerFar, { backgroundColor: sceneColors.hillFar }]} />
        <View style={[styles.horizonLayerNear, { backgroundColor: sceneColors.hillNear }]} />

        {clouds.map((cloud) => {
          const screenY = cloud.y - gameState.cameraY
          if (gameState.heightScore <= 320) return null
          if (screenY < -90 || screenY > playHeight + 50) return null
          return <GrasslandCloud key={cloud.id} left={cloud.x} top={screenY} width={cloud.width} />
        })}

        {gameState.platforms.map((platform) => {
          const screenY = platform.y - gameState.cameraY
          if (screenY < -36 || screenY > playHeight + 32) return null
          const isBouncy = platform.kind === 'bouncy'
          const visualH = PLATFORM_HEIGHT + PLATFORM_VISUAL_OVERHANG
          const graphicKind: GrasslandPlatformKind =
            platform.kind === 'moving'
              ? 'moving'
              : platform.kind === 'breakable'
                ? 'breakable'
                : 'normal'
          return (
            <JumpPlatformRow
              key={platform.id}
              left={platform.x}
              top={screenY}
              width={platform.width}
              shellHeight={visualH}
              graphicKind={graphicKind}
              surface={platform.surface}
              isBouncy={isBouncy}
              isFalling={platform.isFalling}
              topMushrooms={platform.topMushrooms}
              topPalmTree={platform.topPalmTree}
              topFlowers={platform.topFlowers}
            />
          )
        })}

        {gameState.spikes.map((spike) => {
          const screenY = spike.y - gameState.cameraY
          if (screenY < -16 || screenY > playHeight + 18) return null
          return (
            <SpikeGraphic
              key={spike.id}
              left={spike.x}
              top={screenY}
              width={spike.width}
              height={spike.height}
            />
          )
        })}

        {gameState.coins.map((coin) => {
          const screenY = coin.y - gameState.cameraY
          if (screenY < -20 || screenY > playHeight + 20) return null
          const d = coin.radius * 2
          return (
            <CoinView
              key={coin.id}
              left={coin.x - coin.radius}
              top={screenY - coin.radius}
              diameter={d}
            />
          )
        })}

        {gameState.jetpacks.map((jetpack) => {
          // Slightly faster, smoother floating using stable per-spawn phase.
          const t = gameState.uiAnimTick * 0.1 + jetpack.hoverPhase
          const bob = Math.sin(t) * 1.35 + Math.sin(t * 0.5) * 0.35
          const screenY = jetpack.y - gameState.cameraY + bob
          if (screenY < -30 || screenY > playHeight + 30) return null
          return (
            <JetpackPickupView
              key={jetpack.id}
              left={jetpack.x}
              top={screenY}
              width={jetpack.width}
              height={jetpack.height}
            />
          )
        })}

        {(gameState.crabs ?? []).map((crab) => {
          const host = platformByIdForRender.get(crab.hostPlatformId)
          if (!host) return null
          const x = host.x + crab.localX
          const y = host.y - crab.height + 2
          const screenY = y - gameState.cameraY
          if (screenY < -30 || screenY > playHeight + 40) return null
          const deadProgress = crab.alive ? 0 : clamp(crab.deathMs / CRAB_DEATH_MS, 0, 1)
          const legFrame: 0 | 1 = Math.floor(gameState.uiAnimTick / 7) % 2 === 0 ? 0 : 1
          const plus2Progress = clamp(1 - crab.plus2Ms / CRAB_PLUS2_MS, 0, 1)
          const plus2Scale = 1 + Math.sin(plus2Progress * Math.PI) * 0.24
          return (
            <View key={crab.id} pointerEvents="none">
              <CrabView
                left={x}
                top={screenY}
                width={crab.width}
                height={crab.height}
                deadProgress={deadProgress}
                legFrame={legFrame}
              />
              {crab.plus2Ms > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: x + crab.width / 2 - 20,
                    top: screenY - 20 - plus2Progress * 14,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: '#2d47c8',
                    backgroundColor: 'rgba(232, 243, 255, 0.96)',
                    transform: [{ scale: plus2Scale }],
                    shadowColor: '#1d2f8e',
                    shadowOpacity: 0.45,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                  }}
                >
                  <Text
                    style={{
                      color: '#1f3fc7',
                      fontFamily: CLASSIC_GAME_FONT_BOLD,
                      fontSize: 18,
                      lineHeight: 18,
                      letterSpacing: 0.35,
                      textShadowColor: 'rgba(255,255,255,0.75)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 1,
                    }}
                  >
                    +2
                  </Text>
                </View>
              ) : null}
            </View>
          )
        })}

        <View
          style={[
            styles.playerShadow,
            {
              left: gameState.player.x + 2,
              top: gameState.player.y - gameState.cameraY + gameState.player.height - 3,
            },
          ]}
        />
        <View
          style={[
            styles.player,
            {
              left: gameState.player.x,
              top: gameState.player.y - gameState.cameraY,
              width: gameState.player.width,
              height: gameState.player.height,
            },
          ]}
        >
          <View style={styles.playerEyeLeft} />
          <View style={styles.playerEyeRight} />
        </View>
        {gameState.jetpackFuelMs > 0 ? (
          <PlayerJetpackFx
            left={gameState.player.x - 12}
            top={gameState.player.y - gameState.cameraY - 10}
            frame={gameState.jetpackAnimTick}
          />
        ) : null}

        <View style={styles.hud}>
          <Text style={styles.hudCoinCount}>{gameState.coinScore}</Text>
          {gameState.mode === 'playing' ? (
            <Text style={styles.hudBiomeHint}>{hudBiomeLabel}</Text>
          ) : null}
        </View>
        {gameState.mode === 'playing' ? (
          <Pressable onPress={pauseGame} style={styles.pauseButton}>
            <Text style={styles.pauseButtonText}>II</Text>
          </Pressable>
        ) : null}

        {settingsOpen ? (
          <Animated.View
            style={[styles.panel, styles.panelDarkGlass, panelAccentGlow, panelEntryStyle, { top: panelTop }]}
          >
            <Text style={styles.panelTitle}>Settings</Text>
            <Text style={styles.panelBiome}>{panelBiomeLabel}</Text>
            <Text style={styles.panelSubtitleSmall}>Movement controls</Text>
            <View style={styles.settingsOptionRow}>
              <Pressable
                onPress={() => setControlScheme('touchSplit')}
                style={[
                  styles.settingsOptionChip,
                  controlScheme === 'touchSplit' ? styles.settingsOptionChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.settingsOptionText,
                    controlScheme === 'touchSplit' ? styles.settingsOptionTextActive : null,
                  ]}
                >
                  Split touch
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setControlScheme('dpad')}
                style={[
                  styles.settingsOptionChip,
                  controlScheme === 'dpad' ? styles.settingsOptionChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.settingsOptionText,
                    controlScheme === 'dpad' ? styles.settingsOptionTextActive : null,
                  ]}
                >
                  D-pad bubbles
                </Text>
              </Pressable>
            </View>
            <Text style={styles.panelSubtitle}>
              Split touch uses screen halves. D-pad bubbles place left/right arrows at the bottom.
            </Text>
            <Pressable onPress={() => setSettingsOpen(false)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {gameState.mode === 'menu' && !settingsOpen ? (
          <Animated.View
            style={[styles.panel, styles.panelDarkGlass, panelAccentGlow, panelEntryStyle, { top: panelTop }]}
          >
            <Text style={styles.panelTitle}>WonderJump</Text>
            <Text style={styles.panelBiome}>{panelBiomeLabel}</Text>
            <Text style={styles.panelSubtitleSmall}>Starting biome</Text>
            <View style={styles.panelBiomeRow}>
              <Pressable
                onPress={() => selectMenuBiome('grassland')}
                style={[
                  styles.panelBiomeChip,
                  styles.panelBiomeChipGrass,
                  menuStartBiome === 'grassland' ? styles.panelBiomeChipGrassActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.panelBiomeChipText,
                    menuStartBiome === 'grassland' ? styles.panelBiomeChipTextActive : null,
                  ]}
                >
                  Grasslands
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectMenuBiome('mushroom')}
                style={[
                  styles.panelBiomeChip,
                  styles.panelBiomeChipMushroom,
                  menuStartBiome === 'mushroom' ? styles.panelBiomeChipMushroomActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.panelBiomeChipText,
                    menuStartBiome === 'mushroom' ? styles.panelBiomeChipTextActive : null,
                  ]}
                >
                  Mushroom Isles
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectMenuBiome('tropical')}
                style={[
                  styles.panelBiomeChip,
                  styles.panelBiomeChipTropical,
                  menuStartBiome === 'tropical' ? styles.panelBiomeChipTropicalActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.panelBiomeChipText,
                    menuStartBiome === 'tropical' ? styles.panelBiomeChipTextActive : null,
                  ]}
                >
                  Sunset Keys
                </Text>
              </Pressable>
            </View>
            <Text style={styles.panelSubtitle}>
              Bounce up, grab coins, and keep climbing to discover the next biome!
            </Text>
            <Pressable onPress={startGame} style={[styles.primaryButton, primaryButtonTone]}>
              <Text style={styles.primaryButtonText}>
                {bestScore > 0 ? 'Restart Run' : 'Start Run'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Settings</Text>
            </Pressable>
            <Pressable onPress={goHome} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Home</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {gameState.mode === 'paused' && !settingsOpen ? (
          <Animated.View
            style={[styles.panel, styles.panelDarkGlass, panelAccentGlow, panelEntryStyle, { top: panelTop }]}
          >
            <Text style={styles.panelTitle}>Paused</Text>
            <Text style={styles.panelBiome}>{panelBiomeLabel}</Text>
            <Text style={styles.panelSubtitle}>Take a breath, then jump back in.</Text>
            <Pressable onPress={resumeGame} style={[styles.primaryButton, primaryButtonTone]}>
              <Text style={styles.primaryButtonText}>Resume</Text>
            </Pressable>
            <Pressable onPress={restartRun} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Restart Run</Text>
            </Pressable>
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Settings</Text>
            </Pressable>
            <Pressable onPress={goHome} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Home</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {gameState.mode === 'gameOver' && !settingsOpen ? (
          <Animated.View
            style={[styles.panel, styles.panelDarkGlass, panelAccentGlow, panelEntryStyle, { top: panelTop }]}
          >
            <Text style={styles.panelTitle}>Game Over</Text>
            <Text style={styles.panelBiome}>{panelBiomeLabel}</Text>
            <Text style={styles.panelSubtitle}>Coins collected: {gameState.coinScore}</Text>
            <Text style={styles.panelSubtitle}>Best run: {Math.max(bestScore, gameState.coinScore)}</Text>
            <Pressable onPress={restartRun} style={[styles.primaryButton, primaryButtonTone]}>
              <Text style={styles.primaryButtonText}>Restart Run</Text>
            </Pressable>
            <Pressable onPress={backToMenu} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Main Menu</Text>
            </Pressable>
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Settings</Text>
            </Pressable>
            <Pressable onPress={goHome} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Home</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {gameState.mode === 'playing' && controlScheme === 'touchSplit' ? (
          <View style={styles.touchLayer} pointerEvents="box-none">
            <Pressable
              style={styles.touchHalf}
              onPressIn={() => {
                inputRef.current.leftPressed = true
              }}
              onPressOut={() => {
                inputRef.current.leftPressed = false
              }}
            />
            <Pressable
              style={styles.touchHalf}
              onPressIn={() => {
                inputRef.current.rightPressed = true
              }}
              onPressOut={() => {
                inputRef.current.rightPressed = false
              }}
            />
          </View>
        ) : null}
        {gameState.mode === 'playing' && controlScheme === 'dpad' ? (
          <View style={styles.dpadLayer} pointerEvents="box-none">
            <Pressable
              style={styles.dpadBubble}
              onPressIn={() => {
                inputRef.current.leftPressed = true
              }}
              onPressOut={() => {
                inputRef.current.leftPressed = false
              }}
            >
              <Text style={styles.dpadArrow}>{'<'}</Text>
            </Pressable>
            <Pressable
              style={styles.dpadBubble}
              onPressIn={() => {
                inputRef.current.rightPressed = true
              }}
              onPressOut={() => {
                inputRef.current.rightPressed = false
              }}
            >
              <Text style={styles.dpadArrow}>{'>'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRASSLAND_THEME.screenBg,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  gameTile: {
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: GRASSLAND_THEME.tileBg,
  },
  skyBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRASSLAND_THEME.sky,
  },
  sunGlow: {
    position: 'absolute',
    right: -44,
    top: -38,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: GRASSLAND_THEME.sunGlow,
  },
  horizonLayerFar: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -22,
    height: 120,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 180,
    backgroundColor: GRASSLAND_THEME.hillFar,
  },
  horizonLayerNear: {
    position: 'absolute',
    left: -30,
    right: -30,
    bottom: -52,
    height: 118,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 170,
    backgroundColor: GRASSLAND_THEME.hillNear,
  },
  cloudRoot: {
    position: 'absolute',
    overflow: 'visible',
  },
  cloudBlob: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(210, 230, 250, 0.85)',
    shadowColor: '#6ba8d6',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  cloudShadowBase: {
    position: 'absolute',
    left: '10%',
    bottom: 2,
    height: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(140, 180, 220, 0.35)',
  },
  cloudSpeck: {
    position: 'absolute',
    width: 5,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(200, 220, 245, 0.5)',
  },
  cloudHatch: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(170, 200, 235, 0.35)',
  },
  springPadSvg: {
    position: 'absolute',
  },
  platformShell: {
    position: 'absolute',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  platformGraphicWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  platformTintMoving: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 150, 220, 0.14)',
  },
  platformFalling: {
    opacity: 0.88,
  },
  breakableHalfClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  breakableCrackSvg: {
    position: 'absolute',
  },
  coin: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c07c00',
    backgroundColor: '#ffbe2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coinInner: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#ffe48b',
  },
  playerShadow: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(23, 46, 58, 0.32)',
  },
  player: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#ff8a3d',
    borderWidth: 2,
    borderColor: '#b5531d',
  },
  playerEyeLeft: {
    position: 'absolute',
    left: 6,
    top: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1b1d26',
  },
  playerEyeRight: {
    position: 'absolute',
    right: 6,
    top: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1b1d26',
  },
  hud: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: 'rgba(19, 41, 84, 0.62)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    maxWidth: '72%',
  },
  hudCoinCount: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  hudBiomeHint: {
    color: '#b8e8d4',
    fontSize: 11,
    fontFamily: CLASSIC_GAME_FONT,
    letterSpacing: 0.45,
  },
  pauseButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 9,
    elevation: 9,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 35, 70, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(200, 230, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonText: {
    color: '#ffffff',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    fontSize: 14,
    marginTop: -1,
    letterSpacing: 0.5,
  },
  panel: {
    position: 'absolute',
    left: 26,
    right: 26,
    backgroundColor: 'rgba(16, 27, 60, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(210, 235, 255, 0.5)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  panelDarkGlass: {
    backgroundColor: 'rgba(7, 10, 18, 0.88)',
    borderColor: 'rgba(164, 188, 220, 0.22)',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  panelTitle: {
    color: '#f6fbff',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    fontSize: 25,
    letterSpacing: 0.6,
  },
  panelBiome: {
    color: '#bcd6ef',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  panelSubtitleSmall: {
    color: '#9ec5e7',
    fontSize: 12,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    marginBottom: -4,
    letterSpacing: 0.5,
  },
  panelBiomeRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    marginVertical: 4,
  },
  panelBiomeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 230, 255, 0.2)',
    backgroundColor: 'rgba(25, 38, 72, 0.45)',
    alignItems: 'center',
  },
  panelBiomeChipGrass: {
    borderColor: 'rgba(45, 106, 58, 0.42)',
  },
  panelBiomeChipMushroom: {
    borderColor: 'rgba(107, 61, 85, 0.42)',
  },
  panelBiomeChipTropical: {
    borderColor: 'rgba(29, 127, 117, 0.42)',
  },
  panelBiomeChipGrassActive: {
    borderColor: '#2d6a3a',
    backgroundColor: 'rgba(45, 106, 58, 0.3)',
  },
  panelBiomeChipMushroomActive: {
    borderColor: '#6b3d55',
    backgroundColor: 'rgba(107, 61, 85, 0.3)',
  },
  panelBiomeChipTropicalActive: {
    borderColor: '#1d7f75',
    backgroundColor: 'rgba(29, 127, 117, 0.3)',
  },
  panelBiomeChipText: {
    color: '#dfebf7',
    fontSize: 12,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    textAlign: 'center',
    letterSpacing: 0.25,
  },
  panelBiomeChipTextActive: {
    color: '#ffffff',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
  },
  panelSubtitle: {
    color: '#d5e3f1',
    fontSize: 14,
    fontFamily: CLASSIC_GAME_FONT,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  settingsOptionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  settingsOptionChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 230, 255, 0.35)',
    backgroundColor: 'rgba(40, 60, 110, 0.45)',
    alignItems: 'center',
  },
  settingsOptionChipActive: {
    borderColor: '#7ff0e7',
    backgroundColor: 'rgba(79, 209, 199, 0.28)',
  },
  settingsOptionText: {
    color: '#d4e4f7',
    fontSize: 12,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    textAlign: 'center',
    letterSpacing: 0.25,
  },
  settingsOptionTextActive: {
    color: '#ffffff',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4fd1c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7ff0e7',
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    fontSize: 13,
    letterSpacing: 0.35,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'rgba(38, 53, 92, 0.62)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(171, 197, 225, 0.34)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e7f1fb',
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    fontSize: 13,
    letterSpacing: 0.35,
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 4,
  },
  touchHalf: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dpadLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    zIndex: 5,
  },
  dpadBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(22, 42, 88, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(186, 221, 255, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadArrow: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: -3,
  },
})
