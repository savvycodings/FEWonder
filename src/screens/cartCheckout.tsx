/**
 * Full checkout flodw for items in the cart (same server path as Product "Buy now").
 */
import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ThemeContext, AppContext } from '../context'
import { WonderportAccentCard, YocoPaymentModal } from '../components'
import {
  createOrder,
  fetchEftInstructions,
  getUserSessionToken,
  initYocoCheckout,
  syncYocoCheckout,
  uploadEftProof,
} from '../ordersApi'
import { fetchSessionUser } from '../utils'
import { SHOW_YOCO_CHECKOUT } from '../../constants'
import { startYocoPayment } from '../yocoCheckout'
import { brandAccentRgba } from '../brandAccent'
import { getCartStockError } from '../productStock'

const CHECKOUT_FILL = '#000000'
const HOME_CHIP_FILL = '#000000'
const HOME_ACCENT_TEXT = '#000000'
const PRODUCT_SURFACE_BG = '#111111'
const PRODUCT_TEXT_PRIMARY = '#ffffff'
const PRODUCT_TEXT_MUTED = 'rgba(255,255,255,0.72)'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

async function copyLabelValue(label: string, value: string) {
  if (!value) return
  await Clipboard.setStringAsync(value)
  Alert.alert('Copied', `${label} copied to clipboard.`)
}

function linePackaging(item: any): 'single' | 'set' {
  if (item?.selectedPackaging === 'set') return 'set'
  if (String(item?.title || '').includes('(Whole set)')) return 'set'
  return 'single'
}

function cartItemsAllZar(items: any[]): boolean {
  if (!items.length) return false
  return items.every((item) => {
    const p = item?.price
    if (p && typeof p === 'object' && 'currencyCode' in p) {
      return String((p as any).currencyCode || '').trim().toUpperCase() === 'ZAR'
    }
    return false
  })
}

