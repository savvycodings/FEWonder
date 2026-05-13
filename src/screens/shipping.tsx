import { useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ThemeContext } from '../context'
import { User } from '../../types'
import { updateProfileDetails } from '../utils'
import { brandAccentRgba } from '../brandAccent'

const ADDRESS_TEXT_PATTERN = /^[a-zA-Z0-9\s,.'#/-]+$/
const PLACE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z\s'.-]*$/

type AddressFieldErrors = {
  line1?: string
  line2?: string
  postalCode?: string
  city?: string
  province?: string
}

type Props = {
  user: User
  sessionToken: string
  onUserUpdated: (user: User) => Promise<void>
}

export function Shipping({ user, sessionToken, onUserUpdated }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [line1, setLine1] = useState(user.shippingAddress || '')
  const [line2, setLine2] = useState(user.shippingAddressLine2 || '')
  const [postalCode, setPostalCode] = useState(user.shippingPostalCode || '')
  const [city, setCity] = useState(user.shippingCity || '')
  const [province, setProvince] = useState(user.shippingProvince || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({})

  useEffect(() => {
    setLine1(user.shippingAddress || '')
    setLine2(user.shippingAddressLine2 || '')
    setPostalCode(user.shippingPostalCode || '')
    setCity(user.shippingCity || '')
    setProvince(user.shippingProvince || '')
  }, [user])

  const legacyAddressChanged = useMemo(
    () => line1.trim() !== (user.shippingAddress || '') || line2.trim() !== (user.shippingAddressLine2 || ''),
    [line1, line2, user]
  )

  const addressDetailsChanged = useMemo(
    () =>
      postalCode.trim() !== (user.shippingPostalCode || '') ||
      city.trim() !== (user.shippingCity || '') ||
      province.trim() !== (user.shippingProvince || ''),
    [city, postalCode, province, user]
  )

  const canSave = legacyAddressChanged || addressDetailsChanged

  function validateAddressFields() {
    const nextErrors: AddressFieldErrors = {}
    const trimmedLine1 = line1.trim()
    const trimmedLine2 = line2.trim()
    const trimmedPostalCode = postalCode.trim()
    const trimmedCity = city.trim()
    const trimmedProvince = province.trim()

    if (!trimmedLine1) {
      nextErrors.line1 = 'Address line 1 is required.'
    } else if (trimmedLine1.length < 5 || !ADDRESS_TEXT_PATTERN.test(trimmedLine1)) {
      nextErrors.line1 = 'Enter a valid street address.'
    }

    if (trimmedLine2 && !ADDRESS_TEXT_PATTERN.test(trimmedLine2)) {
      nextErrors.line2 = 'Enter a valid apartment, suite, or unit.'
    }

    if (!/^\d{4}$/.test(trimmedPostalCode)) {
      nextErrors.postalCode = 'Enter a valid 4-digit postal code.'
    }

    if (!trimmedCity) {
      nextErrors.city = 'City is required.'
    } else if (!PLACE_NAME_PATTERN.test(trimmedCity)) {
      nextErrors.city = 'Enter a valid city name.'
    }

    if (!trimmedProvince) {
      nextErrors.province = 'Province is required.'
    } else if (!PLACE_NAME_PATTERN.test(trimmedProvince)) {
      nextErrors.province = 'Enter a valid province.'
    }

    return nextErrors
  }

  function updateField(field: keyof AddressFieldErrors, value: string, setter: (nextValue: string) => void) {
    setter(value)
    setSuccess('')
    if (fieldErrors[field]) {
      setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    }
  }

  async function onSave() {
    if (!canSave || saving) return
    setError('')
    setSuccess('')
    const nextFieldErrors = validateAddressFields()
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      const nextUser = await updateProfileDetails({
        sessionToken,
        shippingAddress: line1.trim(),
        shippingAddressLine2: line2.trim(),
        shippingPostalCode: postalCode.trim(),
        shippingCity: city.trim(),
        shippingProvince: province.trim(),
      })
      await onUserUpdated(nextUser)
      setSuccess('Shipping address updated.')
    } catch (e: any) {
      setError(e?.message || 'Could not update shipping address.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Shipping address</Text>
        <Text style={styles.subtitle}>Save your main shipping address used during checkout.</Text>
        <View style={styles.accentRule} />
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Delivery details</Text>
          <Text style={styles.label}>Address line 1</Text>
          <TextInput
            value={line1}
            onChangeText={(value) => updateField('line1', value, setLine1)}
            placeholder="Street address, building, or complex"
            placeholderTextColor={theme.mutedForegroundColor}
            style={[styles.input, fieldErrors.line1 && styles.inputError]}
            autoCapitalize="words"
            maxLength={120}
          />
          {fieldErrors.line1 ? <Text style={styles.fieldErrorText}>{fieldErrors.line1}</Text> : null}
          <Text style={styles.label}>Address line 2</Text>
          <TextInput
            value={line2}
            onChangeText={(value) => updateField('line2', value, setLine2)}
            placeholder="Apartment, suite, unit, floor"
            placeholderTextColor={theme.mutedForegroundColor}
            style={[styles.input, fieldErrors.line2 && styles.inputError]}
            autoCapitalize="words"
            maxLength={80}
          />
          {fieldErrors.line2 ? <Text style={styles.fieldErrorText}>{fieldErrors.line2}</Text> : null}
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Postal code</Text>
              <TextInput
                value={postalCode}
                onChangeText={(value) => updateField('postalCode', value.replace(/\D/g, '').slice(0, 4), setPostalCode)}
                placeholder="0000"
                placeholderTextColor={theme.mutedForegroundColor}
                style={[styles.input, fieldErrors.postalCode && styles.inputError]}
                keyboardType="number-pad"
                maxLength={4}
              />
              {fieldErrors.postalCode ? <Text style={styles.fieldErrorText}>{fieldErrors.postalCode}</Text> : null}
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>City</Text>
              <TextInput
                value={city}
                onChangeText={(value) => updateField('city', value, setCity)}
                placeholder="Cape Town"
                placeholderTextColor={theme.mutedForegroundColor}
                style={[styles.input, fieldErrors.city && styles.inputError]}
                autoCapitalize="words"
                maxLength={60}
              />
              {fieldErrors.city ? <Text style={styles.fieldErrorText}>{fieldErrors.city}</Text> : null}
            </View>
          </View>
          <Text style={styles.label}>Province</Text>
          <TextInput
            value={province}
            onChangeText={(value) => updateField('province', value, setProvince)}
            placeholder="Western Cape"
            placeholderTextColor={theme.mutedForegroundColor}
            style={[styles.input, fieldErrors.province && styles.inputError]}
            autoCapitalize="words"
            maxLength={60}
          />
          {fieldErrors.province ? <Text style={styles.fieldErrorText}>{fieldErrors.province}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <TouchableOpacity
            style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
            onPress={onSave}
            disabled={!canSave || saving}
            activeOpacity={0.9}
          >
            {saving ? <ActivityIndicator color={theme.tintTextColor} /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    content: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 28,
    },
    title: {
      color: theme.headingColor || theme.textColor,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 30,
      marginBottom: 4,
    },
    subtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginBottom: 8,
    },
    accentRule: {
      width: 62,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.brandAccent,
      marginBottom: 14,
    },
    card: {
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: L(0.3),
      padding: 12,
    },
    sectionLabel: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 15,
      marginBottom: 12,
    },
    label: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: L(0.22),
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    inputError: {
      borderColor: '#ef4444',
    },
    fieldErrorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      fontSize: 11,
      marginTop: -6,
      marginBottom: 10,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: 10,
    },
    fieldHalf: {
      flex: 1,
    },
    saveButton: {
      minHeight: 42,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brandAccent,
      marginTop: 2,
    },
    saveButtonDisabled: { opacity: 0.45 },
    saveText: {
      color: '#050505',
      fontFamily: theme.boldFont,
      fontSize: 14,
    },
    errorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      marginBottom: 8,
    },
    successText: {
      color: '#22c55e',
      fontFamily: theme.mediumFont,
      marginBottom: 8,
    },
  })
}
