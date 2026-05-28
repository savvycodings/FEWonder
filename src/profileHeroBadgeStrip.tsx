import { Pressable, StyleSheet, View } from 'react-native'
import { useContext, useMemo } from 'react'
import FeatherIcon from '@expo/vector-icons/Feather'
import { WonderBadgeImage } from './components/WonderBadgeImage'
import type { ProfileHeroBadgeSlots } from './profileHeroPreferences'
import { isWonderBadgeId, migrateWonderBadgeSlotId, type WonderBadgeId } from './wonderBadgesCatalog'
import { ThemeContext } from './context'
import { brandAccentRgba } from './brandAccent'

import { wonderBadgeVisualScale } from './wonderBadgeVisualScale'

const BADGE_SLOT = 38
const BADGE_RADIUS = 10
const BADGE_ICON = 18

type Mode = 'home' | 'edit'

export function ProfileHeroBadgeStrip({
  slots,
  mode,
  variant = 'standalone',
  slotSize = BADGE_SLOT,
  badgeGap,
  onEmptySlot,
  onFilledSlot,
}: {
  slots: ProfileHeroBadgeSlots
  mode: Mode
  /** `inline`: no outer padding — sits in hero row beside name. */
  variant?: 'standalone' | 'inline'
  /** Profile home: may shrink when the name needs horizontal room. */
  slotSize?: number
  badgeGap?: number
  onEmptySlot?: (index: 0 | 1 | 2) => void
  onFilledSlot?: (index: 0 | 1 | 2) => void
}) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStripStyles(theme), [theme])
  const accent = theme.brandAccent
  const safeSlot = Math.max(20, Math.round(slotSize))
  const imageSize = Math.max(14, safeSlot - 8)
  const iconSize = Math.max(12, Math.round(safeSlot * 0.47))
  const rowGap = badgeGap ?? (variant === 'inline' ? 6 : 8)
  const rowStyle = [
    styles.row,
    variant === 'inline' ? styles.rowInline : null,
    styles.rowMinSize,
    { gap: rowGap },
  ]

  if (mode === 'home') {
    const filledIndices = ([0, 1, 2] as const).filter((i) => Boolean(slots[i]))
    if (filledIndices.length === 0) return null

    return (
      <View style={rowStyle}>
        {filledIndices.map((i) => {
          const raw = slots[i]!
          const id = migrateWonderBadgeSlotId(raw) ?? raw
          const showWonder = Boolean(isWonderBadgeId(id))
          const wonderId = showWonder ? (id as WonderBadgeId) : null
          return (
            <View
              key={i}
              style={[
                styles.slot,
                styles.slotProfileHome,
                { width: safeSlot, height: safeSlot },
              ]}
              accessibilityRole="image"
              accessibilityLabel="Showcase badge"
            >
              {showWonder && wonderId ? (
                <WonderBadgeImage
                  badgeId={wonderId}
                  size={imageSize}
                  visualScale={wonderBadgeVisualScale(wonderId)}
                  fallbackColor={accent}
                />
              ) : (
                <FeatherIcon name="award" size={iconSize} color={accent} />
              )}
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <View style={rowStyle}>
      {([0, 1, 2] as const).map((i) => {
        const raw = slots[i]
        const id = raw ? migrateWonderBadgeSlotId(raw) ?? raw : null
        const empty = !id
        const showWonder = Boolean(id && isWonderBadgeId(id))
        const slotStyle = [
          styles.slot,
          { width: safeSlot, height: safeSlot },
          empty ? styles.slotEmptyLight : styles.slotFilledLight,
        ]
        const inner = showWonder ? (
          <WonderBadgeImage
            badgeId={id as WonderBadgeId}
            size={imageSize}
            visualScale={wonderBadgeVisualScale(id as WonderBadgeId)}
            fallbackColor={accent}
          />
        ) : !empty ? (
          <FeatherIcon name="award" size={iconSize} color={accent} />
        ) : null

        return (
          <Pressable
            key={i}
            style={slotStyle}
            onPress={() => {
              if (empty) onEmptySlot?.(i)
              else onFilledSlot?.(i)
            }}
            accessibilityRole="button"
            accessibilityLabel={empty ? 'Add badge from Wonder Store' : 'Remove badge from showcase'}
          >
            {inner}
            <View pointerEvents="none" style={styles.slotEditOverlay}>
              <FeatherIcon
                name={empty ? 'plus' : 'minus'}
                size={Math.max(14, Math.round(safeSlot * 0.38))}
                color="#ffffff"
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

function getStripStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  rowInline: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 6,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  /** Keeps three badge slots from shrinking when the name row wraps on small widths. */
  rowMinSize: {
    flexShrink: 0,
  },
  slot: {
    width: BADGE_SLOT,
    height: BADGE_SLOT,
    borderRadius: BADGE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  slotFilled: {
    backgroundColor: L(0.1),
    borderWidth: 1,
    borderColor: L(0.35),
  },
  slotWonderPlate: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: L(0.28),
  },
  /** Edit profile on light hero card — matches profile home showcase look. */
  slotEmptyLight: {
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
    borderStyle: 'dashed',
  },
  slotFilledLight: {
    backgroundColor: L(0.08),
    borderWidth: 1,
    borderColor: L(0.32),
    overflow: 'hidden',
  },
  slotEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BADGE_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Profile home: badges only, no slot plate behind them. */
  slotProfileHome: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
})
}
