import { useContext, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext } from '../context'
import { loginUser, registerUser } from '../utils'
import { AuthPayload } from '../../types'

/** Align with `home.tsx` — lime accent, black chips; no gradient cards */
const HOME_ACCENT_BG = '#CBFF00'
const HOME_CHIP_FILL = '#000000'
const HOME_ACCENT_TEXT = '#000000'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const
/** Same as Home category chips (`home.tsx` HOME_CHIP_MONTSERRAT) */
const HOME_CHIP_MONTSERRAT = 'Montserrat_800ExtraBold' as const

type Props = {
  onAuthSuccess: (payload: AuthPayload) => Promise<void>
}

function digitsOnlyLen(s: string) {
  return s.replace(/\D/g, '').length
}

export function Login({ onAuthSuccess }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showOptionalSignup, setShowOptionalSignup] = useState(false)
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingAddressLine2, setShippingAddressLine2] = useState('')
  const [pudoLockerName, setPudoLockerName] = useState('')
  const [pudoLockerAddress, setPudoLockerAddress] = useState('')
  const [eftBankAccountName, setEftBankAccountName] = useState('')
  const [eftBankName, setEftBankName] = useState('')
  const [eftBankAccountNumber, setEftBankAccountNumber] = useState('')
  const [eftBankBranch, setEftBankBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** Space between focused field and keyboard; safe area for home indicator */
  const keyboardAwareBottomOffset = insets.bottom + 20
  const contentBottomPad = 28 + insets.bottom

  async function handleCreateAccount() {
    if (loading) return
    setError('')

    const normalizedFullName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.trim()

    if (mode === 'signup' && !normalizedFullName) {
      setError('Please enter your full name.')
      return
    }

    if (mode === 'signup' && digitsOnlyLen(normalizedPhone) < 9) {
      setError('Please enter a valid cellphone number.')
      return
    }

    if (!normalizedEmail || !password) {
      setError('Please fill in email and password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    try {
      setLoading(true)
      const authPayload =
        mode === 'signup'
          ? await registerUser({
              fullName: normalizedFullName,
              email: normalizedEmail,
              password,
              phone: normalizedPhone,
              shippingAddress: shippingAddress.trim(),
              shippingAddressLine2: shippingAddressLine2.trim(),
              pudoLockerName: pudoLockerName.trim(),
              pudoLockerAddress: pudoLockerAddress.trim(),
              eftBankAccountName: eftBankAccountName.trim(),
              eftBankName: eftBankName.trim(),
              eftBankAccountNumber: eftBankAccountNumber.trim(),
              eftBankBranch: eftBankBranch.trim(),
            })
          : await loginUser({
              email: normalizedEmail,
              password,
            })
      await onAuthSuccess(authPayload)
    } catch (registerError: any) {
      setError(registerError?.message || 'Failed to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <KeyboardAwareScrollView
          style={styles.flex}
          bottomOffset={keyboardAwareBottomOffset}
          extraKeyboardSpace={12}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, mode === 'signup' ? styles.titleCreateAccount : null]}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </Text>
          <View style={styles.accentRule} />
          <Text style={styles.subtitle}>
            {mode === 'signup'
              ? "We're excited to have you join the Wonderport community."
              : 'Sign in with your Wonderport email and password.'}
          </Text>

          <View style={styles.modeSwitchOuter}>
            <TouchableOpacity
              style={[styles.modeSegment, mode === 'signin' ? styles.modeSegmentActive : null]}
              onPress={() => {
                setMode('signin')
                setError('')
              }}
              activeOpacity={0.88}
            >
              <Text style={[styles.modeSegmentText, mode === 'signin' ? styles.modeSegmentTextActive : null]}>
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeSegment, mode === 'signup' ? styles.modeSegmentActive : null]}
              onPress={() => {
                setMode('signup')
                setError('')
              }}
              activeOpacity={0.88}
            >
              <Text style={[styles.modeSegmentText, mode === 'signup' ? styles.modeSegmentTextActive : null]}>
                Create account
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' ? (
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
              autoCapitalize="words"
            />
          ) : null}
          {mode === 'signup' ? (
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Cellphone (e.g. 082 000 0000)"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
              keyboardType="phone-pad"
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min 8 characters)"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            secureTextEntry
          />

          {mode === 'signup' ? (
            <>
              <TouchableOpacity
                style={styles.optionalToggle}
                onPress={() => setShowOptionalSignup(v => !v)}
                activeOpacity={0.85}
              >
                <FeatherIcon
                  name={showOptionalSignup ? 'chevron-down' : 'chevron-right'}
                  size={18}
                  color={HOME_ACCENT_BG}
                  style={styles.optionalChevron}
                />
                <Text style={styles.optionalToggleText}>
                  {showOptionalSignup ? 'Hide optional details' : 'Saved delivery & your bank (optional)'}
                </Text>
              </TouchableOpacity>
              {showOptionalSignup ? (
                <View style={styles.optionalCard}>
                  <Text style={styles.optionalHint}>
                    Stored on your profile for faster checkout. You can edit these later in Profile.
                  </Text>
                  <Text style={styles.fieldLabel}>Shipping</Text>
                  <TextInput
                    value={shippingAddress}
                    onChangeText={setShippingAddress}
                    placeholder="Full street address"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={[styles.input, styles.inputMultiline]}
                    multiline
                  />
                  <TextInput
                    value={shippingAddressLine2}
                    onChangeText={setShippingAddressLine2}
                    placeholder="Suburb, city, postal code (optional)"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Pudo locker (optional)</Text>
                  <TextInput
                    value={pudoLockerName}
                    onChangeText={setPudoLockerName}
                    placeholder="Locker name / code"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                  />
                  <TextInput
                    value={pudoLockerAddress}
                    onChangeText={setPudoLockerAddress}
                    placeholder="Locker location / mall address"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={[styles.input, styles.inputMultiline]}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Your bank (EFT matching, optional)</Text>
                  <TextInput
                    value={eftBankAccountName}
                    onChangeText={setEftBankAccountName}
                    placeholder="Account holder name"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                  />
                  <TextInput
                    value={eftBankName}
                    onChangeText={setEftBankName}
                    placeholder="Bank name"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                  />
                  <TextInput
                    value={eftBankAccountNumber}
                    onChangeText={setEftBankAccountNumber}
                    placeholder="Account number"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    value={eftBankBranch}
                    onChangeText={setEftBankBranch}
                    placeholder="Branch code (optional)"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.input}
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.88}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={HOME_ACCENT_TEXT} />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </Text>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    flex: { flex: 1 },
    content: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 11,
    },
    title: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 32,
      lineHeight: 38,
      color: theme.headingColor || theme.textColor,
      letterSpacing: -0.5,
    },
    titleCreateAccount: {
      fontFamily: HOME_CHIP_MONTSERRAT,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    /** Single solid accent bar — no gradient */
    accentRule: {
      width: 44,
      height: 3,
      borderRadius: 2,
      backgroundColor: HOME_ACCENT_BG,
      marginTop: 4,
      marginBottom: 2,
    },
    subtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 8,
    },
    /** Home-style chip strip: black shell, lime active pill */
    modeSwitchOuter: {
      flexDirection: 'row',
      backgroundColor: HOME_CHIP_FILL,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.28)',
      marginBottom: 4,
      gap: 4,
    },
    modeSegment: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeSegmentActive: {
      backgroundColor: HOME_ACCENT_BG,
    },
    modeSegmentText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: HOME_ACCENT_BG,
      opacity: 0.82,
    },
    modeSegmentTextActive: {
      color: HOME_ACCENT_TEXT,
      opacity: 1,
      fontFamily: theme.boldFont,
    },
    input: {
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      fontSize: 15,
    },
    inputMultiline: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    optionalToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 2,
      gap: 8,
    },
    optionalChevron: { marginTop: 1 },
    optionalToggleText: {
      flex: 1,
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: theme.textColor,
    },
    optionalCard: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    optionalHint: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      lineHeight: 19,
      marginBottom: 2,
    },
    fieldLabel: {
      fontFamily: theme.boldFont,
      fontSize: 11,
      color: HOME_ACCENT_BG,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 4,
      opacity: 0.92,
    },
    submitButton: {
      marginTop: 8,
      backgroundColor: HOME_ACCENT_BG,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    submitButtonDisabled: {
      opacity: 0.75,
    },
    submitText: {
      color: HOME_ACCENT_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 16,
    },
    errorText: {
      color: '#f87171',
      fontFamily: theme.mediumFont,
      fontSize: 13,
      lineHeight: 18,
    },
  })
