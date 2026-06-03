import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import {
  FREE_DELIVERY_MESSAGE,
  PUDO_LOCKER_LABELS,
  PUDO_LOCKER_TIERS,
  formatTierPrice,
  qualifiesForFreeDeliveryZar,
  shippingHintForTier,
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
  shippingLine1: string
  onShippingLine1Change: (v: string) => void
  shippingLine2: string
  onShippingLine2Change: (v: string) => void
  shippingPostalCode: string
  onShippingPostalCodeChange: (v: string) => void
  shippingCity: string
  onShippingCityChange: (v: string) => void
  shippingProvince: string
  onShippingProvinceChange: (v: string) => void
  hasWholeSet: boolean
  subtotalZar: number
}

export function PudoCheckoutSection({
  theme,
  pudoLockerTier,
  onPudoLockerTierChange,
  pudoName,
  onPudoNameChange,
  pudoAddr,
  onPudoAddrChange,
  shippingLine1,
  onShippingLine1Change,
  shippingLine2,
  onShippingLine2Change,
  shippingPostalCode,
  onShippingPostalCodeChange,
  shippingCity,
  onShippingCityChange,
  shippingProvince,
  onShippingProvinceChange,
  hasWholeSet,
  subtotalZar,
}: Props) {
  const styles = useMemo(() => getStyles(theme), [theme])
  const isDoor = pudoLockerTier === 'door'
  const freeDelivery = qualifiesForFreeDeliveryZar(subtotalZar)

  return (
    <>
      <Text style={styles.sectionHeading}>Pudo delivery</Text>
      {freeDelivery ? (
        <Text style={styles.freeDeliveryBanner}>{FREE_DELIVERY_MESSAGE}</Text>
      ) : null}
      <Text style={styles.sectionHint}>
        {shippingHintForTier(pudoLockerTier, hasWholeSet, subtotalZar)}
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
                {formatTierPrice(tier, subtotalZar)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {isDoor ? (
        <>
          <Text style={styles.fieldLabel}>Address line 1</Text>
          <TextInput
            value={shippingLine1}
            onChangeText={onShippingLine1Change}
            placeholder="Street address, building, or complex"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="words"
            maxLength={120}
          />
          <Text style={styles.fieldLabel}>Address line 2</Text>
          <TextInput
            value={shippingLine2}
            onChangeText={onShippingLine2Change}
            placeholder="Apartment, suite, unit, floor"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="words"
            maxLength={80}
          />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Postal code</Text>
              <TextInput
                value={shippingPostalCode}
                onChangeText={(v) => onShippingPostalCodeChange(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                value={shippingCity}
                onChangeText={onShippingCityChange}
                placeholder="Cape Town"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.input}
                autoCapitalize="words"
                maxLength={60}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Province</Text>
          <TextInput
            value={shippingProvince}
            onChangeText={onShippingProvinceChange}
            placeholder="Western Cape"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="words"
            maxLength={60}
          />
        </>
      ) : (
        <>
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
      )}
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
    freeDeliveryBanner: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: theme.brandAccent,
      lineHeight: 17,
      marginBottom: 6,
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
    fieldRow: {
      flexDirection: 'row',
      gap: 10,
    },
    fieldHalf: {
      flex: 1,
      minWidth: 0,
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
