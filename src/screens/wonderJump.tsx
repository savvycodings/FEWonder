import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  SvgUri,
  SvgXml,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { User, WonderJumpLeaderboardEntry } from '../../types'
import { DailyRewardsMysteryGiftVisual } from '../components/DailyRewardsMysteryGiftVisual'
import { ensureGiftboxSvgXml, giftboxSvgAssetUri, peekGiftboxSvgXml } from '../giftboxSvgAsset'
import { ensureJetpackSvgXml, jetpackSvgAssetUri, peekJetpackSvgXml } from '../jetpackSvgAsset'
import { loadWonderJumpCharacterStyle, type WonderJumpCharacterStyle } from '../wonderJumpCharacters'
import { WonderSpinningCoin } from '../components/WonderCoin'
import { WonderJumpCharacterSvg } from '../components/WonderJumpCharacterSvg'
import {
  claimWonderJumpChest,
  fetchSessionUser,
  fetchWonderJumpLeaderboard,
  fetchWonderJumpProgress,
  pickupWonderJumpChest,
  saveWonderJumpProgress,
  startWonderJumpChestOpen,
} from '../utils'
import { ThemeContext } from '../context'
import { brandAccentRgba, BRAND_ACCENT_LIME_HEX } from '../brandAccent'
import {
  getMeteorPlumeReach,
  METEOR_VARIANT_CONFIG,
  MeteorComposite,
  pickAsteroidVariant,
  type AsteroidVariant,
} from '../wonderJump/meteorArt'
type RunMode = 'menu' | 'playing' | 'paused' | 'gameOver'
type PlatformKind = 'normal' | 'bouncy' | 'moving' | 'breakable'
type ControlScheme = 'touchSplit' | 'dpad'

/** Starting biome from Home or in-game menu (affects visuals + mushroom surface mix). */
export type WonderJumpStartBiome = 'grassland' | 'mushroom' | 'tropical' | 'space'

export type WonderJumpDeathCause = 'fall' | 'spike' | 'crab' | 'asteroid'

type PlatformSurfaceKind = 'grass' | 'sand' | 'mushroom_grey' | 'mushroom_red' | 'moon'

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

type JetpackPickup = {
  id: string
  x: number
  y: number
  width: number
  height: number
  collected: boolean
  hoverPhase: number
}

/** In-world gift chest (no hover bob — sits flush on the platform). */
type ChestPickup = {
  id: string
  x: number
  y: number
  width: number
  height: number
  collected: boolean
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
}

/** Falling meteor hazard in deep space — world coords, moves downward (+Y). */
type Asteroid = {
  id: string
  variant: AsteroidVariant
  x: number
  y: number
  width: number
  height: number
  velocityY: number
  rotation: number
  spinRate: number
  flamePhase: number
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
  jetpacks: JetpackPickup[]
  chests: ChestPickup[]
  /** At most one chest entity per run; server blocks another until claim. */
  chestSpawnedThisRun: boolean
  crabs: Crab[]
  asteroids: Asteroid[]
  /** Raw heightScore at last asteroid spawn (spacing). */
  lastAsteroidSpawnHeight: number
  cameraY: number
  heightScore: number
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
  /** Display-rate tick for meteor flame (matches design canvas RAF). */
  flameAnimTick: number
  /** Jetpack pickups collected this run (each pickup counts once). */
  jetpacksUsedThisRun: number
  /** Set when entering game over; cleared on menu / new run. */
  deathCause: WonderJumpDeathCause | null
  startBiome: WonderJumpStartBiome
}

type InputState = {
  leftPressed: boolean
  rightPressed: boolean
}

const PLAYER_SIZE = 24
/** Feet may sit this far from the math platform top and still count as grounded (float + tick timing). */
const GROUND_SUPPORT_SLACK_PX = 4
const PLATFORM_HEIGHT = 12
/** Extra pixels drawn below hitbox so dirt “hangs” like the reference sprite (collision stays 12px). */
const PLATFORM_VISUAL_OVERHANG = 7
function platformVisualShellHeight(_surface: PlatformSurfaceKind) {
  return PLATFORM_HEIGHT + PLATFORM_VISUAL_OVERHANG
}

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
const GRASSLAND_BG_IMAGE = require('../../assets/wj-grassland-bg.png')
/** Chest sits on platform tops in full tropical only (`tropicalBlend === 1`, not the climb-in gradient). */
const TROPICAL_CHEST_MIN_BLEND = 1
/** ~1-in-200 “vibe” per eligible main-chain roll in full tropical (Bernoulli each roll, not a literal counter). */
const CHEST_SPAWN_P = 1 / 200
const CHEST_PICKUP_W = 32
const CHEST_PICKUP_H = 30
const WONDER_JUMP_CHEST_REWARD_COINS = 4

const CRAB_W = 26
const CRAB_H = 20
/** Base chance when tropical gameplay first applies (climbing from grass/mushroom). */
const CRAB_SPAWN_CHANCE = 0.14
/** Higher when the run started in the tropical biome. */
const CRAB_SPAWN_CHANCE_TROPICAL_START = 0.24
/** When tropical blend is active but not full start-biome. */
const CRAB_SPAWN_CHANCE_TROPICAL_BLEND = 0.2
const CRAB_DEATH_MS = 520
/** Per-tick spawn roll when height separation is satisfied (space only). */
const ASTEROID_SPAWN_P = 0.026
const MAX_ASTEROIDS_ALIVE = 2
const MIN_ASTEROID_SPAWN_HEIGHT_SEP = 300
/** Bouncy platforms collide on spring tray, not grass top. */
const SPRING_COLLISION_RAISE = 6

const SPIKE_VISUAL_HEIGHT = 14
/** Spikes start once you’ve climbed this high (see heightScore in game loop). */
const SPIKE_MIN_HEIGHT_SCORE_GRASS = 70
const SPIKE_MIN_HEIGHT_SCORE_MUSHROOM = 0
/** First N main-chain platforms in the initial world never get spikes. */
const SPIKE_START_INITIAL_INDEX_GRASS = 8
const SPIKE_START_INITIAL_INDEX_MUSHROOM = 4
const MAX_JETPACKS_ALIVE = 2
const MIN_JETPACK_VERTICAL_SEP = 220
const JETPACK_SPAWN_P_GRASS = 0.04
const JETPACK_SPAWN_P_MUSHROOM = 0.065
const JETPACK_PICKUP_W = 30
const JETPACK_PICKUP_H = 34
const JETPACK_DURATION_MS = 1650
const JETPACK_THRUST_VELOCITY = -11.79
const JETPACK_END_SPIKE_GRACE_MS = 420
const EQUIPPED_JETPACK_CENTER_OFFSET_X = -14
const EQUIPPED_JETPACK_TOP_OFFSET_Y = 3
const EQUIPPED_JETPACK_VISUAL_W = 58
const EQUIPPED_JETPACK_VISUAL_H = 46
const EQUIPPED_JETPACK_VISUAL_LEFT = -3
const EQUIPPED_JETPACK_VISUAL_TOP = 9
const EQUIPPED_JETPACK_LEFT_NOZZLE_X = EQUIPPED_JETPACK_VISUAL_LEFT + EQUIPPED_JETPACK_VISUAL_W * 0.18
const EQUIPPED_JETPACK_RIGHT_NOZZLE_X = EQUIPPED_JETPACK_VISUAL_LEFT + EQUIPPED_JETPACK_VISUAL_W * 0.82
const EQUIPPED_JETPACK_FLAME_TOP = EQUIPPED_JETPACK_VISUAL_TOP + EQUIPPED_JETPACK_VISUAL_H * 0.84
/** Doodle-style: faster lateral, floaty jump, pass-through platforms */
const BASE_SPEED = 6.85
const GRAVITY = 0.52
const NORMAL_JUMP_VELOCITY = -11.12
/** Spring pad — a clear boost over normal, not a sky launch */
const BOUNCY_JUMP_VELOCITY = -13.59
/**
 * Physics are tuned for a fixed ~60 Hz tick. `requestAnimationFrame` follows display refresh
 * (90–120 Hz) and applies velocity/gravity extra times per second, which makes jumps feel “broken”.
 */
const SIM_TICK_MS = 1000 / 60
/** Cap physics catch-up per display frame so a stall does not hitch the JS thread. */
const MAX_SIM_STEPS_PER_FRAME = 3
const MAX_FALL_VELOCITY = 13
/** Stable identity when jetpack shake is off so child memo comparisons stay cheap. */
const JETPACK_SHAKE_NONE = Object.freeze({ x: 0 as number, y: 0 as number })

/** Reuse the previous array reference when every element is unchanged (helps memoized platform rows). */
function reuseShallowArray<T>(next: T[], prev: T[]): T[] {
  if (next.length !== prev.length) return next
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== prev[i]) return next
  }
  return prev
}
const TILE_HORIZONTAL_MARGIN = 12
/** Fewer starting rows = less crowded climbs (tune with vertical gaps below). */
const INITIAL_PLATFORM_COUNT = 22

/**
 * Vertical distance between chained platforms must stay within a normal hop (~112px max rise).
 * Caps + post-pass guarantee every main-chain step is always jumpable.
 */
const MIN_CHAIN_VERTICAL_GAP = 40
const MAX_CHAIN_VERTICAL_GAP = 78
/** Max horizontal overlap between consecutive main-chain platforms (prevents idle ladder climbs). */
const CHAIN_MAX_X_OVERLAP_IDLE = 16
const CHAIN_MIN_LATERAL_FRACTION_OF_REACH = 0.46

type ChainSpawnState = {
  step: number
  lastSign: -1 | 0 | 1
  streakSameSide: number
}

function createChainSpawnState(): ChainSpawnState {
  return { step: 0, lastSign: 0, streakSameSide: 0 }
}

function maxIdleSafeChainOverlap(prevW: number, nextW: number) {
  return clamp(Math.min(prevW, nextW) * 0.16, 8, CHAIN_MAX_X_OVERLAP_IDLE)
}

function minChainCenterSeparation(prevW: number, nextW: number, reach: number) {
  const maxOv = maxIdleSafeChainOverlap(prevW, nextW)
  const sepFromOverlap = (prevW + nextW) / 2 - maxOv
  const sepFromReach = reach * CHAIN_MIN_LATERAL_FRACTION_OF_REACH
  return clamp(Math.max(sepFromOverlap, sepFromReach), 18, reach * 0.94)
}

function pickChainHorizontalSign(state: ChainSpawnState): number {
  const r = Math.random()
  if (state.streakSameSide >= 2) return state.lastSign > 0 ? -1 : 1
  if (state.lastSign === 0) return Math.random() < 0.5 ? 1 : -1
  if (r < 0.3) return state.lastSign
  if (r < 0.72) return state.lastSign > 0 ? -1 : 1
  return Math.random() < 0.5 ? 1 : -1
}

function pickChainOffsetMagnitude(reach: number, heightDifficulty: number) {
  const spread = heightDifficulty * 0.04
  const r = Math.random()
  if (r < 0.25) return randomInRange(reach * (0.34 - spread), reach * (0.58 + spread))
  if (r < 0.7) return randomInRange(reach * (0.54 - spread), reach * (0.84 + spread))
  return randomInRange(reach * (0.76 - spread), reach * (0.97 + spread))
}

function commitChainSpawnSide(state: ChainSpawnState, sign: number) {
  if (state.lastSign === sign) state.streakSameSide += 1
  else state.streakSameSide = 1
  state.lastSign = sign
  state.step += 1
}

function resolveChainCenterX(
  prevCx: number,
  targetCx: number,
  prevW: number,
  nextW: number,
  reach: number,
  centerMin: number,
  centerMax: number
): number {
  const minSep = minChainCenterSeparation(prevW, nextW, reach)
  let cx = clamp(targetCx, centerMin, centerMax)
  if (Math.abs(cx - prevCx) < minSep) {
    const rightCx = clamp(prevCx + minSep, centerMin, centerMax)
    const leftCx = clamp(prevCx - minSep, centerMin, centerMax)
    const rightDist = Math.abs(rightCx - prevCx)
    const leftDist = Math.abs(leftCx - prevCx)
    if (rightDist >= leftDist && rightDist >= minSep * 0.5) cx = rightCx
    else if (leftDist >= minSep * 0.5) cx = leftCx
    else cx = rightDist >= leftDist ? rightCx : leftCx
  }
  if (Math.abs(cx - prevCx) > reach) {
    cx = prevCx + (cx > prevCx ? reach : -reach)
    cx = clamp(cx, centerMin, centerMax)
  }
  return cx
}

/** ~50 main-chain steps × average vertical gap → switch into mushroom blend band */
const MUSHROOM_BIOME_HEIGHT_START = 50 * 58
/** Height score distance over which grassland scenery lerps into mushroom isles */
const MUSHROOM_BIOME_BLEND_RANGE = 780
/** When blend ≥ this, mushroom-biome gameplay tuning applies (sparser rows, fewer pads). */
const MUSHROOM_GAMEPLAY_BLEND = 0.5
/** After mushroom isles, transition into the tropical archipelago biome. */
const TROPICAL_BIOME_HEIGHT_START = MUSHROOM_BIOME_HEIGHT_START + 50 * 58
/** Height score distance over which mushroom scenery lerps into tropical. */
const TROPICAL_BIOME_BLEND_RANGE = 820
/** When tropical blend ≥ this, tropical gameplay tuning applies (matches mushroom rates). */
const TROPICAL_GAMEPLAY_BLEND = 0.5

/** Raw climb below this uses a simple divisor (~+1 per platform row). */
const DISPLAY_SCORE_EARLY_RAW_MAX = 1200
const DISPLAY_SCORE_EARLY_DIVISOR = 58
/** Displayed score at tropical threshold — keeps numbers human-sized, not millions. */
const DISPLAY_SCORE_AT_TROPICAL = 300
/** HUD score where space biome begins to appear (matches displayRunScore past tropical). */
const SPACE_BIOME_DISPLAY_START = 700
/** Raw height where space scenery starts (display 700 after tropical display 300). */
const SPACE_BIOME_HEIGHT_START =
  TROPICAL_BIOME_HEIGHT_START + (SPACE_BIOME_DISPLAY_START - DISPLAY_SCORE_AT_TROPICAL) * 45
/** Height score distance over which tropical scenery lerps into deep space. */
const SPACE_BIOME_BLEND_RANGE = 820
/** When space blend ≥ this, space gameplay tuning applies (sparser than tropical). */
const SPACE_GAMEPLAY_BLEND = 0.5

/** UI score from internal height metric (same input as biome blends). */
function displayRunScore(rawHeightScore: number): number {
  if (rawHeightScore <= 0) return 0
  const earlyPts = Math.floor(Math.min(rawHeightScore, DISPLAY_SCORE_EARLY_RAW_MAX) / DISPLAY_SCORE_EARLY_DIVISOR)
  if (rawHeightScore <= DISPLAY_SCORE_EARLY_RAW_MAX) return earlyPts
  if (rawHeightScore < TROPICAL_BIOME_HEIGHT_START) {
    const span = TROPICAL_BIOME_HEIGHT_START - DISPLAY_SCORE_EARLY_RAW_MAX
    const t = (rawHeightScore - DISPLAY_SCORE_EARLY_RAW_MAX) / span
    return earlyPts + Math.floor(t * (DISPLAY_SCORE_AT_TROPICAL - earlyPts))
  }
  const past = rawHeightScore - TROPICAL_BIOME_HEIGHT_START
  return DISPLAY_SCORE_AT_TROPICAL + Math.floor(past / 45)
}

function deathBlurb(cause: WonderJumpDeathCause | null): string {
  switch (cause) {
    case 'fall':
      return 'You fell off the bottom of the climb.'
    case 'spike':
      return 'A spike ended that jump.'
    case 'crab':
      return 'A tropical crab got you.'
    case 'asteroid':
      return 'A meteor caught you.'
    default:
      return ''
  }
}

