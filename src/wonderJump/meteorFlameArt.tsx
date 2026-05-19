/**
 * Canonical meteor flame art — keep in sync with
 * `.cursor/projects/.../canvases/wonderjump-meteor-designs.canvas.tsx` (FlameSvg block).
 */
import Svg, { G, Path } from 'react-native-svg'

export type MeteorFlameVariant = 'compact' | 'standard' | 'chunk' | 'colossal'

export const METEOR_FLAME_ART_VERSION = 7

export const FLAME_OUTER = '#e85610'
export const FLAME_MIDDLE = '#ff9224'
export const FLAME_INNER = '#ffd038'

const FLAME_PIVOT_X = 32
const FLAME_PIVOT_Y = 71

const METEOR_FLAME_OUTER =
  'M 32 1 L 26 6 L 22 11 L 19 16 L 16 21 L 13 27 L 11 33 L 10 39 L 10 45 L 11 51 L 14 57 L 18 62 L 24 67 L 32 71 ' +
  'L 40 67 L 46 62 L 50 57 L 53 51 L 54 45 L 54 39 L 53 33 L 51 27 L 48 21 L 45 16 L 42 11 L 38 6 Z'

const METEOR_FLAME_OUTER_ALT =
  'M 32 2 L 27 7 L 23 12 L 20 17 L 17 22 L 14 28 L 12 34 L 10 40 L 10 46 L 12 52 L 15 58 L 19 63 L 25 68 L 32 71 ' +
  'L 39 68 L 45 63 L 49 58 L 52 52 L 54 46 L 54 40 L 52 34 L 50 28 L 47 22 L 44 17 L 41 12 L 37 7 Z'

const METEOR_FLAME_MIDDLE =
  'M 32.0 9.4 L 26.7 13.8 L 23.2 18.2 L 20.6 22.6 L 17.9 27.0 L 15.3 32.3 L 13.5 37.6 L 12.6 42.8 L 12.6 48.1 ' +
  'L 13.5 53.4 L 16.2 58.7 L 19.7 63.1 L 25.0 67.5 L 32.0 71.0 L 39.0 67.5 L 44.3 63.1 L 47.8 58.7 L 50.5 53.4 ' +
  'L 51.4 48.1 L 51.4 42.8 L 50.5 37.6 L 48.7 32.3 L 46.1 27.0 L 43.4 22.6 L 40.8 18.2 L 37.3 13.8 Z'

const METEOR_FLAME_INNER =
  'M 32.0 20.6 L 27.7 24.2 L 24.8 27.8 L 22.6 31.4 L 20.5 35.0 L 18.3 39.3 L 16.9 43.6 L 16.2 48.0 L 16.2 52.3 ' +
  'L 16.9 56.6 L 19.0 60.9 L 21.9 64.5 L 26.2 68.1 L 32.0 71.0 L 37.8 68.1 L 42.1 64.5 L 45.0 60.9 L 47.1 56.6 ' +
  'L 47.8 52.3 L 47.8 48.0 L 47.1 43.6 L 45.7 39.3 L 43.5 35.0 L 41.4 31.4 L 39.2 27.8 L 36.3 24.2 Z'

export const FLAME_VARIANT_SCALE: Record<MeteorFlameVariant, number> = {
  compact: 0.9,
  standard: 1,
  chunk: 1.06,
  colossal: 1.14,
}

/** Plume length in flame viewBox units (tip y≈1 → pivot y=71). */
const FLAME_VIEWBOX_H = 72

/** Extra viewBox units above y=0 so scaled tips stay inside the SVG (RN clips overflow). */
const FLAME_VIEWBOX_TOP: Record<MeteorFlameVariant, number> = {
  compact: 10,
  standard: 12,
  chunk: 18,
  colossal: 26,
}

function flameViewBox(variant: MeteorFlameVariant) {
  const top = FLAME_VIEWBOX_TOP[variant]
  return `0 ${-top} 64 ${FLAME_VIEWBOX_H + top}`
}

/**
 * Layout px above the nominal flame tail — matches expanded viewBox headroom.
 * `flameBoxHeightPx` = tail height + rock overlap.
 */
export function getMeteorFlameTopPad(variant: MeteorFlameVariant, flameBoxHeightPx: number): number {
  const top = FLAME_VIEWBOX_TOP[variant]
  return Math.ceil((flameBoxHeightPx * top) / FLAME_VIEWBOX_H) + 4
}

const EMBER_SHAPES = [
  'M 20 9 Q 23 13 20 17 Q 17 13 20 9 Z',
  'M 42 11 Q 45 15 42 19 Q 39 15 42 11 Z',
  'M 28 15 Q 31 19 28 23 Q 25 19 28 15 Z',
  'M 36 19 Q 39 23 36 27 Q 33 23 36 19 Z',
]

function flameRootTransform(variantScale: number, phase: number) {
  const pulse = 1 + Math.sin(phase * 2.4) * 0.022
  const sway = Math.sin(phase * 1.7 + 0.8) * 0.012
  const s = variantScale * pulse
  const sy = variantScale * (pulse - sway * 0.4)
  return `translate(${FLAME_PIVOT_X}, ${FLAME_PIVOT_Y}) scale(${s}, ${sy}) translate(${-FLAME_PIVOT_X}, ${-FLAME_PIVOT_Y})`
}

/** Same formula as the design canvas (`animTick * 0.12`). */
export function combineFlamePhase(flamePhase: number, flameAnimTick: number): number {
  return flamePhase + flameAnimTick * 0.12
}

export function MeteorFlameSvg({
  variant,
  phase,
}: {
  variant: MeteorFlameVariant
  phase: number
}) {
  const variantScale = FLAME_VARIANT_SCALE[variant]
  const outerD = Math.sin(phase * 2.8) > 0 ? METEOR_FLAME_OUTER_ALT : METEOR_FLAME_OUTER

  return (
    <Svg width="100%" height="100%" viewBox={flameViewBox(variant)} preserveAspectRatio="none">
      <G transform={flameRootTransform(variantScale, phase)}>
        <Path d={outerD} fill={FLAME_OUTER} />
        <Path d={METEOR_FLAME_MIDDLE} fill={FLAME_MIDDLE} />
        <Path d={METEOR_FLAME_INNER} fill={FLAME_INNER} />
        {EMBER_SHAPES.map((d, i) => {
          const x = Math.sin(phase * 2.2 + i * 1.6) * 2
          const y = Math.cos(phase * 1.9 + i) * 1.2
          return (
            <G key={`ember-${i}`} transform={`translate(${x}, ${y})`}>
              <Path d={d} fill={FLAME_OUTER} />
            </G>
          )
        })}
      </G>
    </Svg>
  )
}