export function CartCheckout({ navigation }: { navigation: any }) {
  const { theme } = useContext(ThemeContext)
  const { cartItems, clearCart } = useContext(AppContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutFormError, setCheckoutFormError] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'pudo'>('standard')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [shippingFull, setShippingFull] = useState('')
  const [shippingLine2, setShippingLine2] = useState('')
  const [pudoName, setPudoName] = useState('')
  const [pudoAddr, setPudoAddr] = useState('')
  const [customerEftName, setCustomerEftName] = useState('')
  const [customerEftBank, setCustomerEftBank] = useState('')
  const [customerEftAcct, setCustomerEftAcct] = useState('')

  const [eftModalOpen, setEftModalOpen] = useState(false)
  const [eftBank, setEftBank] = useState<{
    accountName: string
    accountNumber: string
    bank: string
    branch: string
    message: string
  } | null>(null)
  const [eftOrderId, setEftOrderId] = useState<string | null>(null)
  const [eftReference, setEftReference] = useState<string | null>(null)
  const [eftTotalLabel, setEftTotalLabel] = useState<string>('')
  const [eftUploadBusy, setEftUploadBusy] = useState(false)

  const [yocoModalOpen, setYocoModalOpen] = useState(false)
  const [yocoRedirectUrl, setYocoRedirectUrl] = useState<string | null>(null)
  const [yocoOrderId, setYocoOrderId] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!cartItems?.length) {
      navigation.goBack()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only if cart empty when opening this screen
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getUserSessionToken()
      if (!token || cancelled) return
      try {
        const u = await fetchSessionUser(token)
        if (cancelled) return
        setContactEmail((e) => e || u.email || '')
        setContactPhone((p) => p || u.phone || '')
        setShippingFull((s) => s || u.shippingAddress || '')
        setShippingLine2((s) => s || u.shippingAddressLine2 || '')
        setPudoName((n) => n || u.pudoLockerName || '')
        setPudoAddr((a) => a || u.pudoLockerAddress || '')
        setCustomerEftName((n) => n || u.eftBankAccountName || '')
        setCustomerEftBank((b) => b || u.eftBankName || '')
        setCustomerEftAcct((a) => a || u.eftBankAccountNumber || '')
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!cartItems?.length) return
    if (!cartItemsAllZar(cartItems)) {
      Alert.alert(
        'Checkout',
        'South African shipping applies to ZAR-priced items only. One or more cart lines are not ZAR.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
      return
    }
    setDeliveryModalOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- open once on mount

  function validateDeliveryCheckout(): string | null {
    const phone = contactPhone.trim()
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return 'Enter a valid cellphone number for this order.'
    }
    const em = contactEmail.trim().toLowerCase()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return 'Enter a valid email address for order updates.'
    }
    if (deliveryMethod === 'standard' && !shippingFull.trim()) {
      return 'Enter your full shipping address for courier delivery.'
    }
    if (deliveryMethod === 'pudo' && (!pudoName.trim() || !pudoAddr.trim())) {
      return 'Enter Pudo locker name and address.'
    }
    return null
  }

  async function runCheckout(method: 'eft' | 'yoco') {
    const token = await getUserSessionToken()
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in from Profile to purchase.')
      return
    }
    if (!cartItems?.length) return
    const stockErr = getCartStockError(cartItems)
    if (stockErr) {
      Alert.alert('Out of stock', stockErr)
      return
    }

    setCheckoutBusy(true)
    try {
      const items = cartItems.map((item) => ({
        productId: String(item.id),
        quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
        packaging: linePackaging(item),
      }))

      const created = await createOrder({
        paymentMethod: method,
        items,
        deliveryMethod,
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        shippingAddressFull: deliveryMethod === 'standard' ? shippingFull.trim() : undefined,
        shippingAddressLine2: deliveryMethod === 'standard' ? shippingLine2.trim() : undefined,
        pudoLockerName: deliveryMethod === 'pudo' ? pudoName.trim() : undefined,
        pudoLockerAddress: deliveryMethod === 'pudo' ? pudoAddr.trim() : undefined,
        customerEftAccountName: customerEftName.trim() || undefined,
        customerEftBankName: customerEftBank.trim() || undefined,
        customerEftAccountNumber: customerEftAcct.trim() || undefined,
      })
      // Match product.tsx: open payment UI before clearing cart. Clearing first made `cartItems`
      // empty so we hit `return null` below and never rendered the EFT / Yoco modals.
      if (method === 'eft') {
        const bank = await fetchEftInstructions()
        setEftBank(bank)
        setEftOrderId(created.orderId)
        setEftReference(created.referenceCode)
        setEftTotalLabel(`${(created.totalCents / 100).toFixed(2)} ${created.currencyCode}`)
        setEftModalOpen(true)
      } else {
        const yoco = await initYocoCheckout(created.orderId)
        setYocoOrderId(created.orderId)
        startYocoPayment(created.orderId, yoco.redirectUrl, {
          onPaid: () => {
            setYocoModalOpen(false)
            setYocoRedirectUrl(null)
            navigation.navigate('Tabs')
          },
          onPayInApp: () => {
            setYocoRedirectUrl(yoco.redirectUrl)
            setYocoModalOpen(true)
          },
        })
      }
      clearCart()
    } catch (e: any) {
      Alert.alert('Checkout', e?.message || 'Could not start checkout')
    } finally {
      setCheckoutBusy(false)
    }
  }

  function continueDeliveryThenPay() {
    setCheckoutFormError('')
    const stockErr = getCartStockError(cartItems)
    if (stockErr) {
      Alert.alert('Out of stock', stockErr)
      return
    }
    const err = validateDeliveryCheckout()
    if (err) {
      setCheckoutFormError(err)
      return
    }
    setDeliveryModalOpen(false)
    const shipNote =
      deliveryMethod === 'pudo'
        ? 'Pudo locker delivery includes R70.00 shipping in your total.'
        : 'Courier: R150 per single box and R200 per whole set line (included in your total).'
    const payMessage = SHOW_YOCO_CHECKOUT
      ? `${shipNote}\nHow would you like to pay?`
      : `${shipNote}\nPay with bank transfer (EFT).`
    const payButtons = [
      { text: 'EFT (bank transfer)', onPress: () => runCheckout('eft') },
      ...(SHOW_YOCO_CHECKOUT
        ? [{ text: 'Card', onPress: () => runCheckout('yoco') }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]
    Alert.alert('Payment method', payMessage, payButtons)
  }

  async function onPickEftProof() {
    if (!eftOrderId) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission', 'Photo library access is needed to upload proof.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    })
    if (result.canceled || !result.assets?.[0]?.base64) return
    const asset = result.assets[0]
    const mime = asset.mimeType || 'image/jpeg'
    setEftUploadBusy(true)
    try {
      await uploadEftProof(eftOrderId, asset.base64!, mime)
      Alert.alert('Uploaded', 'We received your proof of payment.')
      setEftModalOpen(false)
      navigation.navigate('Tabs')
    } catch (e: any) {
      Alert.alert('Upload', e?.message || 'Upload failed')
    } finally {
      setEftUploadBusy(false)
    }
  }

  function onYocoWebViewNavigation(navState: { url?: string }) {
    const url = navState.url || ''
    if (url.includes('/payment/yoco/success')) {
      setYocoModalOpen(false)
      setYocoRedirectUrl(null)
      if (yocoOrderId) {
        void syncYocoCheckout(yocoOrderId).finally(() => navigation.navigate('Tabs'))
      } else {
        navigation.navigate('Tabs')
      }
    } else if (url.includes('/payment/yoco/failed') || url.includes('/payment/yoco/cancelled')) {
      Alert.alert('Payment not completed', 'You can try card payment again from your order.')
      setYocoModalOpen(false)
      setYocoRedirectUrl(null)
    }
  }

  const keepUiWithoutCart =
    checkoutBusy || eftModalOpen || yocoModalOpen || Boolean(eftOrderId || yocoRedirectUrl)
  if (!cartItems?.length && !keepUiWithoutCart) {
    return null
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="chevron-left" size={20} color={theme.brandAccent} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Checkout</Text>
        </View>
      </SafeAreaView>

      <View style={styles.hintWrap}>
        <Text style={styles.hintText}>
          {cartItems.length} line{cartItems.length === 1 ? '' : 's'} · ZAR only
        </Text>
      </View>

      <Modal visible={deliveryModalOpen} animationType="fade" transparent>
        <SafeAreaView style={styles.deliveryBackdrop} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.deliveryKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.deliveryBackdropInner}>
                <TouchableWithoutFeedback accessible={false}>
                  <View style={styles.deliveryCard}>
            <Text style={styles.deliveryTitle}>Delivery & contact</Text>
            <Text style={styles.deliverySub}>
              Courier: R150 per single box, R200 per whole set. Pudo: R70 flat. Included in total (ZAR only).
            </Text>
            <View style={styles.deliveryChipsRow}>
              <TouchableOpacity
                style={[styles.deliveryChip, deliveryMethod === 'standard' ? styles.deliveryChipActive : null]}
                onPress={() => setDeliveryMethod('standard')}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.deliveryChipText,
                    deliveryMethod === 'standard' ? styles.deliveryChipTextActive : null,
                  ]}
                >
                  Courier
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deliveryChip, deliveryMethod === 'pudo' ? styles.deliveryChipActive : null]}
                onPress={() => setDeliveryMethod('pudo')}
                activeOpacity={0.9}
              >
                <Text
                  style={[styles.deliveryChipText, deliveryMethod === 'pudo' ? styles.deliveryChipTextActive : null]}
                >
                  Pudo (R70)
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.deliveryScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.deliveryFieldLabel}>Email</Text>
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.deliveryFieldLabel}>Cellphone</Text>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="082 000 0000"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                keyboardType="phone-pad"
              />
              {deliveryMethod === 'standard' ? (
                <>
                  <Text style={styles.deliveryFieldLabel}>Full shipping address</Text>
                  <TextInput
                    value={shippingFull}
                    onChangeText={setShippingFull}
                    placeholder="Street, building, unit"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={[styles.deliveryInput, styles.deliveryInputMultiline]}
                    multiline
                  />
                  <Text style={styles.deliveryFieldLabel}>Suburb, city, postal (optional)</Text>
                  <TextInput
                    value={shippingLine2}
                    onChangeText={setShippingLine2}
                    placeholder="Line 2"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.deliveryInput}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.deliveryFieldLabel}>Pudo locker name / code</Text>
                  <TextInput
                    value={pudoName}
                    onChangeText={setPudoName}
                    placeholder="Locker name"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={styles.deliveryInput}
                  />
                  <Text style={styles.deliveryFieldLabel}>Pudo locker address</Text>
                  <TextInput
                    value={pudoAddr}
                    onChangeText={setPudoAddr}
                    placeholder="Mall / location"
                    placeholderTextColor={theme.mutedForegroundColor}
                    style={[styles.deliveryInput, styles.deliveryInputMultiline]}
                    multiline
                  />
                </>
              )}
              <Text style={[styles.deliveryFieldLabel, styles.deliveryBankHeading]}>
                Your bank (optional)
              </Text>
              <Text style={styles.deliveryFieldLabel}>Account holder</Text>
              <TextInput
                value={customerEftName}
                onChangeText={setCustomerEftName}
                placeholder="Name on account"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                returnKeyType="next"
                blurOnSubmit={false}
              />
              <Text style={styles.deliveryFieldLabel}>Bank name</Text>
              <TextInput
                value={customerEftBank}
                onChangeText={setCustomerEftBank}
                placeholder="e.g. FNB"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                returnKeyType="next"
                blurOnSubmit={false}
              />
              <Text style={styles.deliveryFieldLabel}>Account number</Text>
              <TextInput
                value={customerEftAcct}
                onChangeText={setCustomerEftAcct}
                placeholder="Account number"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </ScrollView>
            {checkoutFormError ? <Text style={styles.deliveryError}>{checkoutFormError}</Text> : null}
            <View style={styles.deliveryFooterRow}>
              <TouchableOpacity
                style={styles.deliveryCancelBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <Text style={styles.deliveryCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deliveryContinueBtn}
                onPress={continueDeliveryThenPay}
                activeOpacity={0.9}
                disabled={checkoutBusy}
              >
                {checkoutBusy ? (
                  <ActivityIndicator color={HOME_ACCENT_TEXT} />
                ) : (
                  <Text style={styles.deliveryContinueText}>Continue to payment</Text>
                )}
              </TouchableOpacity>
            </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={eftModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.checkoutBackdrop} edges={['top', 'bottom']}>
          <WonderportAccentCard
            borderWidth={3}
            borderRadius={18}
            innerBackgroundColor={CHECKOUT_FILL}
            style={styles.checkoutShell}
            contentStyle={styles.checkoutInner}
          >
            <ScrollView style={styles.checkoutScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.checkoutTitle}>Bank transfer (EFT)</Text>
              <Text style={styles.checkoutSubtitle}>
                Your order is already created. Use this reference on your bank payment, then upload proof.
              </Text>
              {eftReference ? (
                <View style={styles.copyBlock}>
                  <View style={styles.copyTextCol}>
                    <Text style={styles.checkoutLabel}>Order reference</Text>
                    <Text style={styles.checkoutValueMono}>{eftReference}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyLabelValue('Order reference', eftReference)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.brandAccent} />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {eftTotalLabel ? (
                <View style={styles.copyBlock}>
                  <View style={styles.copyTextCol}>
                    <Text style={styles.checkoutLabel}>Amount to pay</Text>
                    <Text style={styles.checkoutValueMono}>{eftTotalLabel}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyLabelValue('Amount', eftTotalLabel)}
                  >
                    <FeatherIcon name="copy" size={18} color={theme.brandAccent} />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {eftBank ? (
                <>
                  <Text style={styles.checkoutSection}>Bank details</Text>
                  {[
                    ['Account name', eftBank.accountName],
                    ['Account number', eftBank.accountNumber],
                    ['Bank', eftBank.bank],
                    ['Branch code', eftBank.branch],
                  ].map(([label, val]) => (
                    <View key={String(label)} style={styles.copyBlock}>
                      <View style={styles.copyTextCol}>
                        <Text style={styles.checkoutLabel}>{label}</Text>
                        <Text style={styles.checkoutValueMono}>{val}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => copyLabelValue(String(label), String(val))}
                      >
                        <FeatherIcon name="copy" size={18} color={theme.brandAccent} />
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <Text style={styles.checkoutHint}>{eftBank.message}</Text>
                </>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.checkoutPrimaryBtn}
              onPress={onPickEftProof}
              disabled={eftUploadBusy}
            >
              {eftUploadBusy ? (
                <ActivityIndicator color={CHECKOUT_FILL} />
              ) : (
                <Text style={styles.checkoutPrimaryBtnText}>Upload proof of payment</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkoutGhostBtn} onPress={() => setEftModalOpen(false)}>
              <Text style={styles.checkoutGhostBtnText}>Close</Text>
            </TouchableOpacity>
          </WonderportAccentCard>
        </SafeAreaView>
      </Modal>

      <YocoPaymentModal
        visible={yocoModalOpen}
        redirectUrl={yocoRedirectUrl}
        accentColor={theme.brandAccent}
        onClose={() => setYocoModalOpen(false)}
        onNavigationStateChange={onYocoWebViewNavigation}
      />
    </View>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const surfaceBorder = L(0.3)
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: '#000000' },
    safeTop: { backgroundColor: '#000000' },
    topNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      gap: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: HOME_CHIP_FILL,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    navTitle: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 18,
      color: PRODUCT_TEXT_PRIMARY,
    },
    hintWrap: { paddingHorizontal: 20, paddingTop: 8 },
    hintText: { fontFamily: theme.regularFont, fontSize: 13, color: PRODUCT_TEXT_MUTED },
    deliveryBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
    },
    deliveryKeyboardWrap: { flex: 1 },
    deliveryBackdropInner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 16,
    },
    deliveryCard: {
      borderRadius: 18,
      padding: 16,
      maxHeight: '92%',
      backgroundColor: PRODUCT_SURFACE_BG,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    deliveryTitle: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 20,
      color: PRODUCT_TEXT_PRIMARY,
      marginBottom: 6,
    },
    deliverySub: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: PRODUCT_TEXT_MUTED,
      lineHeight: 18,
      marginBottom: 12,
    },
    deliveryChipsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    deliveryChip: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: HOME_CHIP_FILL,
      borderWidth: 1,
      borderColor: L(0.3),
    },
    deliveryChipActive: { borderWidth: 2, borderColor: theme.brandAccent },
    deliveryChipText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: theme.brandAccent,
      textAlign: 'center',
    },
    deliveryChipTextActive: { fontFamily: theme.boldFont },
    deliveryScroll: { maxHeight: 360, marginBottom: 8 },
    deliveryFieldLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: PRODUCT_TEXT_MUTED,
      marginBottom: 6,
      marginTop: 10,
    },
    deliveryBankHeading: {
      marginTop: 18,
      marginBottom: 2,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: PRODUCT_TEXT_PRIMARY,
    },
    deliveryInput: {
      borderWidth: 1,
      borderColor: surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: PRODUCT_TEXT_PRIMARY,
      backgroundColor: HOME_CHIP_FILL,
    },
    deliveryInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
    deliveryError: { color: '#f87171', fontFamily: theme.mediumFont, fontSize: 13, marginBottom: 8 },
    deliveryFooterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    deliveryCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: HOME_CHIP_FILL,
    },
    deliveryCancelText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: PRODUCT_TEXT_PRIMARY,
    },
    deliveryContinueBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.brandAccent,
    },
    deliveryContinueText: { fontFamily: theme.boldFont, fontSize: 14, color: HOME_ACCENT_TEXT },
    checkoutBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    checkoutShell: { width: '100%', maxHeight: '90%' },
    checkoutInner: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14, maxHeight: 520 },
    checkoutScroll: { maxHeight: 380, marginBottom: 10 },
    checkoutTitle: {
      fontFamily: theme.boldFont,
      fontSize: 20,
      color: theme.brandAccent,
      marginBottom: 8,
    },
    checkoutSubtitle: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.72)',
      lineHeight: 19,
      marginBottom: 16,
    },
    checkoutSection: {
      fontFamily: theme.boldFont,
      fontSize: 14,
      color: theme.brandAccent,
      marginTop: 8,
      marginBottom: 10,
    },
    checkoutLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 11,
      color: L(0.65),
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    checkoutValueMono: { fontFamily: theme.boldFont, fontSize: 16, color: '#ffffff' },
    checkoutHint: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
      lineHeight: 20,
      marginTop: 12,
    },
    copyBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: L(0.25),
    },
    copyTextCol: { flex: 1, minWidth: 0 },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: L(0.12),
    },
    copyBtnText: { fontFamily: theme.semiBoldFont, fontSize: 13, color: theme.brandAccent },
    checkoutPrimaryBtn: {
      backgroundColor: theme.brandAccent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    checkoutPrimaryBtnText: { color: CHECKOUT_FILL, fontFamily: theme.boldFont, fontSize: 15 },
    checkoutGhostBtn: { paddingVertical: 14, alignItems: 'center' },
    checkoutGhostBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: L(0.85),
    },
  })
}
