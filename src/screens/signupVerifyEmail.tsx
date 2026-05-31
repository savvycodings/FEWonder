import { useContext, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { OtpCodeInput } from '../components/OtpCodeInput'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { registerUser, requestAuthEmailCode, verifyAuthEmailCode } from '../utils'
import type { AuthPayload } from '../../types'

export type SignupDraft = {
  fullName: string
  email: string
  password: string
  phone: string
  shippingAddress: string
  shippingAddressLine2: string
  pudoLockerName: string
  pudoLockerAddress: string
  eftBankAccountName: string
  eftBankName: string
  eftBankAccountNumber: string
  eftBankBranch: string
}

type RouteParams = {
  draft: SignupDraft
}

type Props = {
  onAuthSuccess: (payload: AuthPayload) => Promise<void>
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.length <= 2 ? local[0] || '*' : `${local.slice(0, 2)}***`
  return `${visible}@${domain}`
}

export function SignupVerifyEmail({ onAuthSuccess }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const insets = useSafeAreaInsets()
  const draft = route.params?.draft as SignupDraft | undefined

  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sentOnMount = useRef(false)

  useEffect(() => {
    if (!draft?.email) {
      navigation.replace('Login')
      return
    }
    if (sentOnMount.current) return
    sentOnMount.current = true
    void sendCode()
  }, [draft?.email])

  async function sendCode() {
    if (!draft?.email) return
    setSending(true)
    setError('')
    try {
      await requestAuthEmailCode(draft.email, 'signup')
    } catch (e: any) {
      setError(e?.message || 'Could not send verification code.')
    } finally {
      setSending(false)
    }
  }

  async function onVerifyAndCreate() {
    if (!draft) return
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await verifyAuthEmailCode({ email: draft.email, otp, purpose: 'signup' })
      const authPayload = await registerUser({
        fullName: draft.fullName,
        email: draft.email,
        password: draft.password,
        phone: draft.phone,
        shippingAddress: draft.shippingAddress,
        shippingAddressLine2: draft.shippingAddressLine2,
        pudoLockerName: draft.pudoLockerName,
        pudoLockerAddress: draft.pudoLockerAddress,
        eftBankAccountName: draft.eftBankAccountName,
        eftBankName: draft.eftBankName,
        eftBankAccountNumber: draft.eftBankAccountNumber,
        eftBankBranch: draft.eftBankBranch,
      })
      await onAuthSuccess(authPayload)
    } catch (e: any) {
      setError(e?.message || 'Could not verify code or create account.')
    } finally {
      setBusy(false)
    }
  }

  if (!draft) {
    return null
  }

  const disabled = busy || sending

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Verify your email</Text>
        <View style={styles.accentRule} />
        <Text style={styles.subtitle}>
          {sending
            ? 'Sending your verification code…'
            : 'Enter the code we sent to finish creating your account.'}
        </Text>

        <Text style={styles.emailLabel}>{maskEmail(draft.email)}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <OtpCodeInput
          value={otp}
          onChange={setOtp}
          disabled={disabled}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
          onPress={() => void onVerifyAndCreate()}
          disabled={disabled}
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator color="#050505" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify & create account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendLink}
          onPress={() => void sendCode()}
          disabled={disabled}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={theme.brandAccent} size="small" />
          ) : (
            <Text style={styles.resendText}>Resend code</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

function getStyles(theme: any) {
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
      marginBottom: 12,
      lineHeight: 20,
    },
    emailLabel: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 15,
      marginBottom: 12,
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
    resendLink: {
      alignItems: 'center',
      marginTop: 16,
      minHeight: 32,
      justifyContent: 'center',
    },
    resendText: {
      color: theme.brandAccent,
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    errorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      marginBottom: 10,
    },
  })
}
