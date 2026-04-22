import { Pressable, StyleSheet, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { WonderBadgeImage } from './components/WonderBadgeImage'
import type { ProfileHeroBadgeSlots } from './profileHeroPreferences'
import { isWonderBadgeId, type WonderBadgeId } from './wonderBadgesCatalog'

const BADGE_SLOT = 38
const BADGE_RADIUS = 10
const BADGE_ICON = 18
const PROFILE_ACCENT = '#CBFF00'

type Mode = 'home' | 'edit'

export function ProfileHeroBadgeStrip({
  slots,
  mode,
  variant = 'standalone',
  onEmptySlot,
  onFilledSlot,
}: {
  slots: ProfileHeroBadgeSlots
  mode: Mode
  /** `inline`: no outer padding — sits in hero row beside name. */
  variant?: 'standalone' | 'inline'
  onEmptySlot?: (index: 0 | 1 | 2) => void
  onFilledSlot?: (index: 0 | 1 | 2) => void
}) {
  const rowStyle = [styles.row, variant === 'inline' ? styles.rowInline : null, styles.rowMinSize]

  if (mode === 'home') {
    const filledIndices = ([0, 1, 2] as const).filter((i) => Boolean(slots[i]))
    if (filledIndices.length === 0) return null

    return (
      <View style={rowStyle}>
        {filledIndices.map((i) => {
          const id = slots[i]!
          const showWonder = Boolean(isWonderBadgeId(id))
          return (
            <View
              key={i}
              style={[styles.slot, styles.slotProfileHome]}
              accessibilityRole="image"
              accessibilityLabel="Showcase badge"
            >
              {showWonder ? (
                <WonderBadgeImage
                  badgeId={id as WonderBadgeId}
                  size={BADGE_SLOT - 8}
                  fallbackColor={PROFILE_ACCENT}
                />
              ) : (
                <FeatherIcon name="award" size={BADGE_ICON} color={PROFILE_ACCENT} />
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
        const id = slots[i]
        const empty = !id
        const showWonder = Boolean(id && isWonderBadgeId(id))
        const slotStyle = [
          styles.slot,
          empty ? styles.slotEmpty : styles.slotFilled,
          !empty && showWonder ? styles.slotWonderPlate : null,
        ]
        const inner = empty ? (
          <FeatherIcon name="plus" size={BADGE_ICON} color="rgba(255,255,255,0.55)" />
        ) : showWonder ? (
          <WonderBadgeImage
            badgeId={id as WonderBadgeId}
            size={BADGE_SLOT - 8}
            fallbackColor={PROFILE_ACCENT}
          />
        ) : (
          <FeatherIcon name="award" size={BADGE_ICON} color={PROFILE_ACCENT} />
        )

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
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(203,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
  },
  slotWonderPlate: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(203,255,0,0.28)',
  },
  /** Profile home: badges only, no slot plate behind them. */
  slotProfileHome: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
})
