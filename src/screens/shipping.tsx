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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setLine1(user.shippingAddress || '')
    setLine2(user.shippingAddressLine2 || '')
  }, [user])

  const canSave = useMemo(
    () => line1.trim() !== (user.shippingAddress || '') || line2.trim() !== (user.shippingAddressLine2 || ''),
    [line1, line2, user]
  )

  async function onSave() {
    if (!canSave || saving) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const nextUser = await updateProfileDetails({
        sessionToken,
        shippingAddress: line1.trim(),
        shippingAddressLine2: line2.trim(),
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
          <Text style={styles.label}>Address line 1</Text>
          <TextInput
            value={line1}
            onChangeText={setLine1}
            placeholder="Street, suburb, city"
            placeholderTextColor={theme.mutedForegroundColor}
            style={[styles.input, styles.inputMulti]}
            multiline
          />
          <Text style={styles.label}>Address line 2</Text>
          <TextInput
            value={line2}
            onChangeText={setLine2}
            placeholder="Postal code, extra details"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />
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
    inputMulti: {
      minHeight: 76,
      textAlignVertical: 'top',
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
