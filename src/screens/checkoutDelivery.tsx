import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useRoute } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { FLOATING_TAB_BAR_BOTTOM } from '../tabBarLayout'
import { ProfilePageHeading, ProfileStackBackBar, PudoCheckoutSection } from '../components'
import { AppContext, ThemeContext } from '../context'
import {
  type CheckoutDeliveryDetails,
  type CheckoutFlowSource,
  type CheckoutLineItem,
  cartItemsToCheckoutLines,
  checkoutHasWholeSet,
  deliveryPrefillFromUser,
  validateCheckoutDelivery,
} from '../checkoutFlow'
import { defaultTierForCart } from '../pudoLockerSizes'
import type { User } from '../../types'
import { fetchSessionUser, getUserSessionToken, readStoredAuthPayload, redeemWonderCode } from '../utils'
import { brandAccentRgba } from '../brandAccent'

const ACCENT_ON_BADGE_TEXT = '#ffffff'

type RouteParams = {
  from?: CheckoutFlowSource
  items?: CheckoutLineItem[]
}

export function CheckoutDelivery({ navigation }: { navigation: any }) {
  const { theme } = useContext(ThemeContext)
  const { cartItems } = useContext(AppContext)
  const route = useRoute()
  const params = (route.params || {}) as RouteParams
  const styles = useMemo(() => getStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  /** Align footer with floating tab bar height (root stack screens sit above the tab pill). */
  const footerBottomPad = insets.bottom + FLOATING_TAB_BAR_BOTTOM + 12
  const scrollBottomPad = 24 + 58 + footerBottomPad

  const from: CheckoutFlowSource = params.from === 'product' ? 'product' : 'cart'
  const items = useMemo<CheckoutLineItem[]>(() => {
    if (Array.isArray(params.items) && params.items.length) {
      return params.items.map((line) => ({
        productId: String(line.productId),
        quantity: Math.max(1, Math.min(99, Math.floor(Number(line.quantity) || 1))),
        packaging: line.packaging === 'set' ? 'set' : 'single',
      }))
    }
    return cartItemsToCheckoutLines(cartItems)
  }, [params.items, cartItems])

  const hasWholeSet = useMemo(() => checkoutHasWholeSet(items), [items])

  const [pudoLockerTier, setPudoLockerTier] = useState(() => defaultTierForCart(hasWholeSet))
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [pudoName, setPudoName] = useState('')
  const [pudoAddr, setPudoAddr] = useState('')
  const [shippingLine1, setShippingLine1] = useState('')
  const [shippingLine2, setShippingLine2] = useState('')
  const [shippingPostalCode, setShippingPostalCode] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingProvince, setShippingProvince] = useState('')
  const [customerEftName, setCustomerEftName] = useState('')
  const [customerEftBank, setCustomerEftBank] = useState('')
  const [customerEftAcct, setCustomerEftAcct] = useState('')
  const [formError, setFormError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')
  const lastProfileUserRef = useRef<Partial<User> | null>(null)

  const applyProfilePrefill = useCallback((user: Partial<User>) => {
    lastProfileUserRef.current = user
    const p = deliveryPrefillFromUser(user)
    const fill = (current: string, next: string) => (current.trim() ? current : next)
    setContactEmail((v) => fill(v, p.contactEmail))
    setContactPhone((v) => fill(v, p.contactPhone))
    setPudoName((v) => fill(v, p.pudoName))
    setPudoAddr((v) => fill(v, p.pudoAddr))
    setShippingLine1((v) => fill(v, p.shippingLine1))
    setShippingLine2((v) => fill(v, p.shippingLine2))
    setShippingPostalCode((v) => fill(v, p.shippingPostalCode))
    setShippingCity((v) => fill(v, p.shippingCity))
    setShippingProvince((v) => fill(v, p.shippingProvince))
    setCustomerEftName((v) => fill(v, p.customerEftName))
    setCustomerEftBank((v) => fill(v, p.customerEftBank))
    setCustomerEftAcct((v) => fill(v, p.customerEftAcct))
  }, [])

  useEffect(() => {
    if (!items.length) {
      navigation.goBack()
    }
  }, [items.length, navigation])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      ;(async () => {
        const stored = await readStoredAuthPayload()
        if (!cancelled && stored?.user) {
          applyProfilePrefill(stored.user)
        }
        const token = stored?.sessionToken || (await getUserSessionToken())
        if (!token || cancelled) return
        try {
          const remote = await fetchSessionUser(token)
          if (!cancelled) applyProfilePrefill(remote)
        } catch {
          /* keep cached profile prefill */
        }
      })()
      return () => {
        cancelled = true
      }
    }, [applyProfilePrefill]),
  )

  useEffect(() => {
    if (pudoLockerTier === 'door' && lastProfileUserRef.current) {
      applyProfilePrefill(lastProfileUserRef.current)
    }
  }, [pudoLockerTier, applyProfilePrefill])

  useEffect(() => {
    if (hasWholeSet && pudoLockerTier !== 'door') {
      setPudoLockerTier('door')
    }
  }, [hasWholeSet, pudoLockerTier])

  async function onApplyPromoCode() {
    const trimmed = promoCode.trim()
    if (!trimmed) {
      setPromoError('Enter a code.')
      setPromoSuccess('')
      return
    }
    const token = await getUserSessionToken()
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in to redeem a code.')
      return
    }
    setPromoBusy(true)
    setPromoError('')
    setPromoSuccess('')
    try {
      const result = await redeemWonderCode(token, trimmed)
      setPromoSuccess(result.message)
      setPromoCode('')
    } catch (e: any) {
      setPromoError(e?.message || 'Could not redeem code.')
    } finally {
      setPromoBusy(false)
    }
  }

  function buildDeliveryDetails(): CheckoutDeliveryDetails {
    const base: CheckoutDeliveryDetails = {
      pudoLockerTier,
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      pudoLockerName: pudoName.trim(),
      pudoLockerAddress: pudoAddr.trim(),
      customerEftAccountName: customerEftName.trim() || undefined,
      customerEftBankName: customerEftBank.trim() || undefined,
      customerEftAccountNumber: customerEftAcct.trim() || undefined,
    }
    if (pudoLockerTier === 'door') {
      base.shippingAddress = shippingLine1.trim()
      base.shippingAddressLine2 = shippingLine2.trim()
      base.shippingPostalCode = shippingPostalCode.trim()
      base.shippingCity = shippingCity.trim()
      base.shippingProvince = shippingProvince.trim()
      base.pudoLockerName = ''
      base.pudoLockerAddress = ''
    }
    return base
  }

  function onContinueToPayment() {
    Keyboard.dismiss()
    setFormError('')
    const delivery = buildDeliveryDetails()
    const err = validateCheckoutDelivery(delivery, hasWholeSet)
    if (err) {
      setFormError(err)
      return
    }
    navigation.navigate('CartCheckout', {
      from,
      items,
      delivery,
    })
  }

  if (!items.length) {
    return null
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeTop} edges={['top', 'left', 'right']}>
        <ProfileStackBackBar onBack={() => navigation.goBack()} />
        <ProfilePageHeading title="Delivery & contact" />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>Redeem Code (Optional)</Text>
          <View style={styles.promoRow}>
            <TextInput
              value={promoCode}
              onChangeText={(t) => {
                setPromoCode(t)
                setPromoError('')
              }}
              placeholder="Enter your code"
              placeholderTextColor={theme.mutedForegroundColor}
              style={[styles.input, styles.promoInput]}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!promoBusy}
            />
            <Pressable
              style={[styles.promoApplyBtn, promoBusy && styles.promoApplyBtnDisabled]}
              onPress={() => void onApplyPromoCode()}
              disabled={promoBusy}
            >
              {promoBusy ? (
                <ActivityIndicator color={ACCENT_ON_BADGE_TEXT} size="small" />
              ) : (
                <Text style={styles.promoApplyText}>Apply</Text>
              )}
            </Pressable>
          </View>
          {promoError ? <Text style={styles.errorText}>{promoError}</Text> : null}
          {promoSuccess ? <Text style={styles.successText}>{promoSuccess}</Text> : null}

          <Text style={styles.sectionLabel}>Contact</Text>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.fieldLabel}>Cellphone</Text>
          <TextInput
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="082 000 0000"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            keyboardType="phone-pad"
          />

          <PudoCheckoutSection
            theme={theme}
            pudoLockerTier={pudoLockerTier}
            onPudoLockerTierChange={setPudoLockerTier}
            pudoName={pudoName}
            onPudoNameChange={setPudoName}
            pudoAddr={pudoAddr}
            onPudoAddrChange={setPudoAddr}
            shippingLine1={shippingLine1}
            onShippingLine1Change={setShippingLine1}
            shippingLine2={shippingLine2}
            onShippingLine2Change={setShippingLine2}
            shippingPostalCode={shippingPostalCode}
            onShippingPostalCodeChange={setShippingPostalCode}
            shippingCity={shippingCity}
            onShippingCityChange={setShippingCity}
            shippingProvince={shippingProvince}
            onShippingProvinceChange={setShippingProvince}
            hasWholeSet={hasWholeSet}
          />

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Your bank (optional)</Text>
          <Text style={styles.fieldLabel}>Account holder</Text>
          <TextInput
            value={customerEftName}
            onChangeText={setCustomerEftName}
            placeholder="Name on account"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Bank name</Text>
          <TextInput
            value={customerEftBank}
            onChangeText={setCustomerEftBank}
            placeholder="e.g. FNB"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Account number</Text>
          <TextInput
            value={customerEftAcct}
            onChangeText={setCustomerEftAcct}
            placeholder="Account number"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            keyboardType="number-pad"
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
          <Pressable style={styles.continueBtn} onPress={onContinueToPayment}>
            <Text style={styles.continueText}>Continue to payment</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const pageBg = theme.appBackgroundColor || theme.backgroundColor
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const textPrimary = theme.textColor
  const textMuted = theme.mutedForegroundColor
  const surfaceBorder = L(0.3)
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: pageBg },
    safeTop: { backgroundColor: pageBg },
    flex: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    sectionLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: textPrimary,
      marginTop: 4,
      marginBottom: 4,
    },
    sectionLabelSpaced: {
      marginTop: 12,
    },
    fieldLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: textMuted,
      marginBottom: 6,
      marginTop: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: textPrimary,
      backgroundColor: frameFill,
    },
    promoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    promoInput: { flex: 1, marginBottom: 0 },
    promoApplyBtn: {
      minWidth: 72,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.brandAccent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    promoApplyBtnDisabled: { opacity: 0.7 },
    promoApplyText: {
      color: ACCENT_ON_BADGE_TEXT,
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
    },
    errorText: {
      color: '#f87171',
      fontFamily: theme.mediumFont,
      fontSize: 13,
      marginTop: 8,
    },
    successText: {
      color: '#4ade80',
      fontFamily: theme.mediumFont,
      fontSize: 13,
      marginTop: 8,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: surfaceBorder,
      backgroundColor: pageBg,
    },
    continueBtn: {
      backgroundColor: theme.brandAccent,
      borderRadius: 14,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueText: {
      color: ACCENT_ON_BADGE_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 16,
    },
  })
}
