import { useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { PasswordInput, ProfileStackBackBar } from '../components'
import { User } from '../../types'
import { changePassword, updateProfileDetails } from '../utils'
import {
  clampProfileDisplayNameInput,
  isProfileDisplayNameValid,
  MAX_PROFILE_DISPLAY_NAME_LENGTH,
  normalizeProfileDisplayName,
  PROFILE_DISPLAY_NAME_LENGTH_HINT,
} from '../profileDisplayName'
import { brandAccentRgba } from '../brandAccent'

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
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  function closePasswordForm() {
    setShowPasswordForm(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordError('')
    setPasswordSuccess('')
  }

  function openPasswordForm() {
    setPasswordError('')
    setPasswordSuccess('')
    setShowPasswordForm(true)
  }

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

  const canChangePassword = useMemo(
    () =>
      currentPassword.length > 0 && newPassword.length >= 8 && confirmNewPassword.length > 0,
    [currentPassword, newPassword, confirmNewPassword],
  )

  async function onChangePassword() {
    if (!canChangePassword || passwordBusy) return
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.')
      setPasswordSuccess('')
      return
    }
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordBusy(true)
    try {
      await changePassword({
        sessionToken,
        currentPassword,
        newPassword,
        confirmNewPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPasswordSuccess('Password updated.')
    } catch (e: any) {
      setPasswordError(e?.message || 'Could not change password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function onSave() {
    if (!canSave || saving) return
    if (!isProfileDisplayNameValid(fullName)) {
      setError(
        fullName.trim().length === 0
          ? 'Please enter your name.'
          : `Name must be ${MAX_PROFILE_DISPLAY_NAME_LENGTH} characters or fewer.`,
      )
      return
    }
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const nextUser = await updateProfileDetails({
        sessionToken,
        fullName: normalizeProfileDisplayName(fullName),
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
    <View style={styles.page}>
      <ProfileStackBackBar backLabel="Settings" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Update your account name and email.</Text>
        <View style={styles.accentRule} />
        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={(text) => setFullName(clampProfileDisplayNameInput(text))}
            placeholder="Full name"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            maxLength={MAX_PROFILE_DISPLAY_NAME_LENGTH}
          />
          <Text style={styles.fieldHint}>{PROFILE_DISPLAY_NAME_LENGTH_HINT}</Text>
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

        {!showPasswordForm ? (
          <Pressable
            style={styles.actionRow}
            onPress={openPasswordForm}
            accessibilityRole="button"
            accessibilityLabel="Change password"
          >
            <FeatherIcon name="lock" size={18} color={theme.brandAccent} />
            <Text style={styles.actionRowText}>Change password</Text>
            <FeatherIcon name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
          </Pressable>
        ) : (
          <View style={styles.card}>
            <View style={styles.passwordCardHeader}>
              <Text style={styles.passwordCardTitle}>Change password</Text>
              <Pressable onPress={closePasswordForm} hitSlop={10} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionHint}>
              Forgot your password? Sign out and use Forgot password on the sign-in screen.
            </Text>
            <Text style={styles.label}>Current password</Text>
            <PasswordInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
            />
            <Text style={styles.label}>New password</Text>
            <PasswordInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
            />
            <Text style={styles.label}>Confirm new password</Text>
            <PasswordInput
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Repeat new password"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            {passwordSuccess ? <Text style={styles.successText}>{passwordSuccess}</Text> : null}
            <TouchableOpacity
              style={[styles.saveButton, (!canChangePassword || passwordBusy) && styles.saveButtonDisabled]}
              onPress={onChangePassword}
              disabled={!canChangePassword || passwordBusy}
              activeOpacity={0.9}
            >
              {passwordBusy ? (
                <ActivityIndicator color={theme.tintTextColor} />
              ) : (
                <Text style={styles.saveText}>Update password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    flex: { flex: 1 },
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: L(0.22),
    },
    actionRowText: {
      flex: 1,
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
    },
    passwordCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    passwordCardTitle: {
      color: theme.headingColor || theme.textColor,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 16,
    },
    cancelText: {
      color: theme.brandAccent,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
    sectionHint: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    },
    card: {
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: L(0.3),
      padding: 12,
      marginTop: 14,
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
      marginBottom: 4,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    fieldHint: {
      marginBottom: 10,
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
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
