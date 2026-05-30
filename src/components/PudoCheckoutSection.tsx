import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import {
  PUDO_LOCKER_LABELS,
  PUDO_LOCKER_TIERS,
  PUDO_SIZE_DISCLAIMER,
  formatTierPrice,
  tierAllowedForCart,
  type PudoLockerTier,
} from '../pudoLockerSizes'

type Props = {
  theme: any
  pudoLockerTier: PudoLockerTier
  onPudoLockerTierChange: (tier: PudoLockerTier) => void
  pudoName: string
  onPudoNameChange: (v: string) => void
  pudoAddr: string
  onPudoAddrChange: (v: string) => void
  hasWholeSet: boolean
}

export function PudoCheckoutSection({
  theme,
  pudoLockerTier,
  onPudoLockerTierChange,
  pudoName,
  onPudoNameChange,
  pudoAddr,
  onPudoAddrChange,
  hasWholeSet,
}: Props) {
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <>
      <Text style={styles.sectionHeading}>Pudo locker delivery</Text>
      <Text style={styles.sectionHint}>
        {hasWholeSet
          ? 'Whole set orders — choose Large or Extra large.'
          : 'Choose the locker size that best fits your order.'}
      </Text>
      <View style={styles.sizeGrid}>
        {PUDO_LOCKER_TIERS.map((tier) => {
          const allowed = tierAllowedForCart(tier, hasWholeSet)
          const active = pudoLockerTier === tier
          return (
            <TouchableOpacity
              key={tier}
              style={[
                styles.sizeChip,
                active ? styles.sizeChipActive : null,
                !allowed ? styles.sizeChipDisabled : null,
              ]}
              onPress={() => allowed && onPudoLockerTierChange(tier)}
              activeOpacity={allowed ? 0.85 : 1}
              disabled={!allowed}
            >
              <Text style={[styles.sizeChipLabel, active ? styles.sizeChipLabelActive : null]}>
                {PUDO_LOCKER_LABELS[tier]}
              </Text>
              <Text style={[styles.sizeChipPrice, active ? styles.sizeChipLabelActive : null]}>
                {formatTierPrice(tier)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <Text style={styles.disclaimer}>{PUDO_SIZE_DISCLAIMER}</Text>
      <Text style={styles.fieldLabel}>Pudo locker name / code</Text>
      <TextInput
        value={pudoName}
        onChangeText={onPudoNameChange}
        placeholder="Locker name"
        placeholderTextColor={theme.mutedForegroundColor}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>Pudo locker address</Text>
      <TextInput
        value={pudoAddr}
        onChangeText={onPudoAddrChange}
        placeholder="Mall / location"
        placeholderTextColor={theme.mutedForegroundColor}
        style={[styles.input, styles.inputMultiline]}
        multiline
      />
    </>
  )
}

function getStyles(theme: any) {
  const border = theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.12)'
  const surface = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  return StyleSheet.create({
    sectionHeading: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
      marginTop: 4,
      marginBottom: 4,
    },
    sectionHint: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      lineHeight: 17,
      marginBottom: 10,
    },
    sizeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    sizeChip: {
      width: '48%',
      flexGrow: 1,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface,
    },
    sizeChipActive: {
      borderWidth: 2,
      borderColor: theme.brandAccent,
    },
    sizeChipDisabled: {
      opacity: 0.35,
    },
    sizeChipLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: theme.textColor,
    },
    sizeChipLabelActive: {
      color: theme.brandAccent,
    },
    sizeChipPrice: {
      fontFamily: theme.boldFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      marginTop: 2,
    },
    disclaimer: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      lineHeight: 16,
      marginBottom: 8,
    },
    fieldLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: theme.textColor,
      backgroundColor: surface,
    },
    inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  })
}