function formatWonderJumpChestRemaining(unlockIso: string): string {
  const t = new Date(unlockIso).getTime() - Date.now()
  if (!Number.isFinite(t) || t <= 0) return 'Ready!'
  const totalSec = Math.ceil(t / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

/** Extra vertical gap range for main-chain spawns in mushroom (still clamped jump-safe). */
const MUSHROOM_CHAIN_GAP_EXTRA_MIN = 8
const MUSHROOM_CHAIN_GAP_EXTRA_MAX = 10
/** P(attempt sibling row) — lower in mushroom for sparser side platforms */
const SIBLING_TRY_CHANCE_GRASS = 0.12
const SIBLING_TRY_CHANCE_MUSHROOM = 0.07
const SIBLING_TRY_CHANCE_SPACE = 0.05
/** Extra vertical gap on main-chain spawns in deep space (exclusive — not stacked with mushroom/tropical). */
const SPACE_CHAIN_GAP_EXTRA_MIN = 6
const SPACE_CHAIN_GAP_EXTRA_MAX = 10
const BOUNCY_CHANCE_GRASS = 0.21
const BOUNCY_CHANCE_MUSHROOM = 0.17
const BOUNCY_CHANCE_SPACE = 0.15

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
/** Deep space: black starfield + cool tile tint. */
const SPACE_THEME = {
  screenBg: '#020208',
  tileBg: '#1e2433',
  sky: '#000000',
  sunGlow: 'rgba(120, 140, 255, 0.18)',
  hillFar: '#12141c',
  hillNear: '#0c0e16',
}
const CLASSIC_GAME_FONT = Platform.select({
  ios: 'Courier',
  default: 'monospace',
})
const CLASSIC_GAME_FONT_BOLD = Platform.select({
  ios: 'Courier-Bold',
  default: 'monospace',
})

/** WonderJump modals — same face as home (`App.tsx` `useFonts`). */
const WONDER_JUMP_UI_BOLD = 'Montserrat_700Bold' as const

const APP_UI_SURFACE = '#0a0a0a'
const APP_UI_TEXT = '#ffffff'
const APP_UI_TEXT_MUTED = 'rgba(255, 255, 255, 0.72)'
const APP_UI_TEXT_DIM = 'rgba(255, 255, 255, 0.58)'

/** Game-over line: biome you died in (readable on dark panel). */
const GAME_OVER_DEAD_BIOME_TEXT: Record<WonderJumpStartBiome, string> = {
  grassland: '#a8e9a0',
  /** Light maroon / dusty wine — readable on dark glass */
  mushroom: '#c97a8e',
  tropical: '#5ee8f0',
  space: '#b8c4e8',
}

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
  space: {
    label: 'Deep Space',
    accent: '#8b9ad4',
    accentSoft: 'rgba(139, 154, 212, 0.34)',
  },
}

/** Bright biome labels on the dark leaderboard card. */
const LEADERBOARD_BIOME_TEXT_COLOR: Record<WonderJumpStartBiome, string> = {
  grassland: '#8efc7a',
  mushroom: '#ff5c7a',
  tropical: '#3ee8ff',
  space: '#b48cff',
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
  if (startBiome === 'mushroom' || startBiome === 'tropical' || startBiome === 'space') return 1
  return clamp((heightScore - MUSHROOM_BIOME_HEIGHT_START) / MUSHROOM_BIOME_BLEND_RANGE, 0, 1)
}

/** 0 = mushroom, 1 = tropical (used for sky/hills + platform surface mix). */
function getTropicalBlend(heightScore: number, startBiome: WonderJumpStartBiome): number {
  if (startBiome === 'tropical' || startBiome === 'space') return 1
  return clamp((heightScore - TROPICAL_BIOME_HEIGHT_START) / TROPICAL_BIOME_BLEND_RANGE, 0, 1)
}

/** 0 = tropical, 1 = deep space. */
function getSpaceBlend(heightScore: number, startBiome: WonderJumpStartBiome): number {
  if (startBiome === 'space') return 1
  return clamp((heightScore - SPACE_BIOME_HEIGHT_START) / SPACE_BIOME_BLEND_RANGE, 0, 1)
}

function isMushroomGameplay(startBiome: WonderJumpStartBiome, mushroomBlend: number, tropicalBlend: number) {
  return (
    startBiome === 'mushroom' ||
    startBiome === 'tropical' ||
    startBiome === 'space' ||
    mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND ||
    tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
  )
}

function isSpaceGameplay(startBiome: WonderJumpStartBiome, spaceBlend: number) {
  return startBiome === 'space' || spaceBlend >= SPACE_GAMEPLAY_BLEND
}

function pickPlatformSurface(mushroomBlend: number, tropicalBlend: number, spaceBlend: number): PlatformSurfaceKind {
  if (spaceBlend >= SPACE_GAMEPLAY_BLEND) return 'moon'
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

function biomeHudLabel(
  mushroomBlend: number,
  tropicalBlend: number,
  spaceBlend: number,
  startBiome: WonderJumpStartBiome,
): string {
  if (startBiome === 'space') return 'Deep Space'
  if (startBiome === 'tropical') return spaceBlend > 0.88 ? 'Deep Space' : 'Sunset Keys'
  if (startBiome === 'mushroom') {
    if (spaceBlend > 0.88) return 'Deep Space'
    return tropicalBlend > 0.88 ? 'Sunset Keys' : 'Mushroom Isles'
  }
  if (spaceBlend > 0.9) return 'Deep Space'
  if (tropicalBlend > 0.9) return 'Sunset Keys'
  if (mushroomBlend > 0.9) return 'Mushroom Isles'
  if (spaceBlend > 0.08) return 'Space frontier'
  if (mushroomBlend < 0.08) return 'Grasslands'
  return 'Mushroom frontier'
}

/** Map in-run HUD label to accent biome for colors (game over should match where you were, not only run start). */
function hudBiomeLabelToAccentBiome(hudLabel: string): WonderJumpStartBiome {
  if (hudLabel === 'Deep Space' || hudLabel === 'Space frontier') return 'space'
  if (hudLabel === 'Sunset Keys') return 'tropical'
  if (hudLabel === 'Mushroom Isles' || hudLabel === 'Mushroom frontier') return 'mushroom'
  return 'grassland'
}

/** Biomes unlocked by climbing to gameplay thresholds in a single run from `startBiome`. */
function biomesUnlockedForHeight(heightScore: number, startBiome: WonderJumpStartBiome): WonderJumpStartBiome[] {
  const out: WonderJumpStartBiome[] = ['grassland']
  if (getMushroomBlend(heightScore, startBiome) >= MUSHROOM_GAMEPLAY_BLEND) out.push('mushroom')
  if (getTropicalBlend(heightScore, startBiome) >= TROPICAL_GAMEPLAY_BLEND) out.push('tropical')
  if (getSpaceBlend(heightScore, startBiome) >= SPACE_GAMEPLAY_BLEND) out.push('space')
  return out
}

function accentBiomeAtHeight(heightScore: number, startBiome: WonderJumpStartBiome): WonderJumpStartBiome {
  return hudBiomeLabelToAccentBiome(
    biomeHudLabel(
      getMushroomBlend(heightScore, startBiome),
      getTropicalBlend(heightScore, startBiome),
      getSpaceBlend(heightScore, startBiome),
      startBiome
    )
  )
}

/** Leaderboard high scores are display points — map them to biome accents. */
function accentBiomeFromDisplayScore(displayScore: number): WonderJumpStartBiome {
  const s = Math.floor(displayScore)
  if (s >= SPACE_BIOME_DISPLAY_START) return 'space'
  if (s >= DISPLAY_SCORE_AT_TROPICAL) return 'tropical'
  if (s >= 130) return 'mushroom'
  return 'grassland'
}

const BIOME_ACCENT_RANK: Record<WonderJumpStartBiome, number> = {
  grassland: 0,
  mushroom: 1,
  tropical: 2,
  space: 3,
}

function maxBiomeAccent(a: WonderJumpStartBiome, b: WonderJumpStartBiome): WonderJumpStartBiome {
  return BIOME_ACCENT_RANK[a] >= BIOME_ACCENT_RANK[b] ? a : b
}

function resolveLeaderboardBiomeId(biomeReached: string, displayScore: number): WonderJumpStartBiome {
  const stored: WonderJumpStartBiome =
    biomeReached === 'mushroom' || biomeReached === 'tropical' || biomeReached === 'space'
      ? biomeReached
      : 'grassland'
  return maxBiomeAccent(stored, accentBiomeFromDisplayScore(displayScore))
}

function wonderJumpBiomeDisplayLabel(biomeId: string): string {
  if (biomeId === 'mushroom' || biomeId === 'tropical' || biomeId === 'space') {
    return BIOME_UI_ACCENTS[biomeId].label
  }
  return BIOME_UI_ACCENTS.grassland.label
}

function wonderJumpLeaderboardBiomeColor(biomeId: string): string {
  if (biomeId === 'mushroom' || biomeId === 'tropical' || biomeId === 'space') {
    return LEADERBOARD_BIOME_TEXT_COLOR[biomeId]
  }
  return LEADERBOARD_BIOME_TEXT_COLOR.grassland
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
  c1 = resolveChainCenterX(prevCx, c1, prev.width, w, reach, cMin, cMax)
  let x1 = c1 - w / 2
  let overlap = overlapWidth(prev.x, prev.x + prev.width, x1, x1 + w)
  const maxOv = maxIdleSafeChainOverlap(prev.width, w)
  if (overlap > maxOv) {
    const push = overlap - maxOv + 4
    c1 = clamp(c1 + (c1 >= prevCx ? push : -push), cMin, cMax)
    if (Math.abs(c1 - prevCx) > reach) {
      c1 = clamp(prevCx + (c1 > prevCx ? reach : -reach), cMin, cMax)
    }
    x1 = c1 - w / 2
    overlap = overlapWidth(prev.x, prev.x + prev.width, x1, x1 + w)
    if (overlap > maxOv + 2) {
      c1 = resolveChainCenterX(prevCx, c1, prev.width, w, reach, cMin, cMax)
      x1 = c1 - w / 2
    }
  }
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

/** Only the upper (pointy) band is lethal — not the wide triangle base / stem under it. */
function playerHitsSpike(player: Player, spike: Spike) {
  const shrinkX = spike.width * 0.24
  const padTop = 2
  const hitX = spike.x + shrinkX
  const hitY = spike.y + padTop
  const hitW = spike.width - 2 * shrinkX
  const hitH = spike.height - padTop
  const lethalH = Math.max(hitH * 0.44, 5.5)
  if (!rectsOverlap(player, { x: hitX, y: hitY, width: hitW, height: lethalH })) {
    return false
  }

  const vx = player.velocityX
  const vy = player.velocityY

  // Falling onto the sharp band — lethal.
  if (vy > 0.28) {
    return true
  }

  // Strong sideways scrape through the point — lethal.
  if (Math.abs(vx) > 1.2) {
    return true
  }

  // Rising / brushing the underside or stem — safe.
  if (vy < -0.1) {
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

/** Drop orphaned spikes and pin x/y to the host platform (moving tiles, after cull). */
function syncSpikesToPlatforms(spikes: Spike[], platforms: PlatformItem[]): Spike[] {
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]))
  const out: Spike[] = []
  for (const spike of spikes) {
    const host = platformById.get(spike.id.replace('spike-', ''))
    if (!host) continue
    out.push({
      ...spike,
      x: host.x + spike.offsetX,
      y: host.y - spike.height,
    })
  }
  return out
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
  return startBiome === 'mushroom' || startBiome === 'tropical' || startBiome === 'space'
    ? SPIKE_START_INITIAL_INDEX_MUSHROOM
    : SPIKE_START_INITIAL_INDEX_GRASS
}

function spikeActivationHeight(
  startBiome: WonderJumpStartBiome,
  mushroomBlend: number,
  tropicalBlend: number,
  spaceBlend = 0
) {
  if (
    isMushroomGameplay(startBiome, mushroomBlend, tropicalBlend) ||
    isSpaceGameplay(startBiome, spaceBlend)
  ) {
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
  tropicalBlend = 0,
  spaceBlend = 0,
  /** Main-chain layout memory; omit for siblings and one-offs. */
  chainState?: ChainSpawnState
): PlatformItem {
  const width =
    spaceBlend >= SPACE_GAMEPLAY_BLEND
      ? randomInRange(50, 98)
    : tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
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

    let targetCx: number
    if (chainState) {
      const sign = pickChainHorizontalSign(chainState)
      const offset = pickChainOffsetMagnitude(reach, heightDifficulty)
      targetCx = prevCx + sign * offset

      if (Math.random() < 0.14) {
        const third = playWidth / 3
        const anchorRoll = Math.random()
        if (anchorRoll < 0.34) targetCx = randomInRange(centerMin, third)
        else if (anchorRoll < 0.67) targetCx = randomInRange(third, 2 * third)
        else targetCx = randomInRange(2 * third, centerMax)
      }

      targetCx = resolveChainCenterX(
        prevCx,
        targetCx,
        previousPlatform.width,
        width,
        reach,
        centerMin,
        centerMax
      )
      commitChainSpawnSide(chainState, targetCx >= prevCx ? 1 : -1)
    } else {
      targetCx = clamp(prevCx + randomInRange(-reach * 0.92, reach * 0.92), centerMin, centerMax)
    }

    x = clamp(targetCx - width / 2, minX, maxX)
  }
  const tropicalHard = tropicalBlend >= TROPICAL_GAMEPLAY_BLEND ? 0.06 + tropicalBlend * 0.05 : 0
  const movingChance = clamp(0.14 + heightDifficulty * 0.16 + tropicalHard, 0.12, 0.46)
  const breakableChance = allowBreakable
    ? Math.min(0.06 + heightDifficulty * 0.08, 0.18)
    : 0
  const bouncyChance =
    spaceBlend >= SPACE_GAMEPLAY_BLEND
      ? BOUNCY_CHANCE_SPACE
    : mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND || tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
      ? BOUNCY_CHANCE_MUSHROOM
      : BOUNCY_CHANCE_GRASS
  let kind: PlatformKind = 'normal'
  const roll = Math.random()
  if (roll < movingChance) kind = 'moving'
  else if (roll < movingChance + breakableChance) kind = 'breakable'
  else if (roll < movingChance + breakableChance + bouncyChance) kind = 'bouncy'

  const moveDistance = randomInRange(34, 92)
  const surface = pickPlatformSurface(mushroomBlend, tropicalBlend, spaceBlend)
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
    topFlowers: buildPlatformTopFlowers(surface, width, kind, mushroomBlend, tropicalBlend),
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
  tropicalBlend: number,
  spaceBlend = 0
): PlatformItem | null {
  const siblingTry =
    spaceBlend >= SPACE_GAMEPLAY_BLEND
      ? SIBLING_TRY_CHANCE_SPACE
      : mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND || tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
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
      tropicalBlend,
      spaceBlend
    )
    if (!avoid.some((o) => rectsOverlap(o, p))) {
      return p
    }
  }
  return null
}

function spikeSpawnChance(
  mushroomBlend: number,
  tropicalBlend: number,
  startBiome: WonderJumpStartBiome,
  heightDifficulty: number,
  spaceBlend = 0
) {
  const effectiveBlend =
    startBiome === 'tropical' || startBiome === 'space'
      ? 1
      : Math.max(mushroomBlend, tropicalBlend, spaceBlend)
  const biomeBase =
    effectiveBlend >= MUSHROOM_GAMEPLAY_BLEND
      ? 0.18 + (effectiveBlend - MUSHROOM_GAMEPLAY_BLEND) * 0.16
      : 0.05 + effectiveBlend * 0.05
  const spaceScale = isSpaceGameplay(startBiome, spaceBlend) ? 0.88 : 1
  return clamp((biomeBase + heightDifficulty * 0.1) * spaceScale, 0.04, 0.38)
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
  forceSpawn = false,
  spaceBlend = 0
): Spike[] {
  if (!allowSpikes) return []
  if (!forceSpawn && Math.random() > spikeSpawnChance(mushroomBlend, tropicalBlend, startBiome, heightDifficulty, spaceBlend)) {
    return []
  }
  const spike = createSpikeOnPlatform(platform)
  return spike ? [spike] : []
}

function buildPlatformTopMushrooms(
  surface: PlatformSurfaceKind,
  width: number,
  kind: PlatformKind
): PlatformTopMushroom[] | undefined {
  if (kind === 'breakable') return undefined
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
  if (platform.kind === 'breakable') return { ...platform, topPalmTree: undefined }
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
  spaceBlend: number,
  startBiome: WonderJumpStartBiome,
  seed: number
): Crab[] {
  if (hasSpike) return []
  if (startBiome === 'space' || spaceBlend >= 0.12) return []
  if (startBiome !== 'tropical' && tropicalBlend < TROPICAL_GAMEPLAY_BLEND) return []
  if (platform.isFalling || platform.kind === 'breakable') return []
  if (platform.surface !== 'grass' && platform.surface !== 'sand') return []
  if (platform.width < 78) return []
  const spawnChance =
    startBiome === 'tropical'
      ? CRAB_SPAWN_CHANCE_TROPICAL_START
      : tropicalBlend >= TROPICAL_GAMEPLAY_BLEND
        ? CRAB_SPAWN_CHANCE_TROPICAL_BLEND
        : CRAB_SPAWN_CHANCE
  if (Math.random() > spawnChance) return []

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
    },
  ]
}

function spawnJetpack(
  platform: PlatformItem,
  currentAliveCount: number,
  lastJetpackY: number | null,
  mushroomBlend: number,
  tropicalBlend: number,
  spaceBlend: number,
  startBiome: WonderJumpStartBiome
): JetpackPickup[] {
  if (startBiome === 'space' || spaceBlend >= 0.12) return []
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

function trySpawnAsteroid(
  cameraY: number,
  playWidth: number,
  heightScore: number,
  seed: number,
  spaceBlend: number,
  startBiome: WonderJumpStartBiome,
  aliveCount: number,
  lastAsteroidSpawnHeight: number
): Asteroid | null {
  if (!isSpaceGameplay(startBiome, spaceBlend)) return null
  if (aliveCount >= MAX_ASTEROIDS_ALIVE) return null
  if (heightScore - lastAsteroidSpawnHeight < MIN_ASTEROID_SPAWN_HEIGHT_SEP) return null
  if (Math.random() > ASTEROID_SPAWN_P) return null
  const variant = pickAsteroidVariant(seed)
  const cfg = METEOR_VARIANT_CONFIG[variant]
  const width = cfg.rockW
  const height = cfg.rockH
  const margin = 18
  const x = randomInRange(margin, Math.max(margin, playWidth - width - margin))
  const y = cameraY - randomInRange(48, 140)
  return {
    id: `asteroid-${seed}-${Math.round(y)}`,
    variant,
    x,
    y,
    width,
    height,
    velocityY: randomInRange(cfg.velocityYMin, cfg.velocityYMax),
    rotation: 0,
    spinRate: 0,
    flamePhase: Math.random() * Math.PI * 2,
  }
}

function playerHitsAsteroid(player: Player, asteroid: Asteroid): boolean {
  const padX = 5
  const padY = 6
  const ax = asteroid.x + padX
  const ay = asteroid.y + padY
  const aw = asteroid.width - padX * 2
  const ah = asteroid.height - padY * 2
  return (
    player.x < ax + aw &&
    player.x + player.width > ax &&
    player.y < ay + ah &&
    player.y + player.height > ay
  )
}

function trySpawnWonderJumpChest(
  platform: PlatformItem,
  chestSpawnedThisRun: boolean,
  tropicalBlend: number,
  spaceBlend: number,
  allowChestForAccount: boolean
): ChestPickup[] {
  if (!allowChestForAccount) return []
  if (chestSpawnedThisRun) return []
  if (tropicalBlend < TROPICAL_CHEST_MIN_BLEND) return []
  if (spaceBlend >= 0.12) return []
  if (platform.kind === 'moving' || platform.kind === 'breakable' || platform.isFalling) return []
  if (platform.surface !== 'grass' && platform.surface !== 'sand') return []
  if (Math.random() > CHEST_SPAWN_P) return []
  const topY = platformTopY(platform)
  return [
    {
      id: `wj-chest-${platform.id}`,
      x: chestHorizontalLeftOnPlatform(platform, 'center'),
      y: topY - CHEST_PICKUP_H,
      width: CHEST_PICKUP_W,
      height: CHEST_PICKUP_H,
      collected: false,
    },
  ]
}

/** Keeps chest on the platform rim; `right` avoids overlapping the player on the wide start tile. */
function chestHorizontalLeftOnPlatform(platform: PlatformItem, placement: 'center' | 'right'): number {
  const minX = platform.x + 8
  const maxX = Math.max(minX, platform.x + platform.width - CHEST_PICKUP_W - 8)
  if (placement === 'right') return maxX
  return clamp(platform.x + platform.width / 2 - CHEST_PICKUP_W / 2, minX, maxX)
}

function springPadBoundsForPlatform(width: number) {
  const padW = clamp(Math.max(32, width - 8), 36, 78)
  const left = (width - padW) / 2
  return { left, right: left + padW }
}

function buildPlatformTopFlowers(
  surface: PlatformSurfaceKind,
  width: number,
  kind: PlatformKind,
  mushroomBlend: number,
  tropicalBlend: number
): PlatformTopFlower[] | undefined {
  if (kind === 'breakable') return undefined
  /* Flowers only in pure grasslands — not mushroom isles, not tropical / Sunset Keys (incl. sand strips). */
  if (tropicalBlend >= 0.08 || mushroomBlend >= MUSHROOM_GAMEPLAY_BLEND) return undefined
  if (surface !== 'grass') return undefined

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
  const jetpacks: JetpackPickup[] = []
  const crabs: Crab[] = []
  const asteroids: Asteroid[] = []
  const mainChainIndices: number[] = []
  let lastJetpackY: number | null = null
  const initMushroomBlend = getMushroomBlend(0, startBiome)
  const initTropicalBlend = getTropicalBlend(0, startBiome)
  const initSpaceBlend = getSpaceBlend(0, startBiome)
  const firstSpikeIndex = spikeStartIndex(startBiome)

  let y = playHeight - 70
  let lastChainPlatform: PlatformItem | undefined
  const chainState = createChainSpawnState()
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
      initTropicalBlend,
      initSpaceBlend,
      lastChainPlatform ? chainState : undefined
    )
    platforms.push(platform)
    mainChainIndices.push(platforms.length - 1)
    lastChainPlatform = platform
    const spikeAllowed = i >= firstSpikeIndex
    const newSpikes = spawnSpikes(
      platform,
      spikeAllowed,
      initMushroomBlend,
      initTropicalBlend,
      startBiome,
      0,
      false,
      initSpaceBlend
    )
    spikes.push(...newSpikes)
    platforms[platforms.length - 1] = maybeAttachPalmTree(
      { ...platforms[platforms.length - 1], topPalmTree: undefined },
      platforms,
      initTropicalBlend,
      newSpikes.length > 0
    )
    crabs.push(
      ...spawnCrabOnPlatform(
        platforms[platforms.length - 1],
        newSpikes.length > 0,
        initTropicalBlend,
        initSpaceBlend,
        startBiome,
        i
      )
    )
    const jetpackFromChain = spawnJetpack(
      platform,
      jetpacks.length,
      lastJetpackY,
      initMushroomBlend,
      initTropicalBlend,
      initSpaceBlend,
      startBiome
    )
    if (jetpackFromChain.length) {
      jetpacks.push(...jetpackFromChain)
      lastJetpackY = jetpackFromChain[0].y
    }
    if (i > 1) {
      const sibling = trySpawnSiblingPlatform(y, i + 9000, playWidth, 0, platforms, initMushroomBlend, initTropicalBlend, initSpaceBlend)
      if (sibling) {
        platforms.push(sibling)
        const sSpikes = spawnSpikes(
          sibling,
          spikeAllowed,
          initMushroomBlend,
          initTropicalBlend,
          startBiome,
          0,
          false,
          initSpaceBlend
        )
        spikes.push(...sSpikes)
        platforms[platforms.length - 1] = maybeAttachPalmTree(
          { ...platforms[platforms.length - 1], topPalmTree: undefined },
          platforms,
          initTropicalBlend,
          sSpikes.length > 0
        )
        crabs.push(
          ...spawnCrabOnPlatform(
            platforms[platforms.length - 1],
            sSpikes.length > 0,
            initTropicalBlend,
            initSpaceBlend,
            startBiome,
            i + 9000
          )
        )
        const jetpackFromSib = spawnJetpack(
          sibling,
          jetpacks.length,
          lastJetpackY,
          initMushroomBlend,
          initTropicalBlend,
          initSpaceBlend,
          startBiome
        )
        if (jetpackFromSib.length) {
          jetpacks.push(...jetpackFromSib)
          lastJetpackY = jetpackFromSib[0].y
        }
      }
    }
    const stepLo =
      startBiome === 'space'
        ? 48
        : isMushroomGameplay(startBiome, initMushroomBlend, initTropicalBlend)
          ? 54
          : 48
    const stepHi = startBiome === 'space' ? 66 : 88
    const step = clamp(randomInRange(stepLo, stepHi), MIN_CHAIN_VERTICAL_GAP, MAX_CHAIN_VERTICAL_GAP)
    y -= step
  }

  const spawnSurface = pickPlatformSurface(initMushroomBlend, initTropicalBlend, initSpaceBlend)
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
    topFlowers: buildPlatformTopFlowers(spawnSurface, 116, 'normal', initMushroomBlend, initTropicalBlend),
  }

  for (let k = 1; k < mainChainIndices.length; k += 1) {
    const prevI = mainChainIndices[k - 1]
    const curI = mainChainIndices[k]
    platforms[curI] = enforceChainReachable(platforms[prevI], platforms[curI], playWidth, 0)
  }

  const spikesResynced = syncSpikesToPlatforms(spikes, platforms)

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

  const chests: ChestPickup[] = []
  const chestSpawnedThisRun = false

  return {
    player,
    platforms,
    spikes: safeSpikes,
    jetpacks,
    chests,
    chestSpawnedThisRun,
    crabs,
    asteroids,
    lastJetpackY,
    lastAsteroidSpawnHeight: -MIN_ASTEROID_SPAWN_HEIGHT_SEP,
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
    jetpacks: world.jetpacks,
    chests: world.chests,
    chestSpawnedThisRun: world.chestSpawnedThisRun,
    crabs: world.crabs,
    asteroids: world.asteroids,
    cameraY: 0,
    heightScore: 0,
    lastJetpackY: world.lastJetpackY,
    lastAsteroidSpawnHeight: world.lastAsteroidSpawnHeight,
    jetpackFuelMs: 0,
    jetpackEndGraceMs: 0,
    jetpackAnimTick: 0,
    uiAnimTick: 0,
    flameAnimTick: 0,
    jetpacksUsedThisRun: 0,
    deathCause: null,
    startBiome,
  }
}

