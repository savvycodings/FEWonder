import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useFocusEffect, useRoute } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { FLOATING_TAB_BAR_BOTTOM } from '../tabBarLayout'
import { PaymentMethodModal, ProfilePageHeading, ProfileStackBackBar, PudoCheckoutSection, CheckoutWonderCoinsSection } from '../components'
import { AppContext, ThemeContext } from '../context'
import { SHOW_YOCO_CHECKOUT } from '../../constants'
import { getCartStockError } from '../productStock'
import {
  type CheckoutDeliveryDetails,
  type CheckoutFlowSource,
  type CheckoutLineItem,
  cartItemsToCheckoutLines,
  checkoutHasWholeSet,
  deliveryPrefillFromUser,
  validateCheckoutDelivery,
} from '../checkoutFlow'
import { defaultTierForCart, type PudoLockerTier } from '../pudoLockerSizes'
import { parseMoneyToNumber } from '../money'
import type { User } from '../../types'
import { fetchSessionUser, getUserSessionToken, readStoredAuthPayload, redeemWonderCode } from '../utils'
import { brandAccentRgba } from '../brandAccent'

const ACCENT_ON_BADGE_TEXT = '#ffffff'

function cartItemsAllZar(items: { price?: { currencyCode?: string } | null }[]): boolean {
  if (!items.length) return false
  return items.every((item) => {
    const p = item?.price
    if (p && typeof p === 'object' && 'currencyCode' in p) {
      return String((p as { currencyCode?: string }).currencyCode || '').trim().toUpperCase() === 'ZAR'
    }
    return false
  })
}

type RouteParams = {
  from?: CheckoutFlowSource
  items?: CheckoutLineItem[]
  /** Buy-now flow passes line subtotal; cart flow derives from cartItems. */
  subtotalZar?: number
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
  const keyboardAwareBottomOffset = insets.bottom + FLOATING_TAB_BAR_BOTTOM + 24

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

  const subtotalZar = useMemo(() => {
    if (from === 'cart') {
      return cartItems.reduce((sum, item) => {
        const price = parseMoneyToNumber(item.price)
        return sum + price * (item.quantity || 1)
      }, 0)
    }
    const paramSub = Number(params.subtotalZar)
    return Number.isFinite(paramSub) && paramSub > 0 ? paramSub : 0
  }, [from, cartItems, params.subtotalZar])

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
  const [formError, setFormError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false)
  const [applyWonderCoins, setApplyWonderCoins] = useState(false)
  const [wonderCoinsToRedeem, setWonderCoinsToRedeem] = useState(0)
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

  const handlePudoLockerTierChange = useCallback((tier: PudoLockerTier) => {
    Keyboard.dismiss()
    setPudoLockerTier(tier)
  }, [])

  /** Prefill only the fields for the active delivery mode (avoids fighting locker inputs after door → locker). */
  useEffect(() => {
    const user = lastProfileUserRef.current
    if (!user) return
    const p = deliveryPrefillFromUser(user)
    const fill = (current: string, next: string) => (current.trim() ? current : next)
    if (pudoLockerTier === 'locker') {
      setPudoName((v) => fill(v, p.pudoName))
      setPudoAddr((v) => fill(v, p.pudoAddr))
    } else {
      setShippingLine1((v) => fill(v, p.shippingLine1))
      setShippingLine2((v) => fill(v, p.shippingLine2))
      setShippingPostalCode((v) => fill(v, p.shippingPostalCode))
      setShippingCity((v) => fill(v, p.shippingCity))
      setShippingProvince((v) => fill(v, p.shippingProvince))
    }
  }, [pudoLockerTier])

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
    if (from === 'cart') {
      const stockErr = getCartStockError(cartItems)
      if (stockErr) {
        Alert.alert('Out of stock', stockErr)
        return
      }
      if (cartItems.length && !cartItemsAllZar(cartItems)) {
        Alert.alert(
          'Checkout',
          'South African shipping applies to ZAR-priced items only. One or more cart lines are not ZAR.',
        )
        return
      }
    }
    setPaymentMethodModalOpen(true)
  }

  function startPayment(method: 'eft' | 'yoco') {
    setPaymentMethodModalOpen(false)
    const delivery = buildDeliveryDetails()
    navigation.navigate('CartCheckout', {
      from,
      items,
      delivery,
      paymentMethod: method,
      wonderCoinsToRedeem: applyWonderCoins ? wonderCoinsToRedeem : 0,
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

      <View style={styles.flex}>
        <KeyboardAwareScrollView
          style={styles.flex}
          bottomOffset={keyboardAwareBottomOffset}
          extraKeyboardSpace={20}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
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
            onPudoLockerTierChange={handlePudoLockerTierChange}
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
            subtotalZar={subtotalZar}
          />

          <CheckoutWonderCoinsSection
            theme={theme}
            items={items}
            pudoLockerTier={pudoLockerTier}
            applyWonderCoins={applyWonderCoins}
            wonderCoinsToRedeem={wonderCoinsToRedeem}
            onApplyWonderCoinsChange={setApplyWonderCoins}
            onWonderCoinsToRedeemChange={setWonderCoinsToRedeem}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </KeyboardAwareScrollView>

        <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
          <Pressable style={styles.continueBtn} onPress={onContinueToPayment}>
            <Text style={styles.continueText}>Continue to payment</Text>
          </Pressable>
        </View>
      </View>

      <PaymentMethodModal
        visible={paymentMethodModalOpen}
        showCard={SHOW_YOCO_CHECKOUT}
        onEft={() => startPayment('eft')}
        onCard={() => startPayment('yoco')}
        onCancel={() => setPaymentMethodModalOpen(false)}
      />
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
