import { useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
  useWindowDimensions,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext, AppContext } from '../context'
import { WonderportAccentCard, YocoPaymentModal } from '../components'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney, parseMoneyToNumber } from '../money'
import {
  createOrder,
  fetchEftInstructions,
  getUserSessionToken,
  initYocoCheckout,
  syncYocoCheckout,
  uploadEftProof,
} from '../ordersApi'
import { fetchSessionUser } from '../utils'
import { getDbProductByHandle } from '../utils'
import type { ShopifyMoney, ShopifyProduct } from '../../types'
import { SHOW_YOCO_CHECKOUT } from '../../constants'
import { startYocoPayment } from '../yocoCheckout'
import { brandAccentRgba } from '../brandAccent'
import {
  formatStockLabel,
  isProductInStock,
  maxPurchasableQuantity,
} from '../productStock'
import { productShowsPackagingChoice } from '../productPurchaseMode'

const CHECKOUT_FILL = '#000000'
const PRODUCT_PAGE_BG = '#000000'
const PRODUCT_SURFACE_BG = '#111111'
const PRODUCT_TEXT_PRIMARY = '#ffffff'
const PRODUCT_TEXT_MUTED = 'rgba(255,255,255,0.72)'
const HOME_CHIP_FILL = '#000000'
const HOME_ACCENT_TEXT = '#000000'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

async function copyLabelValue(label: string, value: string) {
  if (!value) return
  await Clipboard.setStringAsync(value)
  Alert.alert('Copied', `${label} copied to clipboard.`)
}