/** Platform / cloud / spring SVG wrappers — no accent; module scope for memoized game tiles. */
const wjWorldStyles = StyleSheet.create({
  playerShadow: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(23, 46, 58, 0.32)',
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
})

/** Doodle-style spring: wood tray + metal coil (SVG only — no `Line` primitive). */
const DoodleSpringPad = memo(function DoodleSpringPad({ platformWidth }: { platformWidth: number }) {
  const padW = clamp(Math.max(32, platformWidth - 8), 36, 78)
  const left = (platformWidth - padW) / 2
  return (
    <Svg
      pointerEvents="none"
      style={[wjWorldStyles.springPadSvg, { width: padW, left, top: -15 }]}
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
  moon: {
    dirtA: '#7d7973',
    dirtB: '#959088',
    top: '#eceae4',
    topLine: '#d6d4cd',
    topHi: '#f9f7f2',
    blade: '#6e6a64',
  },
}

/** Fixed star positions (viewBox 0–100) for space backdrop — avoids per-frame randomness. */
const SPACE_STAR_FIELD: { x: number; y: number; r: number; o: number }[] = (() => {
  const out: { x: number; y: number; r: number; o: number }[] = []
  for (let i = 0; i < 92; i++) {
    const t = i * 7919 + 104729
    out.push({
      x: (t * 0.137) % 100,
      y: (t * 0.073) % 100,
      r: 0.32 + (i % 6) * 0.11,
      o: 0.42 + (i % 4) * 0.12,
    })
  }
  return out
})()

const PLATFORM_FACE_VB_W = 100
const PLATFORM_FACE_VB_H = 14
const PLATFORM_FACE_GRASS_H = 5.25
const PLATFORM_FACE_BLADE_XS = [6, 18, 30, 44, 58, 71, 85, 94]
const PLATFORM_FACE_GRASS_TUFTS = [4, 11, 19, 27, 35, 43, 50, 58, 66, 74, 82, 90, 97]
const PLATFORM_FACE_GRASS_STONES = [
  { x: 8.5, y: 8.3, rx: 1.2, ry: 0.75, o: 0.3 },
  { x: 16.5, y: 10.8, rx: 0.8, ry: 0.55, o: 0.25 },
  { x: 27.4, y: 9.5, rx: 1.05, ry: 0.7, o: 0.28 },
  { x: 38.2, y: 11.1, rx: 0.95, ry: 0.62, o: 0.22 },
  { x: 49.6, y: 9.2, rx: 1.3, ry: 0.8, o: 0.31 },
  { x: 63.5, y: 10.6, rx: 0.9, ry: 0.6, o: 0.24 },
  { x: 76.2, y: 9.1, rx: 1.15, ry: 0.72, o: 0.27 },
  { x: 89.7, y: 10.9, rx: 1.05, ry: 0.65, o: 0.24 },
]

function platformFaceSeed(id: string, x: number, width: number) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return (h ^ (Math.round(x) * 1597334677) ^ (Math.round(width) * 974934)) >>> 0
}

const SAND_STYLE_PATH = {
  dirtA: 'M1.2,5.15 L0.4,12.5 L4.1,13.8 L9.6,12.4 L16,13.6 L23.4,12.2 L31.3,13.7 L39.8,12.1 L48.4,13.6 L56.9,12 L65.4,13.4 L73.7,11.9 L82.2,13.3 L90.4,11.9 L96.2,12.9 L99.4,11.8 L98.5,5.15 Z',
  dirtB:
    'M2,5.25 L1.5,10.9 L6.6,12.2 L13.5,10.95 L20.7,11.95 L28.8,10.8 L37.2,12.35 L45.9,10.8 L54.8,12.2 L63.9,10.65 L72.8,11.85 L81.7,10.8 L90.3,11.95 L96.1,10.95 L98.4,11.3 L97.8,5.25 Z',
  top: 'M0,0.9 C4.1,0.2 8.2,-0.16 12.3,0.66 C16.3,1.42 20.5,1.3 24.5,0.58 C28.6,-0.1 32.7,-0.1 36.8,0.72 C40.8,1.5 45,1.38 49.1,0.6 C53.1,-0.12 57.2,-0.08 61.3,0.74 C65.4,1.52 69.5,1.4 73.6,0.62 C77.6,-0.12 81.8,-0.1 85.9,0.74 C90,1.52 94.1,1.42 98.2,0.66 L100,0.62 L100,4.65 L0,4.65 Z',
  topLine:
    'M0,1.4 C4.5,0.6 8.8,0.08 13.1,0.95 C17.2,1.72 21.5,1.62 25.8,0.84 C29.9,0.1 34.2,0.1 38.5,0.95 C42.6,1.74 46.9,1.62 51.2,0.84 C55.3,0.08 59.6,0.12 63.9,0.96 C68,1.72 72.3,1.62 76.6,0.84 C80.8,0.1 85.1,0.1 89.5,0.94 C93.6,1.72 97.1,1.6 100,1.02 L100,2.72 C96.9,3.28 93.4,3.42 89.3,2.78 C85,2.12 80.8,2.16 76.5,2.84 C72.2,3.52 67.9,3.44 63.8,2.78 C59.5,2.1 55.2,2.14 51.1,2.82 C46.8,3.52 42.5,3.46 38.4,2.8 C34.1,2.12 29.8,2.14 25.7,2.82 C21.4,3.5 17.1,3.46 13,2.8 C8.7,2.14 4.4,2.2 0,2.88 Z',
} as const

const SAND_STYLE_PEBBLES: { x: number; y: number; rx: number; ry: number; o: number }[] = [
  { x: 10, y: 8.6, rx: 1.1, ry: 0.68, o: 0.24 },
  { x: 24, y: 10.1, rx: 0.9, ry: 0.58, o: 0.2 },
  { x: 38, y: 9.2, rx: 1.05, ry: 0.65, o: 0.22 },
  { x: 52, y: 10.7, rx: 0.95, ry: 0.62, o: 0.19 },
  { x: 66, y: 9.5, rx: 1.15, ry: 0.72, o: 0.23 },
  { x: 80, y: 10.9, rx: 0.9, ry: 0.58, o: 0.2 },
  { x: 92, y: 9.8, rx: 0.95, ry: 0.62, o: 0.19 },
]

/** Prebuilt sand/moon/mycelium faces — built once per palette (not per platform per frame). */
const SAND_STYLE_PLATFORM_FACE_CACHE: Partial<Record<PlatformSurfaceKind, ReactNode>> = {}

function renderSandStylePlatformFace(p: (typeof SURFACE_PALETTES)[PlatformSurfaceKind]) {
  return (
    <>
      <Path fill={p.dirtA} d={SAND_STYLE_PATH.dirtA} />
      <Path fill={p.dirtB} d={SAND_STYLE_PATH.dirtB} opacity={0.96} />
      <Path d={SAND_STYLE_PATH.top} fill={p.top} />
      <Path d={SAND_STYLE_PATH.topLine} fill={p.topLine} opacity={0.86} />
      <Rect x="0" y="0.05" width={PLATFORM_FACE_VB_W} height={0.95} fill={p.topHi} opacity={0.62} />
      <Rect x="0" y="4.15" width={PLATFORM_FACE_VB_W} height={0.56} fill={p.blade} opacity={0.82} />
      {PLATFORM_FACE_BLADE_XS.map((cx, i) => {
        const h = i % 2 === 0 ? 1.8 : 1.45
        return (
          <Rect
            key={`ssb-${i}`}
            x={cx - 0.42}
            y={PLATFORM_FACE_GRASS_H - 1.55}
            width={0.84}
            height={h}
            rx={0.16}
            fill={p.blade}
            opacity={0.48}
          />
        )
      })}
      {SAND_STYLE_PEBBLES.map((s, i) => (
        <Ellipse key={`ssp-${i}`} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={p.topLine} opacity={s.o} />
      ))}
    </>
  )
}

function getSandStylePlatformFace(surface: PlatformSurfaceKind): ReactNode {
  let cached = SAND_STYLE_PLATFORM_FACE_CACHE[surface]
  if (!cached) {
    cached = renderSandStylePlatformFace(SURFACE_PALETTES[surface])
    SAND_STYLE_PLATFORM_FACE_CACHE[surface] = cached
  }
  return cached
}

/** Dirt + grass/mycelium cap paths in the 100×14 viewBox. Callers wrap these in an <Svg> or <G transform>. */
function renderPlatformFaceShapes(surface: PlatformSurfaceKind, _faceSeed = 0) {
  if (surface === 'grass') {
    return (
      <>
        <Path
          d="M0,4.95 L0,13.2 L5.7,13.95 L12.4,12.8 L19.8,13.65 L27.9,12.35 L36.7,13.9 L45.3,12.25 L54.3,13.7 L63.4,12.05 L72.5,13.35 L81.1,12.15 L89.9,13.25 L96.1,12.4 L100,12.9 L100,4.95 Z"
          fill="#744522"
        />
        <Path
          d="M0,4.95 L0,11.1 L6.1,12.35 L13.4,11.2 L21,12.1 L29.1,10.95 L37.5,12.45 L46.2,10.9 L55.1,12.25 L64.2,10.75 L73.1,11.95 L82,10.9 L90.6,12 L96.6,11.1 L100,11.45 L100,4.95 Z"
          fill="#9f6234"
          opacity={0.95}
        />
        <Path
          d="M0,7.2 L8.5,6.35 L16.4,7.25 L24.8,6.45 L33.1,7.35 L41.8,6.55 L50.4,7.45 L59.2,6.6 L67.9,7.5 L76.4,6.6 L85.2,7.55 L93.3,6.7 L100,7.25 L100,8.3 L93.2,8.85 L85.1,7.95 L76.4,8.95 L67.8,8 L59.1,8.95 L50.3,8 L41.7,8.95 L33.1,8 L24.7,8.8 L16.3,7.95 L8.3,8.7 L0,7.9 Z"
          fill="#633619"
          opacity={0.7}
        />
        <Path
          d="M0,9.25 L8.2,8.65 L16.5,9.55 L24.4,8.8 L32.8,9.75 L40.9,8.95 L49.1,9.9 L57.6,9.1 L65.7,10.05 L74.1,9.2 L82.5,10.1 L90.6,9.25 L100,10.05 L100,10.95 L90.5,10.2 L82.4,11.1 L74.1,10.2 L65.6,11.1 L57.5,10.2 L49,11.05 L40.8,10.2 L32.7,11.1 L24.3,10.25 L16.4,11.05 L8.1,10.2 L0,10.85 Z"
          fill="#bb804c"
          opacity={0.34}
        />

        <Path
          d="M0,0.95 C3.5,0.25 6.8,-0.15 10.4,0.55 C14.1,1.2 17.5,1.05 21.1,0.45 C24.6,-0.12 28.2,-0.05 31.8,0.62 C35.2,1.25 38.8,1.18 42.4,0.52 C45.9,-0.12 49.4,-0.08 53,0.62 C56.5,1.3 60.1,1.2 63.8,0.52 C67.3,-0.12 70.9,-0.1 74.5,0.6 C78.1,1.28 81.7,1.2 85.3,0.55 C88.9,-0.1 92.4,-0.06 96,0.62 C97.5,0.92 98.8,1.02 100,0.9 L100,4.55 L0,4.55 Z"
          fill="#95ea59"
        />
        <Path
          d="M0,1.35 C4.2,0.55 8.3,0.08 12.4,0.9 C16.4,1.68 20.5,1.55 24.6,0.8 C28.6,0.08 32.7,0.08 36.8,0.9 C40.8,1.68 45,1.55 49.1,0.8 C53.1,0.08 57.2,0.08 61.3,0.9 C65.4,1.68 69.5,1.55 73.6,0.8 C77.6,0.08 81.8,0.08 85.9,0.9 C90,1.68 94.1,1.55 98.2,0.85 L100,0.82 L100,2.5 L98.2,2.75 C94.1,3.45 90,3.62 85.9,2.95 C81.8,2.25 77.6,2.3 73.6,2.98 C69.5,3.68 65.4,3.62 61.3,2.95 C57.2,2.25 53.1,2.3 49.1,2.98 C45,3.68 40.8,3.62 36.8,2.95 C32.7,2.25 28.6,2.3 24.6,2.98 C20.5,3.68 16.4,3.62 12.4,2.95 C8.3,2.25 4.2,2.35 0,3 Z"
          fill="#78cd46"
          opacity={0.82}
        />
        <Rect x="0" y="0.05" width={PLATFORM_FACE_VB_W} height={0.92} fill="#e6ffab" opacity={0.8} />
        <Path
          d="M0,1.15 L6.3,0.45 L12.8,1.25 L19.2,0.55 L25.8,1.35 L32.3,0.6 L38.8,1.4 L45.5,0.65 L52.2,1.45 L58.7,0.7 L65.4,1.5 L72,0.75 L78.8,1.55 L85.3,0.8 L92.2,1.65 L100,0.95 L100,2.3 L92.1,2.95 L85.2,2.1 L78.7,2.85 L72,2 L65.3,2.85 L58.6,2 L52.1,2.8 L45.4,1.95 L38.7,2.75 L32.2,1.9 L25.7,2.7 L19.1,1.85 L12.7,2.6 L6.2,1.8 L0,2.5 Z"
          fill="#68ba37"
          opacity={0.78}
        />
        <Path
          d="M0,3.55 L4.5,2.9 L9.2,3.72 L13.8,3 L18.3,3.8 L23,3.05 L27.6,3.9 L32.3,3.08 L37.1,3.98 L41.8,3.15 L46.6,4.02 L51.2,3.2 L56,4.05 L60.6,3.2 L65.4,4.08 L70.2,3.2 L75,4.12 L79.8,3.22 L84.7,4.08 L89.4,3.2 L94.5,3.98 L100,3.28 L100,5.18 L94.4,5.66 L89.3,4.9 L84.6,5.76 L79.7,4.96 L74.9,5.8 L70.1,5 L65.3,5.86 L60.5,5 L55.9,5.85 L51.1,5 L46.5,5.79 L41.7,4.98 L37,5.74 L32.2,4.9 L27.5,5.72 L22.9,4.9 L18.2,5.66 L13.7,4.88 L9.1,5.56 L4.4,4.82 L0,5.46 Z"
          fill="#4d972b"
          opacity={0.92}
        />
        <Rect x="0" y="4.2" width={PLATFORM_FACE_VB_W} height={0.64} fill="#1f4a15" opacity={0.95} />
        <Path d="M0,4.92 L8.5,4.25 L16.6,4.95 L24.9,4.2 L33.1,4.95 L41.4,4.2 L49.8,5.05 L58,4.2 L66.3,5.05 L74.8,4.2 L83.1,5.1 L91.4,4.25 L100,4.9" stroke="#16380f" strokeWidth={0.3} opacity={0.74} />
        <Path d="M0,1.95 L6.9,1.3 L13.8,2.05 L20.7,1.4 L27.6,2.15 L34.5,1.45 L41.4,2.2 L48.3,1.5 L55.2,2.25 L62.1,1.5 L69,2.28 L75.9,1.55 L82.8,2.3 L89.7,1.6 L96.6,2.25" stroke="#8ee247" strokeWidth={0.24} opacity={0.62} />
        <Path d="M1,2.7 L8,2.05 L15,2.8 L22,2.1 L29,2.85 L36,2.15 L43,2.9 L50,2.2 L57,2.95 L64,2.25 L71,2.98 L78,2.3 L85,3 L92,2.35 L99,3.05" stroke="#2f6f1b" strokeWidth={0.22} opacity={0.58} />

        {PLATFORM_FACE_GRASS_TUFTS.map((cx, i) => {
          const h = i % 3 === 0 ? 2.5 : i % 2 === 0 ? 2 : 1.65
          return <Rect key={`tuft-${i}`} x={cx - 0.26} y={0.18 - h * 0.62} width={0.52} height={h + 0.42} rx={0.12} fill="#3f8425" opacity={0.88} />
        })}
        {PLATFORM_FACE_BLADE_XS.map((cx, i) => (
          <Rect
            key={`blade-${i}`}
            x={cx - 0.46}
            y={PLATFORM_FACE_GRASS_H - 1.55}
            width={0.92}
            height={1.75}
            rx={0.2}
            fill="#2f6b23"
            opacity={0.58}
          />
        ))}

        <Path d="M7.8 5.95 C9.2 6.75, 10.2 7.85, 10.7 9.25 C11.1 10.45, 11.4 11.45, 12.7 12.45" stroke="#3f2514" strokeWidth={0.5} strokeLinecap="round" />
        <Path d="M14.4 5.85 C13.1 6.75, 12.3 7.95, 12 9.45 C11.6 10.7, 11.1 11.7, 9.9 12.45" stroke="#3f2514" strokeWidth={0.42} strokeLinecap="round" />
        <Path d="M28.6 5.8 C30.2 6.65, 31.8 7.65, 32.7 9.15 C33.4 10.45, 33.6 11.35, 35.3 12.7" stroke="#3f2514" strokeWidth={0.5} strokeLinecap="round" />
        <Path d="M45.9 5.95 C47.6 6.95, 48.6 8.25, 49.1 9.95 C49.5 11.2, 50.3 12.05, 52.1 13" stroke="#3f2514" strokeWidth={0.5} strokeLinecap="round" />
        <Path d="M61 5.75 C59.7 6.75, 58.7 8.05, 58.2 9.75 C57.8 11.1, 56.8 12, 55.1 13" stroke="#3f2514" strokeWidth={0.48} strokeLinecap="round" />
        <Path d="M73.9 5.85 C75.7 6.95, 77 8.1, 77.8 9.85 C78.4 11.1, 79.8 12.05, 81.7 12.95" stroke="#3f2514" strokeWidth={0.48} strokeLinecap="round" />
        <Path d="M87 6 C85.6 7, 84.4 8.2, 84 9.85 C83.6 11.15, 82.7 12.05, 81.1 12.95" stroke="#3f2514" strokeWidth={0.44} strokeLinecap="round" />

        <Path d="M30.7 8.7 C29.8 9.3, 29.2 10.2, 28.8 11.2" stroke="#ba8f60" strokeWidth={0.22} strokeLinecap="round" opacity={0.5} />
        <Path d="M49.1 9.1 C48.2 9.8, 47.5 10.7, 47.1 11.8" stroke="#ba8f60" strokeWidth={0.22} strokeLinecap="round" opacity={0.45} />
        <Path d="M76.9 9 C76.1 9.8, 75.3 10.6, 75 11.6" stroke="#ba8f60" strokeWidth={0.22} strokeLinecap="round" opacity={0.45} />

        {PLATFORM_FACE_GRASS_STONES.map((s, i) => (
          <G key={`stone-${i}`}>
            <Ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill="#78604a" opacity={s.o + 0.08} />
            <Ellipse cx={s.x - s.rx * 0.25} cy={s.y - s.ry * 0.25} rx={Math.max(0.25, s.rx * 0.35)} ry={Math.max(0.2, s.ry * 0.35)} fill="#b39a82" opacity={0.25} />
          </G>
        ))}
      </>
    )
  }
  return getSandStylePlatformFace(surface)
}

/** Pixel-style grass / mycelium cap + jagged dirt; palette from biome surface. */
const BiomePlatformFace = memo(function BiomePlatformFace({
  width,
  height,
  surface,
  faceSeed = 0,
}: {
  width: number
  height: number
  surface: PlatformSurfaceKind
  faceSeed?: number
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${PLATFORM_FACE_VB_W} ${PLATFORM_FACE_VB_H}`}
      preserveAspectRatio="none"
    >
      {renderPlatformFaceShapes(surface, faceSeed)}
    </Svg>
  )
})

type GrasslandPlatformKind = 'normal' | 'moving' | 'breakable'

/** Two clipped halves + center void so it reads as “cracked”; halves sit slightly lower (fixed) until gameplay drops the tile. */
const BreakableSplitPlatformFace = memo(function BreakableSplitPlatformFace({
  width,
  height,
  surface,
  faceSeed = 0,
}: {
  width: number
  height: number
  surface: PlatformSurfaceKind
  faceSeed?: number
}) {
  const gap = Math.max(6, Math.min(11, width * 0.095))
  const halfW = width / 2 - gap / 2
  const crackW = gap + 9
  const crackLeft = width / 2 - crackW / 2
  return (
    <View style={wjWorldStyles.platformGraphicWrap} pointerEvents="none">
      <View
        style={[
          wjWorldStyles.breakableHalfClip,
          {
            left: 0,
            top: 4.5,
            width: halfW,
            height,
          },
        ]}
      >
        <BiomePlatformFace width={width} height={height} surface={surface} faceSeed={faceSeed} />
      </View>
      <View
        style={[
          wjWorldStyles.breakableHalfClip,
          {
            left: width / 2 + gap / 2,
            top: 7.5,
            width: halfW,
            height,
          },
        ]}
      >
        <View style={{ marginLeft: -(width / 2 + gap / 2) }}>
          <BiomePlatformFace width={width} height={height} surface={surface} faceSeed={faceSeed} />
        </View>
      </View>
      <Svg
        pointerEvents="none"
        style={[wjWorldStyles.breakableCrackSvg, { left: crackLeft, top: 0, width: crackW, height }]}
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
  faceSeed = 0,
}: {
  width: number
  height: number
  kind: GrasslandPlatformKind
  surface: PlatformSurfaceKind
  faceSeed?: number
}) {
  if (kind === 'breakable') {
    return <BreakableSplitPlatformFace width={width} height={height} surface={surface} faceSeed={faceSeed} />
  }
  return (
    <View style={wjWorldStyles.platformGraphicWrap} pointerEvents="none">
      <BiomePlatformFace width={width} height={height} surface={surface} faceSeed={faceSeed} />
      {kind === 'moving' ? <View style={wjWorldStyles.platformTintMoving} /> : null}
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

const MUSHROOM_SINGLE_VB_W = 14
const MUSHROOM_SINGLE_VB_H = 18
const MUSHROOM_GROUP_VB_W = 30
const MUSHROOM_GROUP_VB_H = 20
const MUSHROOM_SINGLE_PX_W = 17
const MUSHROOM_SINGLE_PX_H = 21
const MUSHROOM_GROUP_PX_W = 30
const MUSHROOM_GROUP_PX_H = 22

/** Mushroom prop paths in a 14×18 viewBox; caller wraps in <Svg> or <G transform>. */
function renderMushroomSingleShapes() {
  return (
    <>
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
    </>
  )
}

/** Mushroom-group paths in a 30×20 viewBox; caller wraps in <Svg> or <G transform>. */
function renderMushroomGroupShapes() {
  return (
    <>
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
    </>
  )
}

/** Tiny vector fly-agaric props (no raster assets). */
const DecoMushroomSingleSvg = memo(function DecoMushroomSingleSvg() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${MUSHROOM_SINGLE_VB_W} ${MUSHROOM_SINGLE_VB_H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {renderMushroomSingleShapes()}
    </Svg>
  )
})

const DecoMushroomGroupSvg = memo(function DecoMushroomGroupSvg() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${MUSHROOM_GROUP_VB_W} ${MUSHROOM_GROUP_VB_H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {renderMushroomGroupShapes()}
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

const FLOWER_VB_W = 16
const FLOWER_VB_H = 22
const FLOWER_PX_W = 16
const FLOWER_PX_H = 22

/** Pixel-art flower paths in a 16×22 viewBox; caller wraps in <Svg> or <G transform>. */
function renderFlowerShapes(kind: PlatformFlowerDecoKind) {
  const p = FLOWER_PALETTES[kind]
  return (
    <>
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
    </>
  )
}

const DecoFlowerSvg = memo(function DecoFlowerSvg({ kind }: { kind: PlatformFlowerDecoKind }) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${FLOWER_VB_W} ${FLOWER_VB_H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {renderFlowerShapes(kind)}
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
        const w = FLOWER_PX_W
        const h = FLOWER_PX_H
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

/**
 * Vertical overhang (in px) reserved above the platform shell for decoration
 * inside the merged Svg. Large enough to fit the tallest deco (22px flowers)
 * plus a small bottom overlap where props sit into the grass cap.
 */
const MERGED_DECO_OVERHANG = 24

/**
 * Single Svg covering the platform face + top-of-platform decorations
 * (flowers, mushrooms). Replaces the per-deco `View` + `Svg` pairs for
 * non-breakable platforms so each row contributes just one vector root.
 *
 * Coordinate system: pixels. The Svg has a `viewBox` matching its rendered
 * size and `preserveAspectRatio="none"`, so inner `<G transform>` translates
 * map 1:1 to platform-local pixels. The dirt face is drawn in its original
 * 100×14 space via `scale(width/100, height/14)` — visually identical to
 * the original stretched `BiomePlatformFace`.
 */
const MergedPlatformFace = memo(function MergedPlatformFace({
  width,
  height,
  surface,
  faceSeed = 0,
  topFlowers,
  topMushrooms,
}: {
  width: number
  height: number
  surface: PlatformSurfaceKind
  faceSeed?: number
  topFlowers?: PlatformTopFlower[]
  topMushrooms?: PlatformTopMushroom[]
}) {
  const svgW = width
  const svgH = MERGED_DECO_OVERHANG + height
  const faceTransform = `translate(0, ${MERGED_DECO_OVERHANG}) scale(${width / PLATFORM_FACE_VB_W}, ${height / PLATFORM_FACE_VB_H})`
  const faceShapes = useMemo(() => renderPlatformFaceShapes(surface, faceSeed), [surface, faceSeed])
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: -MERGED_DECO_OVERHANG, width: svgW, height: svgH }}
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="none"
    >
      <G transform={faceTransform}>{faceShapes}</G>
      {topMushrooms?.map((m, i) => {
        const vbW = m.kind === 'single' ? MUSHROOM_SINGLE_VB_W : MUSHROOM_GROUP_VB_W
        const vbH = m.kind === 'single' ? MUSHROOM_SINGLE_VB_H : MUSHROOM_GROUP_VB_H
        const pxW = m.kind === 'single' ? MUSHROOM_SINGLE_PX_W : MUSHROOM_GROUP_PX_W
        const pxH = m.kind === 'single' ? MUSHROOM_SINGLE_PX_H : MUSHROOM_GROUP_PX_H
        // Mirror the original `xMidYMax meet` placement: uniform scale, centered
        // horizontally on offsetX, bottom-anchored 5px into the grass cap.
        const s = Math.min(pxW / vbW, pxH / vbH)
        const contentW = vbW * s
        const contentH = vbH * s
        const tx = m.offsetX - contentW / 2
        const ty = MERGED_DECO_OVERHANG + 5 - contentH
        return (
          <G key={`m-${i}`} transform={`translate(${tx}, ${ty}) scale(${s})`}>
            {m.kind === 'single' ? renderMushroomSingleShapes() : renderMushroomGroupShapes()}
          </G>
        )
      })}
      {topFlowers?.map((f, i) => {
        // Flowers use exact 16×22 viewBox = 16×22 pixel footprint, so scale = 1.
        const tx = f.offsetX - FLOWER_PX_W / 2
        const ty = MERGED_DECO_OVERHANG + 5 + f.offsetY - FLOWER_PX_H
        return (
          <G key={`f-${i}`} transform={`translate(${tx}, ${ty})`}>
            {renderFlowerShapes(f.kind)}
          </G>
        )
      })}
    </Svg>
  )
})

const JumpPlatformRow = memo(function JumpPlatformRow({
  left,
  top,
  width,
  shellHeight,
  graphicKind,
  surface,
  faceSeed,
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
  faceSeed: number
  isBouncy: boolean
  isFalling: boolean
  topMushrooms?: PlatformTopMushroom[]
  topPalmTree?: PlatformTopPalmTree
  topFlowers?: PlatformTopFlower[]
}) {
  const isBreakable = graphicKind === 'breakable'
  return (
    <View
      style={[
        wjWorldStyles.platformShell,
        isFalling ? wjWorldStyles.platformFalling : null,
        { left, top, width, height: shellHeight },
      ]}
      collapsable={false}
    >
      {isBreakable ? (
        <>
          <GrasslandPlatformGraphic
            width={width}
            height={shellHeight}
            kind={graphicKind}
            surface={surface}
            faceSeed={faceSeed}
          />
          {topMushrooms?.length ? <PlatformTopMushroomsLayer mushrooms={topMushrooms} /> : null}
          {topFlowers?.length ? <PlatformTopFlowersLayer flowers={topFlowers} /> : null}
        </>
      ) : (
        <>
          <MergedPlatformFace
            width={width}
            height={shellHeight}
            surface={surface}
            faceSeed={faceSeed}
            topFlowers={topFlowers}
            topMushrooms={topMushrooms}
          />
          {graphicKind === 'moving' ? <View style={wjWorldStyles.platformTintMoving} /> : null}
        </>
      )}
      {topPalmTree ? (
        <Image
          source={PALM_TREE_IMAGE}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: topPalmTree.offsetX - PALM_TREE_W / 2,
            top: -PALM_TREE_H + PALM_TREE_BASE_Y + topPalmTree.offsetY,
            width: PALM_TREE_W,
            height: PALM_TREE_H,
          }}
        />
      ) : null}
      {isBouncy ? <DoodleSpringPad platformWidth={width} /> : null}
    </View>
  )
})

/** Gift art uses shared `giftboxSvgAsset` (same cache as `GiftboxAnimationPreview` / tropical dock). */
const WonderJumpGiftboxFromAsset = memo(function WonderJumpGiftboxFromAsset({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const uri = useMemo(() => giftboxSvgAssetUri(), [])
  const [xml, setXml] = useState<string | null>(() => peekGiftboxSvgXml())
  useEffect(() => {
    if (xml) return
    let cancelled = false
    void ensureGiftboxSvgXml()
      .then((s) => {
        if (!cancelled) setXml(s)
      })
      .catch(() => {
        if (!cancelled) setXml(null)
      })
    return () => {
      cancelled = true
    }
  }, [xml])
  if (xml) {
    return <SvgXml xml={xml} width={width} height={height} pointerEvents="none" preserveAspectRatio="xMidYMid meet" />
  }
  if (uri) {
    return <SvgUri uri={uri} width={width} height={height} pointerEvents="none" preserveAspectRatio="xMidYMid meet" />
  }
  return <View style={{ width, height }} pointerEvents="none" />
})

/** Gift art in-world / modal (square slot). */
const WJ_DOCK_GIFT_BOX_PX = 58
/** Hub dock: Daily Rewards stage is 236px; scale to fit `wjChestDockTile`. */
const WJ_DOCK_GIFT_STAGE_PX = 82

const JP_EQUIPPED_FLAME_GRAD_ID = 'wjEquippedJetpackFlameGrad'
const JP_EQUIPPED_FLAME_CORE_ID = 'wjEquippedJetpackFlameCore'

const WonderJumpJetpackFromAsset = memo(function WonderJumpJetpackFromAsset({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const uri = useMemo(() => jetpackSvgAssetUri(), [])
  const [xml, setXml] = useState<string | null>(() => peekJetpackSvgXml())
  useEffect(() => {
    if (xml) return
    let cancelled = false
    void ensureJetpackSvgXml()
      .then((s) => {
        if (!cancelled) setXml(s)
      })
      .catch(() => {
        if (!cancelled) setXml(null)
      })
    return () => {
      cancelled = true
    }
  }, [xml])
  if (xml) {
    return <SvgXml xml={xml} width={width} height={height} pointerEvents="none" preserveAspectRatio="xMidYMid meet" />
  }
  if (uri) {
    return <SvgUri uri={uri} width={width} height={height} pointerEvents="none" preserveAspectRatio="xMidYMid meet" />
  }
  return <View style={{ width, height }} pointerEvents="none" />
})

const WonderJumpJetpackGraphic = memo(function WonderJumpJetpackGraphic({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return <WonderJumpJetpackFromAsset width={width} height={height} />
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
  const renderWidth = width * 1.56
  const renderHeight = height * 1.56
  const renderLeft = left - (renderWidth - width) * 0.5
  const renderTop = top - (renderHeight - height) * 0.56
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: renderLeft, top: renderTop, width: renderWidth, height: renderHeight }}>
      <WonderJumpJetpackGraphic width={renderWidth} height={renderHeight} />
    </View>
  )
})

const WonderJumpChestPickupView = memo(function WonderJumpChestPickupView({
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
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height, zIndex: 2 }}>
      <WonderJumpGiftboxFromAsset width={width} height={height} />
    </View>
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

function playerJetpackFxPropsEqual(
  prev: { left: number; top: number; frame: number; active: boolean },
  next: { left: number; top: number; frame: number; active: boolean },
): boolean {
  if (!prev.active && !next.active) return true
  if (prev.active !== next.active) return false
  return prev.left === next.left && prev.top === next.top && (prev.frame >> 1) === (next.frame >> 1)
}

const PlayerJetpackFx = memo(function PlayerJetpackFx({
  left,
  top,
  frame,
  active,
}: {
  left: number
  top: number
  frame: number
  active: boolean
}) {
  const animFrame = frame >> 1
  const t = animFrame * 0.72
  const pulse = (Math.sin(t) + 1) * 0.5
  const pulseAlt = (Math.sin(t + 1.2) + 1) * 0.5
  const violence = (Math.sin(t * 1.9) + 1) * 0.5
  const violenceAlt = (Math.sin(t * 2.15 + 1.7) + 1) * 0.5
  const smokeDrift = Math.sin(t * 1.4) * 3.2
  const flameL = 48 + pulse * 28 + violence * 14
  const flameR = 48 + pulseAlt * 28 + violenceAlt * 14
  const leftJitter = Math.sin(t * 2.7) * 0.75
  const rightJitter = Math.sin(t * 2.5 + 1.1) * 0.75
  const leftFlameX = EQUIPPED_JETPACK_LEFT_NOZZLE_X + leftJitter
  const rightFlameX = EQUIPPED_JETPACK_RIGHT_NOZZLE_X + rightJitter
  const leftFlameTip = flameL + 34
  const rightFlameTip = flameR + 34
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: 52,
        height: 82,
        opacity: active ? 1 : 0,
      }}
      collapsable={false}
    >
      <Svg
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: EQUIPPED_JETPACK_FLAME_TOP, width: 52, height: 128 }}
        width={52}
        height={128}
        viewBox="0 0 52 128"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={JP_EQUIPPED_FLAME_GRAD_ID} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#fff7d4" />
            <Stop offset="42%" stopColor="#ffb13a" />
            <Stop offset="100%" stopColor="#d33b10" />
          </LinearGradient>
          <LinearGradient id={JP_EQUIPPED_FLAME_CORE_ID} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#ffffff" />
            <Stop offset="60%" stopColor="#ffe08f" />
            <Stop offset="100%" stopColor="#ff8f2e" />
          </LinearGradient>
        </Defs>
        {active ? (
          <>
            <Ellipse cx={leftFlameX} cy={5 + pulse * 3} rx={6.2} ry={9.6} fill="#ff7f2a" opacity={0.28 + pulse * 0.18} />
            <Ellipse cx={rightFlameX} cy={5 + pulseAlt * 3} rx={6.2} ry={9.6} fill="#ff7f2a" opacity={0.28 + pulseAlt * 0.18} />
            <Ellipse
              cx={EQUIPPED_JETPACK_LEFT_NOZZLE_X + smokeDrift * 0.45}
              cy={1 + pulse * 1.2}
              rx={4.4 + pulse * 0.8}
              ry={2.5 + pulse * 0.7}
              fill="#59616a"
              opacity={0.18}
            />
            <Ellipse
              cx={EQUIPPED_JETPACK_RIGHT_NOZZLE_X - smokeDrift * 0.45}
              cy={1 + pulseAlt * 1.2}
              rx={4.4 + pulseAlt * 0.8}
              ry={2.5 + pulseAlt * 0.7}
              fill="#59616a"
              opacity={0.18}
            />
            <Polygon
              points={`${leftFlameX - 2.7},0 ${leftFlameX - 5.8},10 ${leftFlameX - 3.4},18 ${leftFlameX - 8.6},31 ${leftFlameX - 4.8},43 ${leftFlameX - 9.6},58 ${leftFlameX - 5.2},${leftFlameTip - 16} ${leftFlameX},${leftFlameTip} ${leftFlameX + 5.2},${leftFlameTip - 16} ${leftFlameX + 9.6},58 ${leftFlameX + 4.8},43 ${leftFlameX + 8.6},31 ${leftFlameX + 3.4},18 ${leftFlameX + 5.8},10 ${leftFlameX + 2.7},0`}
              fill={`url(#${JP_EQUIPPED_FLAME_GRAD_ID})`}
            />
            <Polygon
              points={`${leftFlameX - 1.2},2 ${leftFlameX - 3.2},13 ${leftFlameX - 1.8},22 ${leftFlameX - 4.4},35 ${leftFlameX - 2.3},47 ${leftFlameX - 4.8},60 ${leftFlameX - 2},${leftFlameTip - 20} ${leftFlameX},${leftFlameTip - 10} ${leftFlameX + 2},${leftFlameTip - 20} ${leftFlameX + 4.8},60 ${leftFlameX + 2.3},47 ${leftFlameX + 4.4},35 ${leftFlameX + 1.8},22 ${leftFlameX + 3.2},13 ${leftFlameX + 1.2},2`}
              fill={`url(#${JP_EQUIPPED_FLAME_CORE_ID})`}
              opacity={0.94}
            />
            <Polygon
              points={`${rightFlameX - 2.7},0 ${rightFlameX - 5.8},10 ${rightFlameX - 3.4},18 ${rightFlameX - 8.6},31 ${rightFlameX - 4.8},43 ${rightFlameX - 9.6},58 ${rightFlameX - 5.2},${rightFlameTip - 16} ${rightFlameX},${rightFlameTip} ${rightFlameX + 5.2},${rightFlameTip - 16} ${rightFlameX + 9.6},58 ${rightFlameX + 4.8},43 ${rightFlameX + 8.6},31 ${rightFlameX + 3.4},18 ${rightFlameX + 5.8},10 ${rightFlameX + 2.7},0`}
              fill={`url(#${JP_EQUIPPED_FLAME_GRAD_ID})`}
            />
            <Polygon
              points={`${rightFlameX - 1.2},2 ${rightFlameX - 3.2},13 ${rightFlameX - 1.8},22 ${rightFlameX - 4.4},35 ${rightFlameX - 2.3},47 ${rightFlameX - 4.8},60 ${rightFlameX - 2},${rightFlameTip - 20} ${rightFlameX},${rightFlameTip - 10} ${rightFlameX + 2},${rightFlameTip - 20} ${rightFlameX + 4.8},60 ${rightFlameX + 2.3},47 ${rightFlameX + 4.4},35 ${rightFlameX + 1.8},22 ${rightFlameX + 3.2},13 ${rightFlameX + 1.2},2`}
              fill={`url(#${JP_EQUIPPED_FLAME_CORE_ID})`}
              opacity={0.94}
            />
          </>
        ) : null}
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: EQUIPPED_JETPACK_VISUAL_LEFT,
          top: EQUIPPED_JETPACK_VISUAL_TOP,
          width: EQUIPPED_JETPACK_VISUAL_W,
          height: EQUIPPED_JETPACK_VISUAL_H,
        }}
      >
        <WonderJumpJetpackGraphic width={EQUIPPED_JETPACK_VISUAL_W} height={EQUIPPED_JETPACK_VISUAL_H} />
      </View>
    </View>
  )
}, playerJetpackFxPropsEqual)

