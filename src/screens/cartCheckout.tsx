/**
 * Full checkout flodw for items in the cart (same server path as Product "Buy now").
 */
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ThemeContext, AppContext } from '../context'
import {
  PaymentMethodModal,
  ProfilePageHeading,
  ProfileStackBackBar,
  WonderportAccentCard,
  YocoPaymentModal,
} from '../components'
import {
  type CheckoutDeliveryDetails,
  type CheckoutFlowSource,
  type CheckoutLineItem,
  cartItemsToCheckoutLines,
} from '../checkoutFlow'
import {
  createOrder,
  fetchEftInstructions,
  getUserSessionToken,
  initYocoCheckout,
  uploadEftProof,
} from '../ordersApi'
import { finalizeYocoCheckout, parseYocoReturnRoute, yocoOutcomeAlert } from '../yocoCheckout'
import { SHOW_YOCO_CHECKOUT } from '../../constants'
import { brandAccentRgba } from '../brandAccent'
import { getCartStockError } from '../productStock'

const ACCENT_ON_BADGE_TEXT = '#ffffff'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

async function copyLabelValue(label: string, value: string) {
  if (!value) return
  await Clipboard.setStringAsync(value)
  Alert.alert('Copied', `${label} copied to clipboard.`)
}

type CheckoutRouteParams = {
  from?: CheckoutFlowSource
  items?: CheckoutLineItem[]
  delivery?: CheckoutDeliveryDetails
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
  const route = useRoute()
  const params = (route.params || {}) as CheckoutRouteParams
  const styles = useMemo(() => getStyles(theme), [theme])
  const frameFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'

  const from: CheckoutFlowSource = params.from === 'product' ? 'product' : 'cart'
  const lineItems = useMemo<CheckoutLineItem[]>(() => {
    if (Array.isArray(params.items) && params.items.length) {
      return params.items
    }
    return cartItemsToCheckoutLines(cartItems)
  }, [params.items, cartItems])
  const delivery = params.delivery

  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

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
  const [yocoSyncing, setYocoSyncing] = useState(false)
  const yocoHandledRef = useRef(false)

  useLayoutEffect(() => {
    if (!lineItems.length) {
      navigation.goBack()
    }
  }, [lineItems.length, navigation])

  useEffect(() => {
    if (!delivery) {
      navigation.replace('CheckoutDelivery', { from, items: lineItems })
      return
    }
    if (from === 'cart' && cartItems.length && !cartItemsAllZar(cartItems)) {
      Alert.alert(
        'Checkout',
        'South African shipping applies to ZAR-priced items only. One or more cart lines are not ZAR.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      )
      return
    }
    setPaymentMethodModalOpen(true)
  }, [delivery, from, lineItems, cartItems, navigation])

  async function runCheckout(method: 'eft' | 'yoco') {
    const token = await getUserSessionToken()
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in from Profile to purchase.')
      return
    }
    if (!lineItems.length || !delivery) {
      navigation.replace('CheckoutDelivery', { from, items: lineItems })
      return
    }
    if (from === 'cart') {
      const stockErr = getCartStockError(cartItems)
      if (stockErr) {
        Alert.alert('Out of stock', stockErr)
        return
      }
    }

    setCheckoutBusy(true)
    try {
      const created = await createOrder({
        paymentMethod: method,
        items: lineItems,
        deliveryMethod: 'pudo',
        pudoLockerTier: delivery.pudoLockerTier,
        contactPhone: delivery.contactPhone,
        contactEmail: delivery.contactEmail,
        pudoLockerName: delivery.pudoLockerName,
        pudoLockerAddress: delivery.pudoLockerAddress,
        shippingAddress: delivery.shippingAddress,
        shippingAddressLine2: delivery.shippingAddressLine2,
        shippingPostalCode: delivery.shippingPostalCode,
        shippingCity: delivery.shippingCity,
        shippingProvince: delivery.shippingProvince,
        customerEftAccountName: delivery.customerEftAccountName,
        customerEftBankName: delivery.customerEftBankName,
        customerEftAccountNumber: delivery.customerEftAccountNumber,
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
        if (from === 'cart') clearCart()
      } else {
        const yoco = await initYocoCheckout(created.orderId)
        yocoHandledRef.current = false
        setYocoOrderId(created.orderId)
        setYocoRedirectUrl(yoco.redirectUrl)
        setYocoModalOpen(true)
      }
    } catch (e: any) {
      Alert.alert('Checkout', e?.message || 'Could not start checkout')
    } finally {
      setCheckoutBusy(false)
    }
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

  async function finishYocoCheckoutFlow(orderId: string) {
    setYocoSyncing(true)
    try {
      const outcome = await finalizeYocoCheckout(orderId)
      const copy = yocoOutcomeAlert(outcome)
      if (copy) Alert.alert(copy.title, copy.message)
      if (outcome === 'paid') {
        if (from === 'cart') clearCart()
        navigation.navigate('Tabs')
      }
    } catch {
      Alert.alert(
        'Payment status',
        'Could not confirm payment. Check Profile → Orders for the latest status.',
      )
    } finally {
      setYocoSyncing(false)
      setYocoModalOpen(false)
      setYocoRedirectUrl(null)
      setYocoOrderId(null)
    }
  }

  function onYocoWebViewNavigation(navState: { url?: string }) {
    const route = parseYocoReturnRoute(navState.url || '')
    if (!route || !yocoOrderId || yocoHandledRef.current || yocoSyncing) return
    yocoHandledRef.current = true
    void finishYocoCheckoutFlow(yocoOrderId)
  }

  function handleYocoModalClose() {
    if (yocoSyncing) return
    const orderId = yocoOrderId
    setYocoRedirectUrl(null)
    if (!orderId) {
      setYocoModalOpen(false)
      setYocoOrderId(null)
      return
    }
    if (yocoHandledRef.current) {
      setYocoModalOpen(false)
      setYocoOrderId(null)
      return
    }
    yocoHandledRef.current = true
    void finishYocoCheckoutFlow(orderId)
  }

  const keepUiWithoutCart =
    checkoutBusy || yocoSyncing || eftModalOpen || yocoModalOpen || Boolean(eftOrderId || yocoRedirectUrl)
  if (!lineItems.length && !keepUiWithoutCart) {
    return null
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeTop} edges={['top', 'left', 'right']}>
        <ProfileStackBackBar onBack={() => navigation.goBack()} />
        <ProfilePageHeading title="Checkout" />
      </SafeAreaView>

      <View style={styles.hintWrap}>
        <Text style={styles.hintText}>
          {lineItems.length} item{lineItems.length === 1 ? '' : 's'} · choose how to pay
        </Text>
        <TouchableOpacity
          style={styles.editDeliveryLink}
          onPress={() => navigation.navigate('CheckoutDelivery', { from, items: lineItems })}
          activeOpacity={0.85}
        >
          <Text style={styles.editDeliveryLinkText}>Edit delivery details</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={eftModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.checkoutBackdrop} edges={['top', 'bottom']}>
          <WonderportAccentCard
            borderWidth={3}
            borderRadius={18}
            innerBackgroundColor={frameFill}
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
                <ActivityIndicator color={ACCENT_ON_BADGE_TEXT} />
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

      <PaymentMethodModal
        visible={paymentMethodModalOpen}
        showCard={SHOW_YOCO_CHECKOUT}
        onEft={() => {
          setPaymentMethodModalOpen(false)
          runCheckout('eft')
        }}
        onCard={() => {
          setPaymentMethodModalOpen(false)
          runCheckout('yoco')
        }}
        onCancel={() => setPaymentMethodModalOpen(false)}
      />

      <YocoPaymentModal
        visible={yocoModalOpen}
        redirectUrl={yocoRedirectUrl}
        accentColor={theme.brandAccent}
        syncing={yocoSyncing}
        onClose={handleYocoModalClose}
        onNavigationStateChange={onYocoWebViewNavigation}
      />
    </View>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const surfaceBorder = L(0.3)
  const pageBg = theme.appBackgroundColor || theme.backgroundColor
  const surfaceBg = theme.sheetBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const frameFill = theme.frameInnerBackgroundColor || surfaceBg
  const textPrimary = theme.textColor
  const textMuted = theme.mutedForegroundColor
  const modalOverlay = theme.modalOverlayColor || 'rgba(0, 0, 0, 0.38)'
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: pageBg },
    safeTop: { backgroundColor: pageBg },
    hintWrap: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8 },
    hintText: { fontFamily: theme.regularFont, fontSize: 13, color: textMuted },
    editDeliveryLink: { marginTop: 10, alignSelf: 'flex-start' },
    editDeliveryLinkText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.brandAccent,
    },
    deliveryBackdrop: {
      flex: 1,
      backgroundColor: modalOverlay,
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
      backgroundColor: surfaceBg,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    deliveryTitle: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 20,
      color: textPrimary,
      marginBottom: 12,
    },
    deliveryChipsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    deliveryChip: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: frameFill,
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
      color: textMuted,
      marginBottom: 6,
      marginTop: 10,
    },
    deliveryBankHeading: {
      marginTop: 18,
      marginBottom: 2,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: textPrimary,
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
      color: textPrimary,
      backgroundColor: frameFill,
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
      backgroundColor: frameFill,
    },
    deliveryCancelText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: textPrimary,
    },
    deliveryContinueBtn: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brandAccent,
    },
    deliveryContinueText: {
      fontFamily: theme.boldFont,
      fontSize: 14,
      color: ACCENT_ON_BADGE_TEXT,
      textAlign: 'center',
    },
    checkoutBackdrop: {
      flex: 1,
      backgroundColor: modalOverlay,
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
      color: textMuted,
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
    checkoutValueMono: { fontFamily: theme.boldFont, fontSize: 16, color: textPrimary },
    checkoutHint: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: textMuted,
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
    checkoutPrimaryBtnText: { color: ACCENT_ON_BADGE_TEXT, fontFamily: theme.boldFont, fontSize: 15 },
    checkoutGhostBtn: { paddingVertical: 14, alignItems: 'center' },
    checkoutGhostBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: L(0.85),
    },
  })
}
