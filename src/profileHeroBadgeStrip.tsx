import { Pressable, StyleSheet, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import type { ProfileHeroBadgeSlots } from './profileHeroPreferences'

const BADGE_SLOT = 48
const BADGE_RADIUS = 12
const PROFILE_ACCENT = '#CBFF00'

type Mode = 'home' | 'edit'

export function ProfileHeroBadgeStrip({
  slots,
  mode,
  variant = 'standalone',
  onOpenEdit,
  onEmptySlot,
  onFilledSlot,
}: {
  slots: ProfileHeroBadgeSlots
  mode: Mode
  /** `inline`: no outer padding — sits in hero row beside name. */
  variant?: 'standalone' | 'inline'
  onOpenEdit?: () => void
  onEmptySlot?: (index: 0 | 1 | 2) => void
  onFilledSlot?: (index: 0 | 1 | 2) => void
}) {
  return (
    <View style={[styles.row, variant === 'inline' ? styles.rowInline : null]}>
      {([0, 1, 2] as const).map((i) => {
        const id = slots[i]
        const empty = !id
        return (
          <Pressable
            key={i}
            style={[styles.slot, empty ? styles.slotEmpty : styles.slotFilled]}
            onPress={() => {
              if (mode === 'home') {
                onOpenEdit?.()
                return
              }
              if (empty) onEmptySlot?.(i)
              else onFilledSlot?.(i)
            }}
            accessibilityRole="button"
            accessibilityLabel={empty ? 'Add badge from Wonder Store' : 'Badge slot'}
          >
            {empty ? (
              <FeatherIcon name="plus" size={22} color="rgba(255,255,255,0.55)" />
            ) : (
              <FeatherIcon name="award" size={22} color={PROFILE_ACCENT} />
            )}
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
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  rowInline: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 8,
    alignItems: 'flex-start',
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
})