const WonderJumpPlayerStack = memo(function WonderJumpPlayerStack({
  characterStyle,
  playerX,
  playerY,
  playerWidth,
  playerHeight,
  jetpackFuelMs,
  jetpackAnimTick,
  jetpackFxLatched,
}: {
  characterStyle: WonderJumpCharacterStyle
  playerX: number
  playerY: number
  playerWidth: number
  playerHeight: number
  jetpackFuelMs: number
  jetpackAnimTick: number
  jetpackFxLatched: boolean
}) {
  const jetpackActive = jetpackFuelMs > 0
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {characterStyle === 'classic' ? (
        <View
          style={[
            wjWorldStyles.playerShadow,
            {
              left: playerX + 2,
              top: playerY + playerHeight - 3,
            },
          ]}
        />
      ) : null}
      <WonderJumpPlayerVisual
        characterStyle={characterStyle}
        left={playerX}
        top={playerY}
        width={playerWidth}
        height={playerHeight}
      />
      {jetpackFxLatched ? (
        <PlayerJetpackFx
          left={playerX + EQUIPPED_JETPACK_CENTER_OFFSET_X}
          top={playerY + EQUIPPED_JETPACK_TOP_OFFSET_Y}
          frame={jetpackAnimTick}
          active={jetpackActive}
        />
      ) : null}
    </View>
  )
})

