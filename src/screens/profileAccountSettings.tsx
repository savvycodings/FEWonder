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

const ACCENT = '#CBFF00'

type Props = {
  user: User
  sessionToken: string
  onUserUpdated: (user: User) => Promise<void>
}

export function ProfileAccountSettings({ user, sessionToken, onUserUpdated }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [fullName, setFullName] = useState(user.fullName || '')
  const [email, setEmail] = useState(user.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setFullName(user.fullName || '')
    setEmail(user.email || '')
  }, [user])

  const canSave = useMemo(
    () =>
      fullName.trim() !== (user.fullName || '') ||
      email.trim().toLowerCase() !== (user.email || '').toLowerCase(),
    [fullName, email, user]
  )

  async function onSave() {
    if (!canSave || saving) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const nextUser = await updateProfileDetails({
        sessionToken,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
      })
      await onUserUpdated(nextUser)
      setSuccess('Profile updated.')
    } catch (e: any) {
      setError(e?.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Update your account name and email.</Text>
        <View style={styles.accentRule} />
        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
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

const getStyles = (theme: any) =>
  StyleSheet.create({
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
      backgroundColor: ACCENT,
      marginBottom: 14,
    },
    card: {
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.3)',
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
      borderColor: 'rgba(203,255,0,0.22)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    saveButton: {
      minHeight: 42,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT,
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

