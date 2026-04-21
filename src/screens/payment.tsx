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

export function Payment({ user, sessionToken, onUserUpdated }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  const [phone, setPhone] = useState(user.phone || '')
  const [eftAccountName, setEftAccountName] = useState(user.eftBankAccountName || '')
  const [eftBankName, setEftBankName] = useState(user.eftBankName || '')
  const [eftAccountNo, setEftAccountNo] = useState(user.eftBankAccountNumber || '')
  const [eftBranch, setEftBranch] = useState(user.eftBankBranch || '')
  const [pudoName, setPudoName] = useState(user.pudoLockerName || '')
  const [pudoAddress, setPudoAddress] = useState(user.pudoLockerAddress || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setPhone(user.phone || '')
    setEftAccountName(user.eftBankAccountName || '')
    setEftBankName(user.eftBankName || '')
    setEftAccountNo(user.eftBankAccountNumber || '')
    setEftBranch(user.eftBankBranch || '')
    setPudoName(user.pudoLockerName || '')
    setPudoAddress(user.pudoLockerAddress || '')
  }, [user])

  const canSave = useMemo(() => {
    return (
      phone.trim() !== (user.phone || '') ||
      eftAccountName.trim() !== (user.eftBankAccountName || '') ||
      eftBankName.trim() !== (user.eftBankName || '') ||
      eftAccountNo.trim() !== (user.eftBankAccountNumber || '') ||
      eftBranch.trim() !== (user.eftBankBranch || '') ||
      pudoName.trim() !== (user.pudoLockerName || '') ||
      pudoAddress.trim() !== (user.pudoLockerAddress || '')
    )
  }, [phone, eftAccountName, eftBankName, eftAccountNo, eftBranch, pudoName, pudoAddress, user])

  async function onSave() {
    if (!canSave || saving) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const nextUser = await updateProfileDetails({
        sessionToken,
        phone: phone.trim(),
        eftBankAccountName: eftAccountName.trim(),
        eftBankName: eftBankName.trim(),
        eftBankAccountNumber: eftAccountNo.trim(),
        eftBankBranch: eftBranch.trim(),
        pudoLockerName: pudoName.trim(),
        pudoLockerAddress: pudoAddress.trim(),
      })
      await onUserUpdated(nextUser)
      setSuccess('Billing details updated.')
    } catch (e: any) {
      setError(e?.message || 'Could not update billing details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Payments & billing</Text>
        <Text style={styles.subtitle}>Manage your EFT and billing information.</Text>
        <View style={styles.accentRule} />
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <Text style={styles.label}>Cellphone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="082 000 0000"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>EFT account name</Text>
          <TextInput
            value={eftAccountName}
            onChangeText={setEftAccountName}
            placeholder="Account holder"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />

          <Text style={styles.label}>EFT bank name</Text>
          <TextInput
            value={eftBankName}
            onChangeText={setEftBankName}
            placeholder="Bank name"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />

          <Text style={styles.label}>EFT account number</Text>
          <TextInput
            value={eftAccountNo}
            onChangeText={setEftAccountNo}
            placeholder="Account number"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>EFT branch code</Text>
          <TextInput
            value={eftBranch}
            onChangeText={setEftBranch}
            placeholder="Branch code"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />

          <Text style={styles.label}>Pudo locker name</Text>
          <TextInput
            value={pudoName}
            onChangeText={setPudoName}
            placeholder="Locker code or name"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />

          <Text style={styles.label}>Pudo locker address</Text>
          <TextInput
            value={pudoAddress}
            onChangeText={setPudoAddress}
            placeholder="Locker location"
            placeholderTextColor={theme.mutedForegroundColor}
            style={[styles.input, styles.inputMulti]}
            multiline
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
        </TouchableOpacity>
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
    inputMulti: {
      minHeight: 76,
      textAlignVertical: 'top',
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
