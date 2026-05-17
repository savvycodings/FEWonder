import { useContext, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ThemeContext } from '../context'
import {
  requestForgotPasswordOtp,
  resetPasswordWithOtp,
  verifyForgotPasswordOtp,
} from '../utils'
import { brandAccentRgba } from '../brandAccent'

type Step = 'email' | 'otp' | 'password'

export function ForgotPassword() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function onRequestCode() {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      setError('Enter your account email.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const res = await requestForgotPasswordOtp(normalized)
      setStep('otp')
      setInfo(
        res.devHint
          ? 'Check your email for a code. In development, the code is also printed in the API server console.'
          : 'If an account exists for this email, we sent a 6-digit code. It expires in 15 minutes.',
      )
    } catch (e: any) {
      setError(e?.message || 'Could not send code.')
    } finally {
      setBusy(false)
    }
  }

  async function onVerifyCode() {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await verifyForgotPasswordOtp(email, otp)
      setStep('password')
      setInfo('Code verified. Choose a new password.')
    } catch (e: any) {
      setError(e?.message || 'Invalid code.')
    } finally {
      setBusy(false)
    }
  }

  async function onResetPassword() {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await resetPasswordWithOtp({
        email,
        otp,
        newPassword,
        confirmNewPassword,
      })
      navigation.navigate('Login')
    } catch (e: any) {
      setError(e?.message || 'Could not reset password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow} hitSlop={12}>
          <Text style={styles.backText}>← Back to sign in</Text>
        </Pressable>

        <Text style={styles.title}>Reset password</Text>
        <View style={styles.accentRule} />
        <Text style={styles.subtitle}>
          {step === 'email'
            ? 'We will email you a one-time code to reset your password.'
            : step === 'otp'
              ? 'Enter the verification code we sent to your email.'
              : 'Set a new password for your account.'}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={theme.mutedForegroundColor}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={step === 'email' && !busy}
        />

        {step !== 'email' ? (
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="6-digit code"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={6}
            editable={step === 'otp' && !busy}
          />
        ) : null}

        {step === 'password' ? (
          <>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
              secureTextEntry
            />
            <TextInput
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm new password"
              placeholderTextColor={theme.mutedForegroundColor}
              style={styles.input}
              secureTextEntry
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
          onPress={() => {
            if (step === 'email') void onRequestCode()
            else if (step === 'otp') void onVerifyCode()
            else void onResetPassword()
          }}
          disabled={busy}
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator color="#050505" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 'email' ? 'Send code' : step === 'otp' ? 'Verify code' : 'Update password'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    content: { paddingHorizontal: 20, paddingTop: 8 },
    backRow: { marginBottom: 16 },
    backText: {
      color: theme.brandAccent,
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    title: {
      color: theme.headingColor || theme.textColor,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 28,
      marginBottom: 4,
    },
    accentRule: {
      width: 62,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.brandAccent,
      marginBottom: 12,
    },
    subtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 14,
      marginBottom: 16,
      lineHeight: 20,
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
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brandAccent,
      marginTop: 6,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: {
      color: '#050505',
      fontFamily: theme.boldFont,
      fontSize: 15,
    },
    errorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      marginBottom: 8,
    },
    infoText: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginBottom: 8,
      lineHeight: 18,
    },
  })
}