const GrasslandCloud = memo(function GrasslandCloud({ left, top, width }: { left: number; top: number; width: number }) {
  const h = 40
  return (
    <View style={[wjWorldStyles.cloudRoot, { left, top, width, height: h }]} pointerEvents="none">
      <View
        style={[
          wjWorldStyles.cloudBlob,
          { width: width * 0.55, height: h * 0.52, left: width * 0.06, top: h * 0.34 },
        ]}
      />
      <View
        style={[
          wjWorldStyles.cloudBlob,
          { width: width * 0.42, height: h * 0.44, left: width * 0.38, top: h * 0.4 },
        ]}
      />
      <View
        style={[
          wjWorldStyles.cloudBlob,
          { width: width * 0.36, height: h * 0.4, left: width * 0.54, top: h * 0.26 },
        ]}
      />
      <View
        style={[
          wjWorldStyles.cloudBlob,
          { width: width * 0.48, height: h * 0.48, left: width * 0.14, top: h * 0.1 },
        ]}
      />
      <View style={[wjWorldStyles.cloudShadowBase, { width: width * 0.72 }]} />
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
            wjWorldStyles.cloudSpeck,
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
            wjWorldStyles.cloudHatch,
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
  spaceBlend,
}: {
  width: number
  height: number
  mushroomBlend: number
  tropicalBlend: number
  spaceBlend: number
}) {
  const gradId = useRef(`wjSky_${Math.random().toString(36).slice(2, 9)}`).current
  const m = clamp(mushroomBlend, 0, 1)
  const t = clamp(tropicalBlend, 0, 1)
  const s = clamp(spaceBlend, 0, 1)
  const tropicalStrong = clamp(t, 0, 1)
  const mushroomStrong = clamp(m * (1 - tropicalStrong * 0.8), 0, 1)
  const priorOpacity = 1 - s
  const grassOpacity = priorOpacity
  const mushroomOverlayOpacity = mushroomStrong * 0.62 * priorOpacity
  const tropicalOverlayOpacity = tropicalStrong * 0.6 * priorOpacity
  const mushroomTop = '#5f507f'
  const mushroomMid = '#74659e'
  const mushroomBottom = '#8b7cb4'
  const tropicalTop = '#328792'
  const tropicalMid = '#3f9ea9'
  const tropicalBottom = '#4eb3bb'
  const galaxyCx = width * 0.72
  const galaxyCy = height * 0.22
  const galaxyR = Math.max(width, height) * 0.42
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        pointerEvents="none"
        source={GRASSLAND_BG_IMAGE}
        resizeMode="cover"
        style={[StyleSheet.absoluteFillObject, { opacity: grassOpacity }]}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={mushroomBottom} stopOpacity={mushroomOverlayOpacity} />
            <Stop offset="0.54" stopColor={mushroomMid} stopOpacity={mushroomOverlayOpacity} />
            <Stop offset="1" stopColor={mushroomTop} stopOpacity={mushroomOverlayOpacity} />
          </LinearGradient>
          <LinearGradient id={`${gradId}_tropical`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={tropicalBottom} stopOpacity={tropicalOverlayOpacity} />
            <Stop offset="0.54" stopColor={tropicalMid} stopOpacity={tropicalOverlayOpacity} />
            <Stop offset="1" stopColor={tropicalTop} stopOpacity={tropicalOverlayOpacity} />
          </LinearGradient>
          <LinearGradient id={`${gradId}_space`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#020208" stopOpacity={s} />
            <Stop offset="1" stopColor="#000000" stopOpacity={s} />
          </LinearGradient>
          <RadialGradient id={`${gradId}_galaxy`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#6b5ce8" stopOpacity={0.22 * s} />
            <Stop offset="45%" stopColor="#3d4a9e" stopOpacity={0.1 * s} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId})`} />
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId}_tropical)`} />
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId}_space)`} />
        <Ellipse cx={galaxyCx} cy={galaxyCy} rx={galaxyR} ry={galaxyR * 0.55} fill={`url(#${gradId}_galaxy)`} />
        {SPACE_STAR_FIELD.map((star, i) => (
          <Circle
            key={`star-${i}`}
            cx={(star.x / 100) * width}
            cy={(star.y / 100) * height}
            r={star.r}
            fill="#ffffff"
            opacity={star.o * s}
          />
        ))}
      </Svg>
    </View>
  )
})

type WonderJumpSceneColors = {
  screenBg: string
  tileBg: string
  sunCore: string
  hillFar: string
  hillNear: string
}

/** Sky + sun + hills: isolated so React can skip the whole block when blend/colors are unchanged between ticks. */
const WonderJumpAmbientDecor = memo(function WonderJumpAmbientDecor({
  playWidth,
  playHeight,
  mushroomBlend,
  tropicalBlend,
  spaceBlend,
}: {
  playWidth: number
  playHeight: number
  mushroomBlend: number
  tropicalBlend: number
  spaceBlend: number
}) {
  return (
    <>
      <WonderSkyBackdrop
        width={playWidth}
        height={playHeight}
        mushroomBlend={mushroomBlend}
        tropicalBlend={tropicalBlend}
        spaceBlend={spaceBlend}
      />
    </>
  )
})

const WonderJumpPlayerVisual = memo(function WonderJumpPlayerVisual({
  characterStyle,
  left,
  top,
  width,
  height,
}: {
  characterStyle: WonderJumpCharacterStyle
  left: number
  top: number
  width: number
  height: number
}) {
  const drawScale = characterStyle === 'classic' ? 1 : 1.42
  const drawWidth = width * drawScale
  const drawHeight = height * drawScale
  const drawLeft = left - (drawWidth - width) / 2
  const drawTop = top - (drawHeight - height) / 2
  return (
    <View style={{ position: 'absolute', left: drawLeft, top: drawTop, width: drawWidth, height: drawHeight }} pointerEvents="none">
      <WonderJumpCharacterSvg variant={characterStyle} width={drawWidth} height={drawHeight} />
    </View>
  )
})

const MENU_START_BIOME: WonderJumpStartBiome = 'grassland'
const DEFAULT_WONDER_JUMP_UNLOCKED: WonderJumpStartBiome[] = ['grassland']