function plainTextFromHtml(html: string | null | undefined, maxLen: number) {
  if (!html?.trim()) return ''
  const t = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1).trim()}…`
}

export function Product({ route, navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const { addToCart, savedItems, toggleSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const styles = getStyles(theme)
  const initialProduct = (route?.params?.product || {}) as ShopifyProduct
  const [product, setProduct] = useState<ShopifyProduct>(initialProduct)
  const [packaging, setPackaging] = useState<'single' | 'set'>('single')
  const [quantity, setQuantity] = useState(1)
  const liked = savedItems.some(item => item.title === product.title)
  useEffect(() => {
    setProduct((route?.params?.product || {}) as ShopifyProduct)
    setPackaging('single')
  }, [route?.params?.product])

  useEffect(() => {
    const handle = String(route?.params?.product?.handle || '').trim()
    if (!handle) return
    let cancelled = false
    ;(async () => {
      try {
        const fullProduct = await getDbProductByHandle(handle)
        if (!cancelled) setProduct(fullProduct)
      } catch {
        /* keep route param payload if fetch fails */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [route?.params?.product?.handle])

  const showPackaging = useMemo(() => productShowsPackagingChoice(product), [product])
  const linePackaging = showPackaging && packaging === 'set' ? 'set' : 'single'

  useEffect(() => {
    if (!showPackaging) setPackaging('single')
  }, [showPackaging, product?.id, product?.handle])

  const selectedUnitPrice = useMemo<ShopifyMoney | null>(() => {
    if (showPackaging && packaging === 'set') return product?.packagePrices?.set ?? product?.price ?? null
    return product?.packagePrices?.single ?? product?.price ?? null
  }, [packaging, product, showPackaging])

  const heroImageSource = useMemo(() => {
    if (product?.featuredImageUrl) return { uri: product.featuredImageUrl }
    return product?.image
  }, [product])
  const priceText = useMemo(() => {
    if (selectedUnitPrice?.amount != null && selectedUnitPrice.amount !== '') {
      return formatMoney(selectedUnitPrice)
    }
    return 'Price on request'
  }, [selectedUnitPrice])
  const footerTotalText = useMemo(() => {
    if (selectedUnitPrice?.amount == null || selectedUnitPrice.amount === '') return 'Price on request'
    const unit = parseMoneyToNumber(selectedUnitPrice)
    if (!Number.isFinite(unit) || unit <= 0) return 'Price on request'
    return formatMoney(
      {
        amount: unit * quantity,
        currencyCode: selectedUnitPrice.currencyCode,
      },
      String(selectedUnitPrice.currencyCode || 'USD'),
    )
  }, [selectedUnitPrice, quantity])
  const stockLabel = useMemo(() => formatStockLabel(product), [product])
  const inStock = useMemo(() => isProductInStock(product), [product])
  const maxQty = useMemo(() => maxPurchasableQuantity(product), [product])

  useEffect(() => {
    if (maxQty > 0 && quantity > maxQty) setQuantity(maxQty)
  }, [maxQty, quantity])

  const compareText = useMemo(() => {
    if (showPackaging && packaging === 'set') return null
    const c = product?.compareAtPrice
    if (c?.amount != null && c.amount !== '' && selectedUnitPrice?.amount) {
      const sale = parseFloat(String(selectedUnitPrice.amount))
      const was = parseFloat(String(c.amount))
      if (Number.isFinite(sale) && Number.isFinite(was) && was > sale) {
        return formatMoney(c)
      }
    }
    return null
  }, [packaging, product?.compareAtPrice, selectedUnitPrice, showPackaging])
  const detailText = useMemo(
    () =>
      plainTextFromHtml(product?.descriptionHtml, 800) ||
      'See photos and listing details. Packaging and edition may vary by vendor.',
    [product?.descriptionHtml]
  )
  const heroSize = Math.min(Math.max(width - 32, 260), 380)

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
  const [yocoModalOpen, setYocoModalOpen] = useState(false)
  const [yocoRedirectUrl, setYocoRedirectUrl] = useState<string | null>(null)
  const [yocoOrderId, setYocoOrderId] = useState<string | null>(null)
  const [eftUploadBusy, setEftUploadBusy] = useState(false)

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
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
  const [checkoutFormError, setCheckoutFormError] = useState('')

  useEffect(() => {
    if (!deliveryModalOpen) return
    let cancelled = false
    ;(async () => {
      const token = await getUserSessionToken()
      if (!token || cancelled) return
      try {
        const u = await fetchSessionUser(token)
        if (cancelled) return
        setContactEmail(e => e || u.email || '')
        setContactPhone(p => p || u.phone || '')
        setShippingFull(s => s || u.shippingAddress || '')
        setShippingLine2(s => s || u.shippingAddressLine2 || '')
        setPudoName(n => n || u.pudoLockerName || '')
        setPudoAddr(a => a || u.pudoLockerAddress || '')
        setCustomerEftName(n => n || u.eftBankAccountName || '')
        setCustomerEftBank(b => b || u.eftBankName || '')
        setCustomerEftAcct(a => a || u.eftBankAccountNumber || '')
      } catch {
        /* ignore prefill errors */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deliveryModalOpen])

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
      return 'Enter Pudo locker name and address (R70).'
    }
    return null
  }

  async function runCheckout(method: 'eft' | 'yoco') {
    if (!inStock) {
      Alert.alert('Out of stock', 'This item is not available to purchase right now.')
      return
    }
    if (!product?.id) {
      Alert.alert('Product', 'This listing cannot be ordered (missing id).')
      return
    }
    const token = await getUserSessionToken()
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in from Profile to purchase.')
      return
    }
    setCheckoutBusy(true)
    try {
      const created = await createOrder({
        paymentMethod: method,
        items: [{ productId: String(product.id), quantity, packaging: linePackaging }],
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
          },
          onPayInApp: () => {
            setYocoRedirectUrl(yoco.redirectUrl)
            setYocoModalOpen(true)
          },
        })
      }
    } catch (e: any) {
      Alert.alert('Checkout', e?.message || 'Could not start checkout')
    } finally {
      setCheckoutBusy(false)
    }
  }

  function continueDeliveryThenPay() {
    setCheckoutFormError('')
    const err = validateDeliveryCheckout()
    if (err) {
      setCheckoutFormError(err)
      return
    }
    setDeliveryModalOpen(false)
    const shipNote =
      deliveryMethod === 'pudo'
        ? 'Pudo locker delivery includes R70.00 shipping in your total.'
        : 'Courier: R150 per single box, R200 per whole set (included in your total).'
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

  function onBuyNowPress() {
    if (!inStock) {
      Alert.alert('Out of stock', 'This item is not available to purchase right now.')
      return
    }
    if (priceText === 'Price on request') {
      Alert.alert('Price', 'This item has no fixed price online. Contact support.')
      return
    }
    const cur = String(selectedUnitPrice?.currencyCode || '').trim().toUpperCase()
    if (cur !== 'ZAR') {
      Alert.alert(
        'Checkout',
        'South African shipping (Pudo R70 or standard R150) applies to ZAR-priced items only. This product is priced in another currency.',
      )
      return
    }
    setCheckoutFormError('')
    setDeliveryModalOpen(true)
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
        void syncYocoCheckout(yocoOrderId).catch(() => {
          Alert.alert('Payment submitted', 'Check Profile → Orders in a moment for status.')
        })
      }
    } else if (url.includes('/payment/yoco/failed') || url.includes('/payment/yoco/cancelled')) {
      Alert.alert('Payment not completed', 'You can try card payment again from your order.')
      setYocoModalOpen(false)
      setYocoRedirectUrl(null)
    }
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="chevron-left" size={20} color={theme.brandAccent} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroImageWrap, { height: heroSize }]}>
          {heroImageSource ? (
            <Image source={heroImageSource} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>{product.title || 'Product'}</Text>
            </View>
          )}
        </View>

        <WonderportAccentCard
          borderWidth={2}
          borderRadius={18}
          innerBackgroundColor={HOME_CHIP_FILL}
          style={styles.infoCardOuter}
          contentStyle={styles.infoCardInner}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title || 'Product'}</Text>
            <TouchableOpacity
              style={styles.heartButton}
              activeOpacity={0.85}
              onPress={() => toggleSavedItem(product)}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={23}
                color={liked ? '#ff4d4f' : brandAccentRgba(theme, 0.45)}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.inlinePrice}>{priceText}</Text>
            {compareText ? <Text style={styles.compareAtPrice}>{compareText}</Text> : null}
          </View>
          <Text style={styles.stockLabel}>{stockLabel}</Text>
        </WonderportAccentCard>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <FeatherIcon name="minus" size={15} color={theme.brandAccent} />
            </TouchableOpacity>
            <View style={styles.qtyValueWrap}>
              <Text style={styles.qtyValue}>{quantity}</Text>
            </View>
            <TouchableOpacity
              style={[styles.qtyButton, quantity >= maxQty || !inStock ? styles.qtyButtonDisabled : null]}
              activeOpacity={0.85}
              disabled={!inStock || quantity >= maxQty}
              onPress={() => setQuantity(q => Math.min(maxQty, q + 1))}
            >
              <FeatherIcon name="plus" size={15} color={theme.brandAccent} />
            </TouchableOpacity>
          </View>
        </View>

        {showPackaging ? (
          <View style={[styles.section, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Packaging</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionButton, packaging === 'single' ? styles.optionButtonActive : null]}
                activeOpacity={0.9}
                onPress={() => setPackaging('single')}
              >
                <Text style={[styles.optionText, packaging === 'single' ? styles.optionTextActive : null]}>
                  Single blind box
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, packaging === 'set' ? styles.optionButtonActive : null]}
                activeOpacity={0.9}
                onPress={() => setPackaging('set')}
              >
                <Text style={[styles.optionText, packaging === 'set' ? styles.optionTextActive : null]}>
                  Whole set
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>About this item</Text>
          <Text style={styles.sectionBody}>{detailText}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footerBar, { bottom: insets.bottom + 10 }]}>
        <Text style={styles.price}>{footerTotalText}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.addButton, !inStock ? styles.footerButtonDisabled : null]}
            activeOpacity={0.9}
            disabled={!inStock}
            onPress={() => {
              if (!inStock) {
                Alert.alert('Out of stock', 'This item is not available to purchase right now.')
                return
              }
              const packagedItem = {
                ...product,
                price: selectedUnitPrice,
                selectedPackaging: linePackaging,
                title:
                  linePackaging === 'set'
                    ? `${String(product?.title || 'Product')} (Whole set)`
                    : String(product?.title || 'Product'),
              }
              addToCart(packagedItem, quantity)
              navigation.navigate('Cart')
            }}
          >
            <Text style={styles.addButtonText}>Add to cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyButton, !inStock ? styles.footerButtonDisabled : null]}
            activeOpacity={0.9}
            disabled={checkoutBusy || !inStock}
            onPress={onBuyNowPress}
          >
            {checkoutBusy ? (
              <ActivityIndicator color={HOME_ACCENT_TEXT} />
            ) : (
              <Text style={styles.buyButtonText}>Buy now</Text>
            )}
          </TouchableOpacity>
        </View>
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
              Courier: R150 single / R200 whole set per item. Pudo: R70 flat. Included in total (ZAR only).
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
                  Courier (from R150)
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
                onPress={() => setDeliveryModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.deliveryCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deliveryContinueBtn}
                onPress={continueDeliveryThenPay}
                activeOpacity={0.9}
              >
                <Text style={styles.deliveryContinueText}>Continue to payment</Text>
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

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  const surfaceBorder = L(0.3)
  return StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PRODUCT_PAGE_BG,
  },
  safeTop: {
    backgroundColor: PRODUCT_PAGE_BG,
  },
  /** ~44pt content area under status bar — iOS nav bar convention */
  topNavRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    paddingBottom: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 128,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: HOME_CHIP_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: surfaceBorder,
  },
  heroImageWrap: {
    borderRadius: 16,
    backgroundColor: PRODUCT_SURFACE_BG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: surfaceBorder,
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heroPlaceholderText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 16,
    color: PRODUCT_TEXT_MUTED,
    textAlign: 'center',
  },
  infoCardOuter: {
    marginTop: 10,
    width: '100%',
  },
  infoCardInner: {
    padding: 16,
  },
  title: {
    flex: 1,
    fontFamily: HOME_MONTSERRAT_BOLD,
    fontSize: 22,
    lineHeight: 28,
    color: '#ffffff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L(0.35),
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlinePrice: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 22,
  },
  compareAtPrice: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: theme.mediumFont,
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  stockLabel: {
    marginTop: 6,
    fontFamily: theme.mediumFont,
    fontSize: 14,
    color: theme.brandAccent,
  },
  section: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: PRODUCT_SURFACE_BG,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: surfaceBorder,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  optionButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: HOME_CHIP_FILL,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: L(0.28),
  },
  optionButtonActive: {
    borderWidth: 2,
    borderColor: theme.brandAccent,
    backgroundColor: HOME_CHIP_FILL,
  },
  optionText: {
    color: theme.brandAccent,
    fontFamily: theme.mediumFont,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.88,
  },
  optionTextActive: {
    color: theme.brandAccent,
    opacity: 1,
    fontFamily: theme.boldFont,
  },
  sectionTitle: {
    fontFamily: HOME_MONTSERRAT_BOLD,
    color: PRODUCT_TEXT_PRIMARY,
    fontSize: 18,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: theme.regularFont,
    color: PRODUCT_TEXT_MUTED,
    fontSize: 15,
    lineHeight: 23,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
  },
  qtyButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: HOME_CHIP_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: L(0.55),
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyValueWrap: {
    minWidth: 56,
    height: 42,
    borderRadius: 21,
    backgroundColor: HOME_CHIP_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 3,
    borderColor: L(0.55),
  },
  qtyValue: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 18,
  },
  footerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: HOME_CHIP_FILL,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 2,
    borderColor: theme.brandAccent,
  },
  price: {
    color: theme.brandAccent,
    fontFamily: theme.boldFont,
    fontSize: 20,
    minWidth: 92,
  },
  actionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.brandAccent,
  },
  addButtonText: {
    color: theme.brandAccent,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  buyButton: {
    flex: 1,
    backgroundColor: theme.brandAccent,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: HOME_ACCENT_TEXT,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  footerButtonDisabled: {
    opacity: 0.45,
  },
  deliveryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  deliveryKeyboardWrap: {
    flex: 1,
  },
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
  deliveryChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  deliveryChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: HOME_CHIP_FILL,
    borderWidth: 1,
    borderColor: L(0.3),
  },
  deliveryChipActive: {
    borderWidth: 2,
    borderColor: theme.brandAccent,
  },
  deliveryChipText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 12,
    color: theme.brandAccent,
    textAlign: 'center',
  },
  deliveryChipTextActive: {
    fontFamily: theme.boldFont,
  },
  deliveryScroll: {
    maxHeight: 360,
    marginBottom: 8,
  },
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
  deliveryInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  deliveryError: {
    color: '#f87171',
    fontFamily: theme.mediumFont,
    fontSize: 13,
    marginBottom: 8,
  },
  deliveryFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
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
  deliveryContinueText: {
    fontFamily: theme.boldFont,
    fontSize: 14,
    color: HOME_ACCENT_TEXT,
  },
  checkoutBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  checkoutShell: {
    width: '100%',
    maxHeight: '90%',
  },
  checkoutInner: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    maxHeight: 520,
  },
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
  checkoutValueMono: {
    fontFamily: theme.boldFont,
    fontSize: 16,
    color: '#ffffff',
  },
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
  copyBtnText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
    color: theme.brandAccent,
  },
  checkoutPrimaryBtn: {
    backgroundColor: theme.brandAccent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  checkoutPrimaryBtnText: {
    color: CHECKOUT_FILL,
    fontFamily: theme.boldFont,
    fontSize: 15,
  },
  checkoutGhostBtn: { paddingVertical: 14, alignItems: 'center' },
  checkoutGhostBtnText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 15,
    color: L(0.85),
  },
  })
}
