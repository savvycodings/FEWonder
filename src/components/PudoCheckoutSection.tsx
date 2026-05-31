import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import {
  PUDO_DELIVERY_HINT,
  PUDO_LOCKER_LABELS,
  PUDO_LOCKER_TIERS,
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
      <Text style={styles.sectionHeading}>Pudo delivery</Text>
      <Text style={styles.sectionHint}>
        {hasWholeSet
          ? 'Whole set orders use door delivery (R110).'
          : PUDO_DELIVERY_HINT}
      </Text>
      <View style={styles.optionRow}>
        {PUDO_LOCKER_TIERS.map((tier) => {
          const allowed = tierAllowedForCart(tier, hasWholeSet)
          const active = pudoLockerTier === tier
          return (
            <TouchableOpacity
              key={tier}
              style={[
                styles.optionChip,
                active ? styles.optionChipActive : null,
                !allowed ? styles.optionChipDisabled : null,
              ]}
              onPress={() => allowed && onPudoLockerTierChange(tier)}
              activeOpacity={allowed ? 0.85 : 1}
              disabled={!allowed}
            >
              <Text style={[styles.optionChipLabel, active ? styles.optionChipLabelActive : null]}>
                {PUDO_LOCKER_LABELS[tier]}
              </Text>
              <Text style={[styles.optionChipPrice, active ? styles.optionChipLabelActive : null]}>
                {formatTierPrice(tier)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <Text style={styles.fieldLabel}>Locker name or code</Text>
      <TextInput
        value={pudoName}
        onChangeText={onPudoNameChange}
        placeholder="e.g. Mall locker name"
        placeholderTextColor={theme.mutedForegroundColor}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>Locker address</Text>
      <TextInput
        value={pudoAddr}
        onChangeText={onPudoAddrChange}
        placeholder="Mall or Pudo point"
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
    optionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    optionChip: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface,
      alignItems: 'center',
    },
    optionChipActive: {
      borderWidth: 2,
      borderColor: theme.brandAccent,
    },
    optionChipDisabled: {
      opacity: 0.35,
    },
    optionChipLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
    },
    optionChipLabelActive: {
      color: theme.brandAccent,
    },
    optionChipPrice: {
      fontFamily: theme.boldFont,
      fontSize: 15,
      color: theme.mutedForegroundColor,
      marginTop: 4,
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