export function WonderJump({
  navigation,
  route,
  sessionToken,
  onUserUpdated,
}: {
  navigation: any
  route: any
  sessionToken?: string
  onUserUpdated?: (user: User) => Promise<void>
}) {
  const isFocused = useIsFocused()
  const { theme: wonderportTheme } = useContext(ThemeContext)
  const styles = useMemo(
    () => ({ ...wjWorldStyles, ...createWonderJumpStyles(wonderportTheme) }),
    [wonderportTheme],
  )
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const fallbackWindow = Dimensions.get('screen')
  const resolvedWidth = windowWidth > 0 ? windowWidth : fallbackWindow.width || 390
  const resolvedHeight = windowHeight > 0 ? windowHeight : fallbackWindow.height || 780

  const playWidth = resolvedWidth
  const tileBottomSpace = Math.max(insets.bottom + 92, 106)
  const playHeight = Math.max(430, resolvedHeight - insets.top - tileBottomSpace)
  const panelTop = Math.max(70, playHeight * 0.24)
  /** Hub / game-over panel: fixed max height + inner scroll so footer actions stay inside the glass card. */
  const hubPanelOuterMaxHeight = useMemo(
    () => Math.min(playHeight * 0.94, playHeight - 12),
    [playHeight]
  )
  const hubPanelOverlayStyle = useMemo(
    () =>
      ({
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 26,
        zIndex: 8,
      }) as const,
    []
  )
  const hubPanelCardStyle = useMemo(
    () => ({
      position: 'relative' as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: '100%' as const,
      maxHeight: hubPanelOuterMaxHeight,
      overflow: 'hidden' as const,
    }),
    [hubPanelOuterMaxHeight]
  )

  const [controlScheme, setControlScheme] = useState<ControlScheme>('touchSplit')
  const [characterStyle, setCharacterStyle] = useState<WonderJumpCharacterStyle>('classic')
  /** Locked when a run starts; ignores store/focus updates until run ends (menu / game over). */
  const [runCharacterLocked, setRunCharacterLocked] = useState<WonderJumpCharacterStyle>('classic')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [leaderboardEntries, setLeaderboardEntries] = useState<WonderJumpLeaderboardEntry[]>([])
  const [leaderboardFetchState, setLeaderboardFetchState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [bestScore, setBestScore] = useState(0)
  /** Server-backed (or default); used when syncing progress and for future biome gating. */
  const [unlockedBiomes, setUnlockedBiomes] = useState<WonderJumpStartBiome[]>([...DEFAULT_WONDER_JUMP_UNLOCKED])
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
      jetpacks: world.jetpacks.map((j) => ({ ...j })),
      chests: world.chests.map((c) => ({ ...c })),
      chestSpawnedThisRun: world.chestSpawnedThisRun,
      crabs: world.crabs.map((c) => ({ ...c })),
      asteroids: world.asteroids.map((a) => ({ ...a })),
      cameraY: 0,
      heightScore: 0,
      lastJetpackY: world.lastJetpackY,
      lastAsteroidSpawnHeight: world.lastAsteroidSpawnHeight,
      jetpackFuelMs: 0,
      jetpackEndGraceMs: 0,
      jetpackAnimTick: 0,
      uiAnimTick: 0,
      flameAnimTick: 0,
      jetpacksUsedThisRun: 0,
      deathCause: null,
      startBiome: biome,
    }
  }
  const [gameState, setGameState] = useState<GameState>(() => createMenuPreviewState(MENU_START_BIOME))
  const panelEntryAnim = useRef(new Animated.Value(0)).current
  const inputRef = useRef<InputState>({
    leftPressed: false,
    rightPressed: false,
  })
  /** Authoritative playing snapshot between React renders (throttled setState while running). */
  const playingSimSnapRef = useRef<GameState | null>(null)
  const prevRunModeForProgressSyncRef = useRef<RunMode>(gameState.mode)
  const sessionTokenRef = useRef<string | undefined>(sessionToken)
  const wonderJumpChestDockedRef = useRef(false)
  const wonderJumpChestUnlocksAtRef = useRef<string | null>(null)
  const [serverChestDocked, setServerChestDocked] = useState(false)
  const [serverChestUnlocksAt, setServerChestUnlocksAt] = useState<string | null>(null)
  const showGiftDock = Boolean(sessionToken && serverChestDocked)
  const hubPanelScrollMaxHeight = useMemo(() => {
    const dockPaddingV = showGiftDock ? 14 + 12 : 0
    return Math.max(200, hubPanelOuterMaxHeight - dockPaddingV)
  }, [hubPanelOuterMaxHeight, showGiftDock])
  const [chestHubTick, setChestHubTick] = useState(0)
  const [chestClaimBusy, setChestClaimBusy] = useState(false)
  const [hubChestRevealPhase, setHubChestRevealPhase] = useState<
    null | 'opening' | 'claiming' | 'success' | 'error'
  >(null)
  const [hubChestRevealError, setHubChestRevealError] = useState('')
  const hubChestGiftPop = useRef(new Animated.Value(0)).current
  const hubChestGiftOpacity = useRef(new Animated.Value(1)).current
  /** Ensures we POST pickup at least once after game over if a collected chest is still in state (RAF safety net). */
  const gameOverChestPickupPostedRef = useRef(false)
  /** After first jetpack use in a run, keep FX mounted (hidden when empty) to avoid equip hitch. */
  const jetpackFxLatchRef = useRef(false)

  useEffect(() => {
    sessionTokenRef.current = sessionToken
  }, [sessionToken])

  useEffect(() => {
    void ensureGiftboxSvgXml().catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadWonderJumpCharacterStyle().then((style) => {
      if (!cancelled) setCharacterStyle(style)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isFocused) return
    if (gameState.mode === 'playing' || gameState.mode === 'paused') return
    void loadWonderJumpCharacterStyle().then(setCharacterStyle)
  }, [isFocused, gameState.mode])

  useEffect(() => {
    void ensureJetpackSvgXml()
  }, [])

  useEffect(() => {
    if (!sessionToken) {
      setUnlockedBiomes([...DEFAULT_WONDER_JUMP_UNLOCKED])
      wonderJumpChestDockedRef.current = false
      wonderJumpChestUnlocksAtRef.current = null
      setServerChestDocked(false)
      setServerChestUnlocksAt(null)
      return
    }
    let cancelled = false
    void fetchWonderJumpProgress(sessionToken)
      .then((p) => {
        if (cancelled) return
        setBestScore((b) => Math.max(b, p.highScore))
        const next = p.unlockedBiomes.filter((x): x is WonderJumpStartBiome =>
          x === 'grassland' || x === 'mushroom' || x === 'tropical' || x === 'space'
        )
        setUnlockedBiomes(next.length > 0 ? next : [...DEFAULT_WONDER_JUMP_UNLOCKED])
        wonderJumpChestDockedRef.current = p.chestDocked === true
        setServerChestDocked(p.chestDocked === true)
        wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
        setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
      })
      .catch(() => {
        /* offline / old server — keep local gameplay */
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken])

  useEffect(() => {
    if (gameState.mode !== 'gameOver') {
      gameOverChestPickupPostedRef.current = false
      return
    }
    if (!sessionToken) return
    if (!(gameState.chests ?? []).some((c) => c.collected)) return
    if (gameOverChestPickupPostedRef.current) return
    gameOverChestPickupPostedRef.current = true
    // Optimistic dock update so hub/main menu shows the gift immediately after death.
    const prevDocked = wonderJumpChestDockedRef.current
    const prevUnlocksAt = wonderJumpChestUnlocksAtRef.current
    wonderJumpChestDockedRef.current = true
    wonderJumpChestUnlocksAtRef.current = null
    setServerChestDocked(true)
    setServerChestUnlocksAt(null)
    void pickupWonderJumpChest(sessionToken)
      .then((p) => {
        wonderJumpChestDockedRef.current = p.chestDocked === true
        setServerChestDocked(p.chestDocked === true)
        wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
        setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
        setGameState((s) => ({
          ...s,
          chests: (s.chests ?? []).filter((ch) => !ch.collected),
        }))
      })
      .catch(() => {
        // Revert optimistic state when pickup could not be persisted.
        wonderJumpChestDockedRef.current = prevDocked
        wonderJumpChestUnlocksAtRef.current = prevUnlocksAt
        setServerChestDocked(prevDocked)
        setServerChestUnlocksAt(prevUnlocksAt)
        gameOverChestPickupPostedRef.current = false
      })
  }, [gameState.mode, sessionToken])

  useEffect(() => {
    const prev = prevRunModeForProgressSyncRef.current
    prevRunModeForProgressSyncRef.current = gameState.mode
    if (prev !== 'playing' || gameState.mode !== 'gameOver' || !sessionToken) return
    const runScore = displayRunScore(gameState.heightScore)
    const fromRun = biomesUnlockedForHeight(gameState.heightScore, gameState.startBiome)
    const merged = Array.from(new Set<WonderJumpStartBiome>([...unlockedBiomes, ...fromRun]))
    const reached = maxBiomeAccent(
      accentBiomeAtHeight(gameState.heightScore, gameState.startBiome),
      accentBiomeFromDisplayScore(runScore)
    )
    void saveWonderJumpProgress(sessionToken, {
      highScore: runScore,
      unlockedBiomes: merged,
      bestBiomeReached: reached,
    })
      .then((p) => {
        setBestScore((b) => Math.max(b, p.highScore))
        const next = p.unlockedBiomes.filter((x): x is WonderJumpStartBiome =>
          x === 'grassland' || x === 'mushroom' || x === 'tropical' || x === 'space'
        )
        if (next.length > 0) setUnlockedBiomes(next)
        wonderJumpChestDockedRef.current = p.chestDocked === true
        setServerChestDocked(p.chestDocked === true)
        wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
        setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
      })
      .catch(() => {})
  }, [gameState.mode, gameState.heightScore, gameState.startBiome, sessionToken, unlockedBiomes])

  /** After a run ends, re-sync chest dock from the server in case pickup finished after the progress save. */
  useEffect(() => {
    if (gameState.mode !== 'gameOver' || !sessionToken) return
    const id = setTimeout(() => {
      void fetchWonderJumpProgress(sessionToken)
        .then((p) => {
          wonderJumpChestDockedRef.current = p.chestDocked === true
          setServerChestDocked(p.chestDocked === true)
          wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
          setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
        })
        .catch(() => {})
    }, 450)
    return () => clearTimeout(id)
  }, [gameState.mode, sessionToken])

  useEffect(() => {
    menuWorldCacheRef.current = {}
    setGameState((prev) => (prev.mode === 'menu' ? createMenuPreviewState(MENU_START_BIOME) : prev))
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
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }
  }, [])

  const tickPlayingState = useCallback((previous: GameState): GameState => {
    if (previous.mode !== 'playing') return previous

        const difficulty = Math.min(1, previous.heightScore / 2200)
        const mushroomBlendTick = getMushroomBlend(previous.heightScore, previous.startBiome)
        const tropicalBlendTick = getTropicalBlend(previous.heightScore, previous.startBiome)
        const spaceBlendTick = getSpaceBlend(previous.heightScore, previous.startBiome)
        const tokenForChest = sessionTokenRef.current
        const allowServerChest =
          Boolean(tokenForChest && tokenForChest.length > 0) &&
          !wonderJumpChestDockedRef.current &&
          wonderJumpChestUnlocksAtRef.current == null
        const speed = BASE_SPEED + difficulty * 1.5
        let platformsArrayRebuilt = false
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

          if (
            x === platform.x &&
            y === platform.y &&
            moveDir === platform.moveDir &&
            breakProgress === platform.breakProgress &&
            isFalling === platform.isFalling &&
            fallingVelocityY === platform.fallingVelocityY
          ) {
            return platform
          }
          platformsArrayRebuilt = true
          return { ...platform, x, y, moveDir, breakProgress, isFalling, fallingVelocityY }
        })
        const stableNextPlatforms = platformsArrayRebuilt ? nextPlatforms : previous.platforms

        const prevById = new Map(previous.platforms.map((p) => [p.id, p]))
        const nextById = new Map(stableNextPlatforms.map((p) => [p.id, p]))

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
          let support: PlatformItem | null = null
          for (const platform of stableNextPlatforms) {
            if (!isSolid(platform)) continue
            const topY = platformTopY(platform)
            const closeToTop = Math.abs(player.y + player.height - topY) <= GROUND_SUPPORT_SLACK_PX
            const overlapX =
              player.x + player.width - 4 >= platform.x &&
              player.x + 4 <= platform.x + platform.width
            if (closeToTop && overlapX) {
              support = platform
              break
            }
          }
          if (!support) {
            player.onGround = false
            player.groundPlatformId = null
            player.groundKind = null
          } else {
            player.groundPlatformId = support.id
            player.groundKind = support.kind
            const snapTop = platformTopY(support)
            player.y = snapTop - player.height
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
            for (const platform of stableNextPlatforms) {
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

        const mutatedPlatforms = crumblePlatformId
          ? stableNextPlatforms.map((platform) => {
              if (platform.id !== crumblePlatformId) return platform
              if (platform.isFalling && platform.fallingVelocityY === 1.4) return platform
              return {
                ...platform,
                isFalling: true,
                fallingVelocityY: 1.4,
              }
            })
          : stableNextPlatforms

        const platformById = crumblePlatformId
          ? new Map(mutatedPlatforms.map((p) => [p.id, p]))
          : nextById

        const currentSpikes = filterUnfairSpikes(
          syncSpikesToPlatforms(
            previous.spikes.filter((spike) => spike.y - previous.cameraY < playHeight + 140),
            mutatedPlatforms
          ),
          mutatedPlatforms
        )

        const currentJetpacks: JetpackPickup[] = []
        for (const jetpack of previous.jetpacks) {
          if (jetpack.collected) continue
          const y = jetpack.y - previous.cameraY
          if (y > -playHeight - 170 && y < playHeight + 220) currentJetpacks.push(jetpack)
        }

        let jetpacksUsedThisRun = previous.jetpacksUsedThisRun
        const resolvedJetpacks = currentJetpacks.map((jetpack) => {
          const hit =
            player.x < jetpack.x + jetpack.width &&
            player.x + player.width > jetpack.x &&
            player.y < jetpack.y + jetpack.height &&
            player.y + player.height > jetpack.y
          if (hit) {
            if (!jetpack.collected) jetpacksUsedThisRun += 1
            jetpackFuelMs = Math.max(jetpackFuelMs, JETPACK_DURATION_MS)
            if (jetpackAnimTick === 0) jetpackAnimTick = 1
            return { ...jetpack, collected: true }
          }
          return jetpack
        })

        const currentChests: ChestPickup[] = []
        for (const chest of previous.chests ?? []) {
          if (chest.collected) continue
          const y = chest.y - previous.cameraY
          if (y > -playHeight - 170 && y < playHeight + 220) currentChests.push(chest)
        }
        const resolvedChests = currentChests.map((chest) => {
          const hit =
            player.x < chest.x + chest.width &&
            player.x + player.width > chest.x &&
            player.y < chest.y + chest.height &&
            player.y + player.height > chest.y
          if (hit) {
            return { ...chest, collected: true }
          }
          return chest
        })

        const hitSpike =
          jetpackFuelMs > 0 || jetpackEndGraceMs > 0
            ? false
            : currentSpikes.some((spike) => playerHitsSpike(player, spike))

        const followThreshold = playHeight * 0.38
        let cameraY = previous.cameraY
        const playerOnScreenY = player.y - cameraY
        if (playerOnScreenY < followThreshold) cameraY = player.y - followThreshold

        let platforms = mutatedPlatforms
        let spikes = [...currentSpikes]
        let jetpacks = [...resolvedJetpacks]
        /** Keep already-collected chests in state so pickup + hub sync survive extra sim ticks in the same frame. */
        let chests = [
          ...resolvedChests,
          ...(previous.chests ?? []).filter((chest) => chest.collected),
        ]
        let chestSpawnedThisRun = previous.chestSpawnedThisRun
        let crabs = [...previous.crabs]
        let asteroids = [...(previous.asteroids ?? [])]
        let lastJetpackY = previous.lastJetpackY
        let lastAsteroidSpawnHeight = previous.lastAsteroidSpawnHeight ?? -MIN_ASTEROID_SPAWN_HEIGHT_SEP
        const hostById = platformById
        const tickMs = SIM_TICK_MS
        asteroids = asteroids.map((asteroid) => ({
          ...asteroid,
          y: asteroid.y + asteroid.velocityY,
        }))
        const heightScoreForSpawn = Math.max(previous.heightScore, Math.floor(-cameraY))
        const asteroidSpawned = trySpawnAsteroid(
          cameraY,
          playWidth,
          heightScoreForSpawn,
          previous.uiAnimTick,
          spaceBlendTick,
          previous.startBiome,
          asteroids.length,
          lastAsteroidSpawnHeight
        )
        if (asteroidSpawned) {
          asteroids.push(asteroidSpawned)
          lastAsteroidSpawnHeight = heightScoreForSpawn
        }
        // Update crabs (walk back/forth on their host platform).
        crabs = crabs
          .map((crab) => {
            if (!crab.alive) {
              return {
                ...crab,
                deathMs: crab.deathMs + tickMs,
              }
            }
            const host = hostById.get(crab.hostPlatformId)
            if (!host) return crab
            if (host.kind === 'moving') {
              return crab
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
            return { ...crab, localX, dir }
          })
          .filter((crab) => crab.alive || crab.deathMs < CRAB_DEATH_MS + 240)
        const countJetpacksAlive = (list: JetpackPickup[]) => {
          let count = 0
          for (const j of list) if (!j.collected) count += 1
          return count
        }
        let chainPlatform = platforms[0]
        for (let pi = 1; pi < platforms.length; pi++) {
          const p = platforms[pi]
          if (p.y < chainPlatform.y) chainPlatform = p
        }
        const chainSpawnState = createChainSpawnState()
        let highestY = chainPlatform.y
        let seed = platforms.length + 1
        let jetpacksAliveSpawn = countJetpacksAlive(jetpacks)
        let platformsOwnCopy = false
        while (highestY > cameraY - playHeight * 2.55) {
          if (!platformsOwnCopy && platforms === previous.platforms) {
            platforms = [...platforms]
            platformsOwnCopy = true
          }
          let gapMin = 42 + difficulty * 8
          let gapMax = 62 + difficulty * 24
          if (spaceBlendTick >= SPACE_GAMEPLAY_BLEND) {
            gapMin += SPACE_CHAIN_GAP_EXTRA_MIN + spaceBlendTick * 2
            gapMax += SPACE_CHAIN_GAP_EXTRA_MAX + spaceBlendTick * 3
          } else if (tropicalBlendTick >= TROPICAL_GAMEPLAY_BLEND) {
            gapMin += 6 + tropicalBlendTick * 6
            gapMax += 10 + tropicalBlendTick * 10
          } else if (isMushroomGameplay(previous.startBiome, mushroomBlendTick, tropicalBlendTick)) {
            gapMin += MUSHROOM_CHAIN_GAP_EXTRA_MIN
            gapMax += MUSHROOM_CHAIN_GAP_EXTRA_MAX
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
            tropicalBlendTick,
            spaceBlendTick,
            chainSpawnState
          )
          platform = enforceChainReachable(chainPlatform, platform, playWidth, difficulty)
          highestY = platform.y
          platforms.push(platform)
          chainPlatform = platform
          const spikeAllowed =
            previous.heightScore >=
            spikeActivationHeight(previous.startBiome, mushroomBlendTick, tropicalBlendTick, spaceBlendTick)
          const forceInterval =
            isMushroomGameplay(previous.startBiome, mushroomBlendTick, tropicalBlendTick) ||
            isSpaceGameplay(previous.startBiome, spaceBlendTick)
              ? 4
              : 11
          const forceSpike = seed % forceInterval === 0
          const newSpikes = spawnSpikes(
            platform,
            spikeAllowed,
            mushroomBlendTick,
            tropicalBlendTick,
            previous.startBiome,
            difficulty,
            forceSpike,
            spaceBlendTick
          )
          spikes.push(...newSpikes)
          platforms[platforms.length - 1] = maybeAttachPalmTree(
            { ...platforms[platforms.length - 1], topPalmTree: undefined },
            platforms,
            tropicalBlendTick,
            newSpikes.length > 0
          )
          chainPlatform = platforms[platforms.length - 1]
          const jetpackAdded = spawnJetpack(
            platform,
            jetpacksAliveSpawn,
            lastJetpackY,
            mushroomBlendTick,
            tropicalBlendTick,
            spaceBlendTick,
            previous.startBiome
          )
          if (jetpackAdded.length) {
            jetpacks.push(...jetpackAdded)
            jetpacksAliveSpawn += jetpackAdded.length
            lastJetpackY = jetpackAdded[0].y
          }
          const chestAdded = trySpawnWonderJumpChest(
            chainPlatform,
            chestSpawnedThisRun,
            tropicalBlendTick,
            spaceBlendTick,
            allowServerChest
          )
          if (chestAdded.length) {
            chests.push(...chestAdded)
            chestSpawnedThisRun = true
          }
          crabs.push(
            ...spawnCrabOnPlatform(
              chainPlatform,
              newSpikes.length > 0,
              tropicalBlendTick,
              spaceBlendTick,
              previous.startBiome,
              seed
            )
          )
          const sibling = trySpawnSiblingPlatform(
            highestY,
            seed + 60000,
            playWidth,
            difficulty,
            platforms,
            mushroomBlendTick,
            tropicalBlendTick,
            spaceBlendTick
          )
          if (sibling) {
            platforms.push(sibling)
            const sSpikes = spawnSpikes(
              sibling,
              spikeAllowed,
              mushroomBlendTick,
              tropicalBlendTick,
              previous.startBiome,
              difficulty,
              false,
              spaceBlendTick
            )
            spikes.push(...sSpikes)
            platforms[platforms.length - 1] = maybeAttachPalmTree(
              { ...platforms[platforms.length - 1], topPalmTree: undefined },
              platforms,
              tropicalBlendTick,
              sSpikes.length > 0
            )
            crabs.push(
              ...spawnCrabOnPlatform(
                platforms[platforms.length - 1],
                sSpikes.length > 0,
                tropicalBlendTick,
                spaceBlendTick,
                previous.startBiome,
                seed + 60000
              )
            )
            const jetpackSibling = spawnJetpack(
              sibling,
              jetpacksAliveSpawn,
              lastJetpackY,
              mushroomBlendTick,
              tropicalBlendTick,
              spaceBlendTick,
              previous.startBiome
            )
            if (jetpackSibling.length) {
              jetpacks.push(...jetpackSibling)
              jetpacksAliveSpawn += jetpackSibling.length
              lastJetpackY = jetpackSibling[0].y
            }
          }
          seed += 1
        }

        platforms = platforms.filter((platform) => {
          const screenY = platform.y - cameraY
          return screenY > -220 && screenY < playHeight + 220
        })
        const livePlatformById = new Map(platforms.map((p) => [p.id, p]))
        spikes = syncSpikesToPlatforms(spikes, platforms)
        spikes = filterUnfairSpikes(spikes, platforms)
        spikes = spikes.filter((spike) => {
          if (!livePlatformById.has(spike.id.replace('spike-', ''))) return false
          const screenY = spike.y - cameraY
          /*
           * Keep spikes much farther above camera than visible bounds.
           * If we cull them at -80, newly generated hazards are deleted before they ever scroll into view.
           */
          return screenY > -playHeight - 140 && screenY < playHeight + 180
        })
        crabs = crabs.filter((crab) => {
          const host = livePlatformById.get(crab.hostPlatformId)
          if (!host) return false
          const y = host.y - cameraY
          return y > -playHeight - 180 && y < playHeight + 280
        })
        asteroids = asteroids.filter((asteroid) => {
          const plumeReach = getMeteorPlumeReach(asteroid.height, asteroid.variant)
          const topScreenY = asteroid.y - plumeReach - cameraY
          const bottomScreenY = asteroid.y + asteroid.height - cameraY
          return bottomScreenY > -playHeight - 140 && topScreenY < playHeight + 220
        })
        jetpacks = jetpacks.filter((jetpack) => {
          if (jetpack.collected) return false
          const screenY = jetpack.y - cameraY
          return screenY > -playHeight - 170 && screenY < playHeight + 250
        })
        chests = chests.filter((chest) => {
          if (chest.collected) return true
          const screenY = chest.y - cameraY
          return screenY > -playHeight - 170 && screenY < playHeight + 250
        })

        // Crab collisions + stomps (stomp works with jetpack; touch damage only without jetpack).
        let touchedCrab = false
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
            // Tiny bounce on kill.
            player.velocityY = Math.min(player.velocityY, -6.4)
            crab.alive = false
            crab.deathMs = 0
          } else if (overlaps && jetpackFuelMs <= 0) {
            touchedCrab = true
          }
        }

        let touchedAsteroid = false
        for (const asteroid of asteroids) {
          if (playerHitsAsteroid(player, asteroid) && jetpackFuelMs <= 0) {
            touchedAsteroid = true
            break
          }
        }

        const heightScore = Math.max(previous.heightScore, Math.floor(-cameraY))
        const fallenOut = player.y - cameraY > playHeight + 120
        const shouldEnd = fallenOut || hitSpike || touchedCrab || touchedAsteroid

        platforms = reuseShallowArray(platforms, previous.platforms)
        spikes = reuseShallowArray(spikes, previous.spikes)
        jetpacks = reuseShallowArray(jetpacks, previous.jetpacks)
        crabs = reuseShallowArray(crabs, previous.crabs)
        asteroids = reuseShallowArray(asteroids, previous.asteroids ?? [])

        if (shouldEnd) {
          const deathCause: WonderJumpDeathCause = fallenOut
            ? 'fall'
            : hitSpike
              ? 'spike'
              : touchedAsteroid
                ? 'asteroid'
                : 'crab'
          return {
            ...previous,
            mode: 'gameOver',
            player,
            platforms,
            spikes,
            jetpacks,
            chests,
            chestSpawnedThisRun,
            crabs,
            asteroids,
            cameraY,
            heightScore,
            lastJetpackY,
            lastAsteroidSpawnHeight,
            jetpackFuelMs,
            jetpackEndGraceMs,
            jetpackAnimTick,
            uiAnimTick,
            flameAnimTick: previous.flameAnimTick,
            jetpacksUsedThisRun,
            deathCause,
            startBiome: previous.startBiome,
          }
        }

        return {
          mode: 'playing',
          player,
          platforms,
          spikes,
          jetpacks,
          chests,
          chestSpawnedThisRun,
          crabs,
          asteroids,
          cameraY,
          heightScore,
          lastJetpackY,
          lastAsteroidSpawnHeight,
          jetpackFuelMs,
          jetpackEndGraceMs,
          jetpackAnimTick,
          uiAnimTick,
          flameAnimTick: previous.flameAnimTick,
          jetpacksUsedThisRun,
          deathCause: null,
          startBiome: previous.startBiome,
        }
  }, [playWidth, playHeight])

  useEffect(() => {
    if (gameState.mode !== 'playing' || !isFocused) return
    if (playingSimSnapRef.current?.mode !== 'playing') {
      playingSimSnapRef.current = gameState
    }

    let rafId = 0
    const timeNow = () => globalThis.performance?.now?.() ?? Date.now()
    /** Pretend one tick already elapsed so the first rAF frame runs a sim step (avoids a visible stall). */
    let lastTs = timeNow() - SIM_TICK_MS
    let acc = 0

    const tickLoop = () => {
      const prevSnap = playingSimSnapRef.current
      if (!prevSnap || prevSnap.mode !== 'playing') return

      const now = timeNow()
      /** 64ms cap: catch up without unbounded spiral if the JS thread stalls (tab blur, etc.). */
      const dt = Math.min(Math.max(0, now - lastTs), 64)
      lastTs = now
      acc += dt

      let next = prevSnap
      let stepped = false
      let simSteps = 0
      while (acc >= SIM_TICK_MS && simSteps < MAX_SIM_STEPS_PER_FRAME) {
        acc -= SIM_TICK_MS
        next = tickPlayingState(next)
        playingSimSnapRef.current = next
        stepped = true
        simSteps += 1
        if (next.mode !== 'playing') break
      }

      if (next.mode === 'playing') {
        next = { ...next, flameAnimTick: prevSnap.flameAnimTick + 1 }
        playingSimSnapRef.current = next
      }

      if (stepped && (next.mode === 'playing' || next.mode === 'gameOver')) {
        const token = sessionTokenRef.current
        if (token) {
          const prevChests = prevSnap.chests ?? []
          const prevChestById = new Map(prevChests.map((x) => [x.id, x]))
          for (const c of next.chests ?? []) {
            const prevC = prevChestById.get(c.id)
            if (c.collected && prevC && !prevC.collected) {
              void pickupWonderJumpChest(token)
                .then((p) => {
                  wonderJumpChestDockedRef.current = p.chestDocked === true
                  setServerChestDocked(p.chestDocked === true)
                  wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
                  setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
                  setGameState((s) => ({
                    ...s,
                    chests: (s.chests ?? []).filter((ch) => !ch.collected),
                  }))
                })
                .catch(() => {
                  setGameState((s) => {
                    if (s.mode !== 'playing' && s.mode !== 'gameOver') return s
                    if (!s.chests.some((ch) => ch.id === c.id && ch.collected)) return s
                    return {
                      ...s,
                      chests: s.chests.map((ch) => (ch.id === c.id ? { ...ch, collected: false } : ch)),
                    }
                  })
                })
              break
            }
          }
        }
      }

      const flameAdvanced = next.mode === 'playing' && next.flameAnimTick !== prevSnap.flameAnimTick
      if (stepped || next.mode !== 'playing' || flameAdvanced) {
        if (next.mode === 'gameOver') {
          setBestScore((current) => Math.max(current, displayRunScore(next.heightScore)))
        }
        setGameState(next)
        if (next.mode === 'playing') {
          playingSimSnapRef.current = next
        }
      }

      if (playingSimSnapRef.current?.mode === 'playing') {
        rafId = requestAnimationFrame(tickLoop)
      }
    }

    rafId = requestAnimationFrame(tickLoop)
    return () => cancelAnimationFrame(rafId)
  }, [gameState.mode, playHeight, playWidth, isFocused, tickPlayingState])

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

  /** Coarser height steps so sky + scene colors don’t recompute every sim tick (big SVG + style churn). */
  const skyHeightScoreStep =
    gameState.mode === 'menu' ? 0 : Math.floor(gameState.heightScore / 88) * 88
  const skyBlendCacheRef = useRef({ mushroom: NaN, tropical: NaN, space: NaN, obj: { mushroom: 0, tropical: 0, space: 0 } })
  const skyBlend = useMemo(() => {
    const mushroom =
      gameState.mode !== 'menu'
        ? getMushroomBlend(skyHeightScoreStep, gameState.startBiome)
        : getMushroomBlend(0, MENU_START_BIOME)
    const tropical =
      gameState.mode !== 'menu'
        ? getTropicalBlend(skyHeightScoreStep, gameState.startBiome)
        : getTropicalBlend(0, MENU_START_BIOME)
    const space =
      gameState.mode !== 'menu'
        ? getSpaceBlend(skyHeightScoreStep, gameState.startBiome)
        : getSpaceBlend(0, MENU_START_BIOME)
    const c = skyBlendCacheRef.current
    if (c.mushroom === mushroom && c.tropical === tropical && c.space === space) return c.obj
    const obj = { mushroom, tropical, space }
    skyBlendCacheRef.current = { mushroom, tropical, space, obj }
    return obj
  }, [gameState.mode, skyHeightScoreStep, gameState.startBiome])

  const sceneColorsCacheRef = useRef({ key: '', obj: null as unknown as WonderJumpSceneColors })
  const sceneColors = useMemo(() => {
    const prior = lerp3Color(
      GRASSLAND_THEME.screenBg,
      MUSHROOM_THEME.screenBg,
      TROPICAL_THEME.screenBg,
      skyBlend.mushroom,
      skyBlend.tropical,
    )
    const priorTile = lerp3Color(
      GRASSLAND_THEME.tileBg,
      MUSHROOM_THEME.tileBg,
      TROPICAL_THEME.tileBg,
      skyBlend.mushroom,
      skyBlend.tropical,
    )
    const next: WonderJumpSceneColors = {
      screenBg: lerpColor(prior, SPACE_THEME.screenBg, skyBlend.space),
      tileBg: lerpColor(priorTile, SPACE_THEME.tileBg, skyBlend.space),
      sunCore: lerpColor(
        lerp3Color('#fff8d2', '#e8dcf8', '#fff0cf', skyBlend.mushroom, skyBlend.tropical),
        '#c8d0ff',
        skyBlend.space,
      ),
      hillFar: lerpColor(
        lerp3Color(GRASSLAND_THEME.hillFar, MUSHROOM_THEME.hillFar, TROPICAL_THEME.hillFar, skyBlend.mushroom, skyBlend.tropical),
        SPACE_THEME.hillFar,
        skyBlend.space,
      ),
      hillNear: lerpColor(
        lerp3Color(GRASSLAND_THEME.hillNear, MUSHROOM_THEME.hillNear, TROPICAL_THEME.hillNear, skyBlend.mushroom, skyBlend.tropical),
        SPACE_THEME.hillNear,
        skyBlend.space,
      ),
    }
    const key = `${next.screenBg}|${next.tileBg}|${next.sunCore}|${next.hillFar}|${next.hillNear}`
    const c = sceneColorsCacheRef.current
    if (c.key === key) return c.obj
    sceneColorsCacheRef.current = { key, obj: next }
    return next
  }, [skyBlend])

  /** Update shake every 2 sim ticks — parent still renders each frame, but fewer child style churns. */
  const jetpackShakePhase = Math.floor(gameState.uiAnimTick / 2)
  const jetpackShakeCacheRef = useRef(JETPACK_SHAKE_NONE)
  const jetpackShake = useMemo(() => {
    if (gameState.mode !== 'playing' || gameState.jetpackFuelMs <= 0) {
      jetpackShakeCacheRef.current = JETPACK_SHAKE_NONE
      return JETPACK_SHAKE_NONE
    }
    const t = jetpackShakePhase * 2
    const next = {
      x: Math.round(Math.sin(t * 0.85) * 0.8),
      y: Math.round(Math.cos(t * 0.9) * 0.6),
    }
    const prev = jetpackShakeCacheRef.current
    if (prev !== JETPACK_SHAKE_NONE && prev.x === next.x && prev.y === next.y) return prev
    jetpackShakeCacheRef.current = next
    return next
  }, [gameState.mode, gameState.jetpackFuelMs, jetpackShakePhase])

  if (gameState.jetpackFuelMs > 0) {
    jetpackFxLatchRef.current = true
  }
  const jetpackFxLatched = jetpackFxLatchRef.current

  /** Match sky coarsening so biome HUD text isn’t recomputed on every height pixel. */
  const hudBiomeLabel = useMemo(() => {
    const m = getMushroomBlend(skyHeightScoreStep, gameState.startBiome)
    const t = getTropicalBlend(skyHeightScoreStep, gameState.startBiome)
    const s = getSpaceBlend(skyHeightScoreStep, gameState.startBiome)
    return biomeHudLabel(m, t, s, gameState.startBiome)
  }, [skyHeightScoreStep, gameState.startBiome, gameState.mode])
  const gameOverBiomeAccent = hudBiomeLabelToAccentBiome(hudBiomeLabel)
  const activePanelBiome: WonderJumpStartBiome =
    gameState.mode === 'menu' ? MENU_START_BIOME : gameState.mode === 'gameOver' ? gameOverBiomeAccent : gameState.startBiome
  const panelAccent = BIOME_UI_ACCENTS[activePanelBiome]
  const primaryButtonTone = useMemo(() => {
    const hex = wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX
    return {
      backgroundColor: hex,
      borderColor: hex,
    }
  }, [wonderportTheme?.brandAccent])
  const panelAccentGlow = useMemo(
    () => ({
      borderColor: brandAccentRgba(wonderportTheme, 0.4),
      shadowColor: wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX,
    }),
    [wonderportTheme],
  )
  const panelBiomeLabel = panelAccent.label
  const isHubPanel = gameState.mode === 'menu' || gameState.mode === 'gameOver'

  const leaderboardScrollMaxH = useMemo(
    () => Math.min(resolvedHeight * 0.58, 420),
    [resolvedHeight],
  )

  useEffect(() => {
    if (!leaderboardOpen) return
    let cancelled = false
    setLeaderboardFetchState('loading')
    void fetchWonderJumpLeaderboard(50)
      .then((entries) => {
        if (cancelled) return
        setLeaderboardEntries(entries)
        setLeaderboardFetchState('ok')
      })
      .catch(() => {
        if (cancelled) return
        setLeaderboardEntries([])
        setLeaderboardFetchState('error')
      })
    return () => {
      cancelled = true
    }
  }, [leaderboardOpen])

  useEffect(() => {
    if (!isHubPanel || !serverChestUnlocksAt) return
    const id = setInterval(() => setChestHubTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [isHubPanel, serverChestUnlocksAt])

  const activeOverlay =
    settingsOpen
      ? 'settings'
      : isHubPanel
        ? 'hub'
        : gameState.mode === 'paused'
          ? 'paused'
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

  const gameOverRunScore = displayRunScore(gameState.heightScore)
  const gameOverHighScore = Math.max(bestScore, gameOverRunScore)
  const gameOverNewBest = gameState.mode === 'gameOver' && gameOverRunScore > bestScore

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
    playingSimSnapRef.current = null
    jetpackFxLatchRef.current = false
    void loadWonderJumpCharacterStyle().then((style) => {
      setRunCharacterLocked(style)
      setGameState(createInitialState('playing', playWidth, playHeight, MENU_START_BIOME))
    })
  }
  const restartRun = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    playingSimSnapRef.current = null
    jetpackFxLatchRef.current = false
    void loadWonderJumpCharacterStyle().then((style) => {
      setRunCharacterLocked(style)
      setGameState(createInitialState('playing', playWidth, playHeight, MENU_START_BIOME))
    })
  }
  const pauseGame = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    const live = playingSimSnapRef.current
    if (live?.mode === 'playing') {
      const paused = { ...live, mode: 'paused' as const }
      playingSimSnapRef.current = paused
      setGameState(paused)
      return
    }
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
    playingSimSnapRef.current = null
    setGameState(createMenuPreviewState(MENU_START_BIOME))
  }
  const goHome = () => {
    setSettingsOpen(false)
    inputRef.current.leftPressed = false
    inputRef.current.rightPressed = false
    navigation?.navigate?.('Tabs' as never, { screen: 'Home' } as never)
  }
  const resetHubChestRevealAnim = useCallback(() => {
    hubChestGiftPop.setValue(0)
    hubChestGiftOpacity.setValue(1)
  }, [hubChestGiftPop, hubChestGiftOpacity])

  const closeHubChestRevealModal = useCallback(() => {
    setHubChestRevealPhase(null)
    setHubChestRevealError('')
    resetHubChestRevealAnim()
  }, [resetHubChestRevealAnim])

  const beginHubChestReveal = useCallback(async () => {
    if (!sessionToken || chestClaimBusy || !serverChestUnlocksAt) return
    if (new Date(serverChestUnlocksAt).getTime() > Date.now()) return

    resetHubChestRevealAnim()
    setHubChestRevealError('')
    setHubChestRevealPhase('opening')

    await new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.spring(hubChestGiftPop, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 88,
        }),
        Animated.timing(hubChestGiftOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]).start(() => resolve())
    })

    setHubChestRevealPhase('claiming')
    setChestClaimBusy(true)
    try {
      const res = await claimWonderJumpChest(sessionToken)
      if (res.ok) {
        wonderJumpChestDockedRef.current = false
        wonderJumpChestUnlocksAtRef.current = null
        setServerChestDocked(false)
        setServerChestUnlocksAt(null)
        if (onUserUpdated) {
          try {
            const u = await fetchSessionUser(sessionToken)
            await onUserUpdated(u)
          } catch {
            /* ignore */
          }
        }
        setHubChestRevealPhase('success')
      } else {
        setHubChestRevealError(res.error || 'Could not open your gift.')
        hubChestGiftOpacity.setValue(1)
        hubChestGiftPop.setValue(0)
        setHubChestRevealPhase('error')
      }
    } catch {
      setHubChestRevealError('Something went wrong. Try again.')
      hubChestGiftOpacity.setValue(1)
      hubChestGiftPop.setValue(0)
      setHubChestRevealPhase('error')
    } finally {
      setChestClaimBusy(false)
    }
  }, [
    sessionToken,
    chestClaimBusy,
    serverChestUnlocksAt,
    onUserUpdated,
    resetHubChestRevealAnim,
    hubChestGiftPop,
    hubChestGiftOpacity,
  ])

  const beginHubChestOpenTimer = useCallback(async () => {
    if (!sessionToken || chestClaimBusy || !serverChestDocked || serverChestUnlocksAt) return
    setChestClaimBusy(true)
    try {
      const p = await startWonderJumpChestOpen(sessionToken)
      wonderJumpChestDockedRef.current = p.chestDocked === true
      setServerChestDocked(p.chestDocked === true)
      wonderJumpChestUnlocksAtRef.current = p.chestUnlocksAt ?? null
      setServerChestUnlocksAt(p.chestUnlocksAt ?? null)
    } catch {
      /* ignore: hub UI will keep current state and refresh on next progress sync */
    } finally {
      setChestClaimBusy(false)
    }
  }, [sessionToken, chestClaimBusy, serverChestDocked, serverChestUnlocksAt])

  const wjChestReadyToOpen = useMemo(() => {
    if (!isHubPanel || !serverChestUnlocksAt) return false
    return new Date(serverChestUnlocksAt).getTime() <= Date.now()
  }, [isHubPanel, serverChestUnlocksAt, chestHubTick])

  const wjChestCountdownText = useMemo(() => {
    if (!isHubPanel || !serverChestUnlocksAt) return ''
    return formatWonderJumpChestRemaining(serverChestUnlocksAt)
  }, [isHubPanel, serverChestUnlocksAt, chestHubTick])

  const cam = gameState.cameraY
  /** Platforms near the viewport — avoids mapping hundreds of rows per frame as the run climbs. */
  const visiblePlatforms = useMemo(() => {
    const lo = cam - 120
    const hi = cam + playHeight + 120
    const standId = gameState.player.groundPlatformId
    return gameState.platforms.filter(
      (p) => (p.y > lo && p.y < hi) || (standId != null && p.id === standId)
    )
  }, [gameState.platforms, cam, playHeight, gameState.player.groundPlatformId])
  /** Platforms in camera range — spikes/crabs resolve hosts from this map. */
  const platformByIdNear = useMemo(() => {
    const lo = cam - 420
    const hi = cam + playHeight + 420
    const m = new Map<string, PlatformItem>()
    for (const p of gameState.platforms) {
      if (p.y >= lo && p.y <= hi) m.set(p.id, p)
    }
    return m
  }, [gameState.platforms, cam, playHeight])
  const visibleSpikes = useMemo(() => {
    const lo = cam - 28
    const hi = cam + playHeight + 32
    const out: Spike[] = []
    for (const spike of gameState.spikes) {
      const host = platformByIdNear.get(spike.id.replace('spike-', ''))
      if (!host) continue
      const y = host.y - spike.height
      if (y <= lo || y >= hi) continue
      out.push({ ...spike, x: host.x + spike.offsetX, y })
    }
    return out
  }, [gameState.spikes, platformByIdNear, cam, playHeight])
  const hudDisplayScore = useMemo(() => displayRunScore(gameState.heightScore), [gameState.heightScore])
  const visibleJetpacks = useMemo(() => {
    const lo = cam - playHeight - 200
    const hi = cam + playHeight + 260
    return gameState.jetpacks.filter((j) => !j.collected && j.y > lo && j.y < hi)
  }, [gameState.jetpacks, cam, playHeight])
  const visibleChests = useMemo(() => {
    const lo = cam - playHeight - 200
    const hi = cam + playHeight + 260
    const list = gameState.chests ?? []
    return list.filter((c) => !c.collected && c.y > lo && c.y < hi)
  }, [gameState.chests, cam, playHeight])
  const visibleCrabs = useMemo(() => {
    return (gameState.crabs ?? []).filter((crab) => {
      const host = platformByIdNear.get(crab.hostPlatformId)
      if (!host) return false
      const y = host.y - crab.height + 2
      return y > cam - 55 && y < cam + playHeight + 60
    })
  }, [gameState.crabs, platformByIdNear, cam, playHeight])
  const visibleAsteroids = useMemo(() => {
    const lo = cam - playHeight - 200
    const hi = cam + playHeight + 100
    return (gameState.asteroids ?? []).filter((a) => {
      const plumeReach = getMeteorPlumeReach(a.height, a.variant)
      const topY = a.y - plumeReach
      const bottomY = a.y + a.height
      return bottomY > lo && topY < hi
    })
  }, [gameState.asteroids, cam, playHeight])

  /** Integer world X; Y scroll is one parent `translateY` (smoother than per-sprite screen math). */
  const snapX = (x: number) => Math.round(x)
  /** No `renderToHardwareTextureAndroid` here: world `translateY` updates every frame and the HW layer would re-rasterize constantly (often worse than default). */
  const worldRollStyle = useMemo(
    () =>
      ({
        position: 'absolute' as const,
        left: 0,
        top: 0,
        width: playWidth,
        bottom: 0,
        transform: [{ translateY: Math.round(-cam) }],
      }) as const,
    [playWidth, cam]
  )

  const screenShellStyle = useMemo(() => [styles.screen], [])
  const activeWonderJumpCharacter: WonderJumpCharacterStyle =
    gameState.mode === 'playing' || gameState.mode === 'paused' ? runCharacterLocked : characterStyle
  const gameTileShellStyle = useMemo(
    () => [
      styles.gameTile,
      {
        marginBottom: tileBottomSpace,
        height: playHeight,
        backgroundColor: sceneColors.tileBg,
      },
    ],
    [tileBottomSpace, playHeight, sceneColors.tileBg]
  )

  return (
    <View style={screenShellStyle}>
      {gameState.mode === 'menu' ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: -120, top: -120, width: 1, height: 1, opacity: 0 }}
        >
          <WonderJumpJetpackGraphic width={EQUIPPED_JETPACK_VISUAL_W} height={EQUIPPED_JETPACK_VISUAL_H} />
        </View>
      ) : null}
      <View style={gameTileShellStyle}>
        <WonderJumpAmbientDecor
          playWidth={playWidth}
          playHeight={playHeight}
          mushroomBlend={skyBlend.mushroom}
          tropicalBlend={skyBlend.tropical}
          spaceBlend={skyBlend.space}
        />

        <View pointerEvents="box-none" style={worldRollStyle}>
        {clouds.map((cloud) => {
          if (skyBlend.space > 0.2) return null
          if (gameState.heightScore <= 320) return null
          if (cloud.y < cam - 90 || cloud.y > cam + playHeight + 50) return null
          return (
            <GrasslandCloud key={cloud.id} left={snapX(cloud.x)} top={Math.round(cloud.y)} width={cloud.width} />
          )
        })}

        {visiblePlatforms.map((platform) => {
          const isBouncy = platform.kind === 'bouncy'
          const visualH = platformVisualShellHeight(platform.surface)
          const graphicKind: GrasslandPlatformKind =
            platform.kind === 'moving'
              ? 'moving'
              : platform.kind === 'breakable'
                ? 'breakable'
                : 'normal'
          return (
            <JumpPlatformRow
              key={platform.id}
              left={snapX(platform.x)}
              top={Math.round(platform.y)}
              width={platform.width}
              shellHeight={visualH}
              graphicKind={graphicKind}
              surface={platform.surface}
              faceSeed={platformFaceSeed(platform.id, platform.x, platform.width)}
              isBouncy={isBouncy}
              isFalling={platform.isFalling}
              topMushrooms={platform.topMushrooms}
              topPalmTree={platform.topPalmTree}
              topFlowers={platform.topFlowers}
            />
          )
        })}

        {visibleSpikes.map((spike) => (
          <SpikeGraphic
            key={spike.id}
            left={snapX(spike.x)}
            top={Math.round(spike.y)}
            width={spike.width}
            height={spike.height}
          />
        ))}

        {visibleJetpacks.map((jetpack) => {
          const t = gameState.uiAnimTick * 0.1 + jetpack.hoverPhase
          const bob = Math.sin(t) * 1.35 + Math.sin(t * 0.5) * 0.35
          return (
            <JetpackPickupView
              key={jetpack.id}
              left={snapX(jetpack.x)}
              top={Math.round(jetpack.y + bob)}
              width={jetpack.width}
              height={jetpack.height}
            />
          )
        })}

        {visibleChests.map((chest) => (
          <WonderJumpChestPickupView
            key={chest.id}
            left={snapX(chest.x)}
            top={Math.round(chest.y)}
            width={chest.width}
            height={chest.height}
          />
        ))}

        {visibleCrabs.map((crab) => {
          const host = platformByIdNear.get(crab.hostPlatformId)
          if (!host) return null
          const x = host.x + crab.localX
          const y = host.y - crab.height + 2
          const deadProgress = crab.alive ? 0 : clamp(crab.deathMs / CRAB_DEATH_MS, 0, 1)
          const legFrame: 0 | 1 = Math.floor(gameState.uiAnimTick / 7) % 2 === 0 ? 0 : 1
          return (
            <View key={crab.id} pointerEvents="none">
              <CrabView
                left={snapX(x)}
                top={Math.round(y)}
                width={crab.width}
                height={crab.height}
                deadProgress={deadProgress}
                legFrame={legFrame}
              />
            </View>
          )
        })}

        {visibleAsteroids.map((asteroid) => (
          <MeteorComposite
            key={asteroid.id}
            left={snapX(asteroid.x)}
            top={Math.round(asteroid.y)}
            variant={asteroid.variant}
            flamePhase={asteroid.flamePhase}
            flameAnimTick={gameState.flameAnimTick}
          />
        ))}

        <WonderJumpPlayerStack
          characterStyle={activeWonderJumpCharacter}
          playerX={snapX(gameState.player.x + jetpackShake.x)}
          playerY={Math.round(gameState.player.y + jetpackShake.y)}
          playerWidth={gameState.player.width}
          playerHeight={gameState.player.height}
          jetpackFuelMs={gameState.jetpackFuelMs}
          jetpackAnimTick={gameState.jetpackAnimTick}
          jetpackFxLatched={jetpackFxLatched}
        />
        </View>

        <View style={styles.hud}>
          <Text style={styles.hudScoreLabel}>Score</Text>
          <Text style={styles.hudScoreValue}>{hudDisplayScore}</Text>
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
              <Text style={[styles.primaryButtonText, styles.gameOverMontserratButton]}>Done</Text>
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
            <Pressable
              onPress={() => setLeaderboardOpen(true)}
              style={styles.leaderboardHeroTile}
              accessibilityRole="button"
              accessibilityLabel="Open leaderboard"
            >
              <Text style={styles.leaderboardHeroTileText}>Leaderboard</Text>
            </Pressable>
            <Pressable onPress={resumeGame} style={[styles.primaryButton, primaryButtonTone]}>
              <Text style={[styles.primaryButtonText, styles.gameOverMontserratButton]}>Resume</Text>
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

        {isHubPanel && !settingsOpen ? (
          <View style={hubPanelOverlayStyle} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.panel,
              styles.panelDarkGlass,
              panelAccentGlow,
              panelEntryStyle,
              styles.gameOverPanelDock,
              hubPanelCardStyle,
            ]}
          >
            <ScrollView
              style={[styles.hubPanelScroll, { maxHeight: hubPanelScrollMaxHeight }]}
              contentContainerStyle={styles.hubPanelScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
            <View style={styles.gameOverTop}>
              <Text style={styles.gameOverTitle}>
                {gameState.mode === 'gameOver' ? 'Game Over :(' : 'WonderJump'}
              </Text>
              {gameState.mode === 'gameOver' && gameState.deathCause ? (
                <Text style={styles.gameOverDeathBlurb}>{deathBlurb(gameState.deathCause)}</Text>
              ) : gameState.mode === 'menu' ? (
                <Text style={styles.gameOverDeathBlurb}>Up only. Break your best.</Text>
              ) : null}
              <Text
                style={[
                  styles.gameOverDeadBiome,
                  {
                    color: GAME_OVER_DEAD_BIOME_TEXT[
                      gameState.mode === 'gameOver' ? gameOverBiomeAccent : MENU_START_BIOME
                    ],
                  },
                ]}
              >
                {gameState.mode === 'gameOver' ? hudBiomeLabel : BIOME_UI_ACCENTS[MENU_START_BIOME].label}
              </Text>
              <View style={styles.gameOverHeroCard}>
                {gameState.mode === 'gameOver' ? (
                  <>
                    <Text style={styles.gameOverHeroLabel}>Your score</Text>
                    <Text style={styles.gameOverHeroValue}>{gameOverRunScore}</Text>
                    <View style={styles.gameOverSubStack}>
                      <View style={styles.gameOverSubRow}>
                        <Text style={styles.gameOverSubLabel}>All-time best</Text>
                        <Text style={styles.gameOverSubValue}>{gameOverHighScore}</Text>
                      </View>
                      <View style={styles.gameOverSubRow}>
                        <Text style={styles.gameOverSubLabel}>Jetpacks used</Text>
                        <Text style={styles.gameOverSubValue}>{gameState.jetpacksUsedThisRun}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setLeaderboardOpen(true)}
                      style={styles.leaderboardHeroTile}
                      accessibilityRole="button"
                      accessibilityLabel="Open leaderboard"
                    >
                      <Text style={styles.leaderboardHeroTileText}>Leaderboard</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.gameOverHeroLabel}>Best score</Text>
                    <Text style={styles.gameOverHeroValue}>{bestScore}</Text>
                    <Pressable
                      onPress={() => setLeaderboardOpen(true)}
                      style={styles.leaderboardHeroTile}
                      accessibilityRole="button"
                      accessibilityLabel="Open leaderboard"
                    >
                      <Text style={styles.leaderboardHeroTileText}>Leaderboard</Text>
                    </Pressable>
                  </>
                )}
              </View>
              {gameOverNewBest ? <Text style={styles.gameOverNewBest}>New high score!</Text> : null}
            </View>

            {showGiftDock ? (
              <View style={styles.wjChestHubCard}>
                <View style={styles.wjChestHubRow}>
                  {serverChestUnlocksAt ? (
                    wjChestReadyToOpen ? (
                      <Pressable
                        onPress={() => void beginHubChestReveal()}
                        disabled={chestClaimBusy || hubChestRevealPhase !== null}
                        style={[styles.wjChestDockTile, styles.wjChestDockTileReady]}
                      >
                        <DailyRewardsMysteryGiftVisual maxStageSize={WJ_DOCK_GIFT_STAGE_PX} ready />
                      </Pressable>
                    ) : (
                      <View style={styles.wjChestDockTile}>
                        <DailyRewardsMysteryGiftVisual maxStageSize={WJ_DOCK_GIFT_STAGE_PX} ready={false} />
                      </View>
                    )
                  ) : (
                    <Pressable
                      onPress={() => void beginHubChestOpenTimer()}
                      disabled={chestClaimBusy || hubChestRevealPhase !== null}
                      style={styles.wjChestDockTile}
                    >
                      <DailyRewardsMysteryGiftVisual maxStageSize={WJ_DOCK_GIFT_STAGE_PX} ready={false} />
                    </Pressable>
                  )}
                  <View style={styles.wjChestHubCopy}>
                    <Text style={styles.wjChestHubTitle}>Gift dock</Text>
                    {serverChestUnlocksAt ? (
                      wjChestReadyToOpen ? (
                        <Text style={styles.wjChestHubMeta}>Tap to open.</Text>
                      ) : (
                        <Text style={styles.wjChestHubMeta}>
                          Opens <Text style={styles.wjChestHubCountdown}>{wjChestCountdownText}</Text>
                        </Text>
                      )
                    ) : (
                      <Text style={styles.wjChestHubMeta}>Tap Open to start a 6-hour unlock timer.</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.gameOverFooter}>
              <Pressable
                onPress={gameState.mode === 'gameOver' ? restartRun : startGame}
                style={[styles.primaryButton, primaryButtonTone]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    styles.gameOverMontserratButton,
                    gameState.mode === 'menu' ? styles.hubPanelPrimaryRunText : null,
                  ]}
                >
                  {gameState.mode === 'gameOver' ? 'RESTART RUN' : 'START RUN'}
                </Text>
              </Pressable>

              <View style={styles.gameOverFooterActions}>
                {gameState.mode === 'gameOver' ? (
                  <Pressable onPress={backToMenu} style={styles.gameOverFooterButton}>
                    <Text style={styles.gameOverFooterButtonText}>Menu</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setSettingsOpen(true)} style={styles.gameOverFooterButton}>
                  <Text style={styles.gameOverFooterButtonText}>Settings</Text>
                </Pressable>
                <Pressable onPress={goHome} style={styles.gameOverFooterButton}>
                  <Text style={styles.gameOverFooterButtonText}>Home</Text>
                </Pressable>
              </View>
            </View>
            </ScrollView>
          </Animated.View>
          </View>
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

      <Modal
        visible={hubChestRevealPhase !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (hubChestRevealPhase === 'success' || hubChestRevealPhase === 'error') closeHubChestRevealModal()
        }}
      >
        <Pressable
          style={styles.wjChestModalBackdrop}
          onPress={() => {
            if (hubChestRevealPhase === 'success' || hubChestRevealPhase === 'error') closeHubChestRevealModal()
          }}
        >
          <Pressable style={styles.wjChestModalCard} onPress={(e) => e.stopPropagation()}>
            {hubChestRevealPhase === 'error' ? (
              <>
                <Text style={styles.wjChestModalTitle}>Could not open</Text>
                <Text style={styles.wjChestModalBody}>{hubChestRevealError}</Text>
                <Pressable onPress={closeHubChestRevealModal} style={[styles.wjChestModalButton, primaryButtonTone]}>
                  <Text style={styles.wjChestModalButtonText}>Close</Text>
                </Pressable>
              </>
            ) : hubChestRevealPhase === 'success' ? (
              <>
                <Text style={styles.wjChestModalTitle}>You earned {WONDER_JUMP_CHEST_REWARD_COINS} Wonder coins</Text>
                <View style={styles.wjChestModalCoinsRow}>
                  <WonderSpinningCoin
                    size={56}
                    fallbackColor={wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX}
                  />
                  <WonderSpinningCoin
                    size={56}
                    fallbackColor={wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX}
                  />
                </View>
                <Text style={styles.wjChestModalSub}>They are already in your wallet.</Text>
                <Pressable onPress={closeHubChestRevealModal} style={[styles.wjChestModalButton, primaryButtonTone]}>
                  <Text style={styles.wjChestModalButtonText}>Great</Text>
                </Pressable>
              </>
            ) : hubChestRevealPhase === 'claiming' ? (
              <View style={styles.wjChestModalClaiming}>
                <ActivityIndicator
                  size="large"
                  color={wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX}
                />
                <Text style={styles.wjChestModalClaimingText}>Adding coins…</Text>
              </View>
            ) : (
              <Animated.View
                style={[
                  styles.wjChestModalGiftWrap,
                  {
                    opacity: hubChestGiftOpacity,
                    transform: [
                      {
                        scale: hubChestGiftPop.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.14],
                        }),
                      },
                      {
                        rotate: hubChestGiftPop.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-7deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <WonderJumpGiftboxFromAsset width={112} height={112} />
              </Animated.View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={leaderboardOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaderboardOpen(false)}
      >
        <View style={styles.leaderboardModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setLeaderboardOpen(false)} />
          <View
            style={[styles.leaderboardModalCard, { maxHeight: Math.min(resolvedHeight * 0.88, 640) }]}
            pointerEvents="box-none"
          >
            <View style={styles.leaderboardModalHeader}>
              <Text style={styles.leaderboardModalTitle}>WonderJump leaderboard</Text>
            </View>
            <View style={styles.leaderboardTableHead}>
              <Text style={styles.leaderboardThRank}>#</Text>
              <Text style={styles.leaderboardThPlayer}>Player</Text>
              <Text style={styles.leaderboardThBiome}>Biome</Text>
              <Text style={styles.leaderboardThScore}>Score</Text>
            </View>
            {leaderboardFetchState === 'loading' ? (
              <View style={[styles.leaderboardListShell, styles.leaderboardLoadingBox, { minHeight: 160 }]}>
                <ActivityIndicator size="large" color={wonderportTheme?.brandAccent ?? BRAND_ACCENT_LIME_HEX} />
              </View>
            ) : (
              <ScrollView
                style={[styles.leaderboardListShell, styles.leaderboardScroll, { maxHeight: leaderboardScrollMaxH }]}
                contentContainerStyle={styles.leaderboardScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                bounces
              >
                {leaderboardEntries.length === 0 ? (
                  <Text style={styles.leaderboardEmptyText}>
                    {leaderboardFetchState === 'error'
                      ? 'Could not load the leaderboard.'
                      : 'No saved scores yet. Be the first on the board.'}
                  </Text>
                ) : (
                  leaderboardEntries.map((row, index) => {
                    const rank = index + 1
                    const biomeId = resolveLeaderboardBiomeId(row.biomeReached, row.score)
                    const isLastRow = index === leaderboardEntries.length - 1
                    return (
                      <View
                        key={row.userId}
                        style={[styles.leaderboardRow, isLastRow ? styles.leaderboardRowLast : null]}
                      >
                        <Text
                          style={[
                            styles.leaderboardCellRank,
                            rank === 1
                              ? styles.leaderboardRankGold
                              : rank === 2
                                ? styles.leaderboardRankSilver
                                : rank === 3
                                  ? styles.leaderboardRankBronze
                                  : null,
                          ]}
                        >
                          {rank}
                        </Text>
                        <Text style={styles.leaderboardCellPlayer} numberOfLines={1}>
                          {row.username}
                        </Text>
                        <Text
                          style={[
                            styles.leaderboardCellBiome,
                            { color: wonderJumpLeaderboardBiomeColor(biomeId) },
                          ]}
                          numberOfLines={1}
                        >
                          {wonderJumpBiomeDisplayLabel(biomeId)}
                        </Text>
                        <Text style={styles.leaderboardCellScore}>{row.score.toLocaleString()}</Text>
                      </View>
                    )
                  })
                )}
              </ScrollView>
            )}
            <Pressable
              onPress={() => setLeaderboardOpen(false)}
              style={[styles.leaderboardModalClose, primaryButtonTone]}
            >
              <Text style={styles.wjChestModalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createWonderJumpStyles(theme: any) {
  const A = theme?.brandAccent ?? BRAND_ACCENT_LIME_HEX
  const S = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
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
  playerShadow: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(23, 46, 58, 0.32)',
  },
  hud: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: S(0.4),
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    maxWidth: '72%',
  },
  hudScoreLabel: {
    color: APP_UI_TEXT_MUTED,
    fontSize: 10,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  hudScoreValue: {
    color: A,
    fontSize: 22,
    fontFamily: CLASSIC_GAME_FONT_BOLD,
    letterSpacing: 0.15,
    lineHeight: 24,
  },
  hudBiomeHint: {
    color: APP_UI_TEXT_DIM,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: APP_UI_SURFACE,
    borderWidth: 1,
    borderColor: S(0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonText: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 13,
    marginTop: -1,
    letterSpacing: 0.8,
  },
  panel: {
    position: 'absolute',
    left: 26,
    right: 26,
    backgroundColor: APP_UI_SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S(0.4),
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  panelDarkGlass: {
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    borderColor: S(0.4),
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  gameOverPanelDock: {
    gap: 0,
    paddingVertical: 14,
    paddingBottom: 12,
  },
  hubPanelScroll: {
    width: '100%',
  },
  hubPanelScrollContent: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 6,
  },
  gameOverTop: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gameOverTitle: {
    width: '100%',
    textAlign: 'center',
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 24,
    letterSpacing: 0.2,
  },
  /** Leaderboard CTA — hollow black fill, neon lime outline + label (menu + game over). */
  leaderboardHeroTile: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: A,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardHeroTileText: {
    color: A,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 12,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  gameOverDeathBlurb: {
    color: APP_UI_TEXT_MUTED,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: -2,
    marginBottom: 2,
  },
  gameOverDeadBiome: {
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 17,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  gameOverHeroCard: {
    width: '100%',
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: S(0.4),
    alignItems: 'center',
  },
  gameOverHeroLabel: {
    color: APP_UI_TEXT_MUTED,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 15,
    letterSpacing: 0.35,
    marginBottom: 4,
  },
  gameOverHeroValue: {
    color: A,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 52,
    letterSpacing: -1,
    lineHeight: 56,
    marginBottom: 6,
  },
  gameOverSubStack: {
    width: '100%',
    gap: 6,
    paddingHorizontal: 4,
  },
  gameOverSubRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  gameOverSubLabel: {
    flex: 1,
    flexShrink: 1,
    color: APP_UI_TEXT_MUTED,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 15,
    letterSpacing: 0.15,
    lineHeight: 20,
  },
  gameOverSubValue: {
    minWidth: 52,
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 15,
    letterSpacing: 0.15,
    lineHeight: 20,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  gameOverNewBest: {
    marginTop: 6,
    color: A,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 15,
    letterSpacing: 0.25,
  },
  gameOverMontserratButton: {
    fontFamily: WONDER_JUMP_UI_BOLD,
  },
  /** Main hub green tile — larger all-caps Montserrat (game over uses default primary size). */
  hubPanelPrimaryRunText: {
    fontSize: 17,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    lineHeight: 22,
  },
  gameOverFooter: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: S(0.22),
  },
  wjChestHubCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S(0.4),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingTop: 8,
    paddingBottom: 9,
    paddingHorizontal: 11,
    marginBottom: 6,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  wjChestHubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wjChestDockTile: {
    width: 90,
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S(0.28),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    overflow: 'visible',
  },
  wjChestDockTileReady: {
    borderColor: A,
    backgroundColor: S(0.12),
    shadowColor: A,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  /** Empty dock: “open slot” — same black + lime shell as the rest of the app. */
  wjChestDockTileEmptySlot: {
    borderColor: S(0.4),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  wjDockEmptyComposer: {
    width: '100%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wjDockEmptyOrbit: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: S(0.28),
    backgroundColor: S(0.06),
  },
  wjDockEmptyPad: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: 'rgba(203, 255, 0, 0.08)',
    borderWidth: 1,
    borderColor: S(0.4),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: A,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  leaderboardModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    position: 'relative',
  },
  leaderboardModalCard: {
    width: '100%',
    maxWidth: 380,
    zIndex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: S(0.38),
    backgroundColor: '#000000',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  leaderboardModalHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  leaderboardModalTitle: {
    color: '#f6fbff',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  leaderboardListShell: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leaderboardTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 0,
  },
  leaderboardThRank: {
    width: 36,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    color: 'rgba(200, 220, 245, 0.75)',
    letterSpacing: 0.4,
  },
  leaderboardThPlayer: {
    flex: 1,
    minWidth: 0,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    color: 'rgba(200, 220, 245, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  leaderboardThBiome: {
    width: 92,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    color: 'rgba(200, 220, 245, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  leaderboardThScore: {
    width: 64,
    textAlign: 'right',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    color: 'rgba(200, 220, 245, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  leaderboardScroll: {
    width: '100%',
    backgroundColor: '#000000',
  },
  leaderboardLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  leaderboardEmptyText: {
    textAlign: 'center',
    color: 'rgba(190, 214, 236, 0.9)',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 13,
    letterSpacing: 0.15,
    lineHeight: 18,
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  leaderboardScrollContent: {
    paddingBottom: 8,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  leaderboardRowLast: {
    borderBottomWidth: 0,
  },
  leaderboardCellRank: {
    width: 36,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    color: 'rgba(220, 235, 255, 0.95)',
    fontVariant: ['tabular-nums'],
  },
  leaderboardRankGold: {
    color: '#ffd76a',
  },
  leaderboardRankSilver: {
    color: '#d8e4f2',
  },
  leaderboardRankBronze: {
    color: '#e4a574',
  },
  leaderboardCellPlayer: {
    flex: 1,
    minWidth: 0,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 13,
    color: '#eef6ff',
    letterSpacing: 0.12,
    paddingRight: 8,
  },
  leaderboardCellBiome: {
    width: 92,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    letterSpacing: 0.1,
    paddingRight: 6,
  },
  leaderboardCellScore: {
    width: 64,
    textAlign: 'right',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.08,
    fontVariant: ['tabular-nums'],
  },
  leaderboardModalClose: {
    marginTop: 12,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wjChestHubCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  wjChestHubTitle: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    letterSpacing: 0.12,
    marginBottom: 2,
  },
  wjChestHubMeta: {
    color: APP_UI_TEXT_DIM,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    letterSpacing: 0.08,
    lineHeight: 14,
  },
  wjChestHubCountdown: {
    color: '#ffffff',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  wjChestModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  wjChestModalCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: S(0.4),
    backgroundColor: APP_UI_SURFACE,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 14,
    minHeight: 248,
  },
  wjChestModalGiftWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  wjChestModalClaiming: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 28,
  },
  wjChestModalClaimingText: {
    color: APP_UI_TEXT_MUTED,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  wjChestModalTitle: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  wjChestModalBody: {
    color: APP_UI_TEXT_MUTED,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 13,
    letterSpacing: 0.15,
    textAlign: 'center',
    lineHeight: 18,
  },
  wjChestModalSub: {
    color: APP_UI_TEXT_DIM,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 12,
    letterSpacing: 0.12,
    textAlign: 'center',
    lineHeight: 16,
  },
  wjChestModalCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 4,
  },
  wjChestModalButton: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  wjChestModalButtonText: {
    color: '#000000',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    letterSpacing: 0.28,
  },
  gameOverBiomeChipText: {
    color: APP_UI_TEXT_MUTED,
    fontSize: 11,
    fontFamily: WONDER_JUMP_UI_BOLD,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  gameOverBiomeChipTextActive: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
  },
  gameOverFooterActions: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 2,
  },
  gameOverFooterButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: S(0.4),
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameOverFooterButtonText: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 12,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  panelTitle: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 24,
    letterSpacing: 0.2,
  },
  panelBiome: {
    color: A,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  panelSubtitleSmall: {
    color: APP_UI_TEXT_DIM,
    fontSize: 12,
    fontFamily: WONDER_JUMP_UI_BOLD,
    marginBottom: -4,
    letterSpacing: 0.12,
  },
  panelBiomeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    borderColor: S(0.2),
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
  panelBiomeChipSpace: {
    borderColor: 'rgba(184, 196, 232, 0.45)',
    backgroundColor: 'rgba(8, 10, 18, 0.55)',
  },
  panelBiomeChipGrassActive: {
    borderColor: A,
    backgroundColor: 'rgba(45, 106, 58, 0.22)',
  },
  panelBiomeChipMushroomActive: {
    borderColor: A,
    backgroundColor: 'rgba(107, 61, 85, 0.22)',
  },
  panelBiomeChipTropicalActive: {
    borderColor: A,
    backgroundColor: 'rgba(29, 127, 117, 0.22)',
  },
  panelBiomeChipSpaceActive: {
    borderColor: A,
    backgroundColor: 'rgba(139, 154, 212, 0.2)',
  },
  panelBiomeChipText: {
    color: APP_UI_TEXT_MUTED,
    fontSize: 12,
    fontFamily: WONDER_JUMP_UI_BOLD,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  panelBiomeChipTextActive: {
    color: '#ffffff',
    fontFamily: WONDER_JUMP_UI_BOLD,
  },
  panelSubtitle: {
    color: APP_UI_TEXT_MUTED,
    fontSize: 13,
    fontFamily: WONDER_JUMP_UI_BOLD,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: 0.15,
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
    borderRadius: 11,
    borderWidth: 1,
    borderColor: S(0.4),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  settingsOptionChipActive: {
    borderColor: A,
    backgroundColor: S(0.12),
  },
  settingsOptionText: {
    color: APP_UI_TEXT_MUTED,
    fontSize: 11,
    fontFamily: WONDER_JUMP_UI_BOLD,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  settingsOptionTextActive: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: A,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: A,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 14,
    letterSpacing: 0.28,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: S(0.4),
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: APP_UI_TEXT,
    fontFamily: WONDER_JUMP_UI_BOLD,
    fontSize: 12,
    letterSpacing: 0.2,
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
}

