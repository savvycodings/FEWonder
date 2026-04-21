import { useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { WebView } from 'react-native-webview'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext, AppContext } from '../context'
import { WonderportAccentCard } from '../components'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney } from '../money'
import {
  createOrder,
  fetchEftInstructions,
  getUserSessionToken,
  initPeachCheckout,
  uploadEftProof,
} from '../ordersApi'
import { fetchSessionUser } from '../utils'

const CHECKOUT_ACCENT = '#CBFF00'
const CHECKOUT_FILL = '#000000'

/** Match `home.tsx` — lime accent, black fills, Montserrat for hero title */
const HOME_ACCENT_BG = '#CBFF00'
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
  const product = route?.params?.product || {}
  const [packaging, setPackaging] = useState<'single' | 'set'>('single')
  const [quantity, setQuantity] = useState(1)
  const liked = savedItems.some(item => item.title === product.title)
  const heroImageSource = useMemo(() => {
    if (product?.featuredImageUrl) return { uri: product.featuredImageUrl }
    return product?.image
  }, [product])
  const priceText = useMemo(() => {
    if (product?.price?.amount != null && product.price.amount !== '') {
      return formatMoney(product.price)
    }
    return 'Price on request'
  }, [product])
  const compareText = useMemo(() => {
    const c = product?.compareAtPrice
    if (c?.amount != null && c.amount !== '' && product?.price?.amount) {
      const sale = parseFloat(String(product.price.amount))
      const was = parseFloat(String(c.amount))
      if (Number.isFinite(sale) && Number.isFinite(was) && was > sale) {
        return formatMoney(c)
      }
    }
    return null
  }, [product])
  const detailText = useMemo(
    () =>
      plainTextFromHtml(product?.descriptionHtml, 800) ||
      'See photos and listing details. Packaging and edition may vary by vendor.',
    [product?.descriptionHtml]
  )
  const metaParts = useMemo(() => {
    const parts = [product?.vendor, product?.productType || product?.category].filter(
      (p): p is string => Boolean(p && String(p).trim())
    )
    return parts.length ? parts : ['Collectible']
  }, [product])
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
  const [peachModalOpen, setPeachModalOpen] = useState(false)
  const [peachWidgetUrl, setPeachWidgetUrl] = useState<string | null>(null)
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
      return 'Enter your full shipping address for courier delivery (R150).'
    }
    if (deliveryMethod === 'pudo' && (!pudoName.trim() || !pudoAddr.trim())) {
      return 'Enter Pudo locker name and address (R70).'
    }
    return null
  }

  async function runCheckout(method: 'eft' | 'peach') {
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
        items: [{ productId: String(product.id), quantity }],
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
        const peach = await initPeachCheckout(created.orderId)
        setPeachWidgetUrl(peach.widgetUrl)
        setPeachModalOpen(true)
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
        : 'Standard shipping includes R150.00 in your total.'
    Alert.alert('Payment method', `${shipNote}\nHow would you like to pay?`, [
      { text: 'EFT (bank transfer)', onPress: () => runCheckout('eft') },
      { text: 'Peach (card)', onPress: () => runCheckout('peach') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function onBuyNowPress() {
    if (priceText === 'Price on request') {
      Alert.alert('Price', 'This item has no fixed price online. Contact support.')
      return
    }
    const cur = String(product?.price?.currencyCode || '').trim().toUpperCase()
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

  const peachHtml =
    peachWidgetUrl != null
      ? `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><script src="${peachWidgetUrl.replace(
          /"/g,
          '',
        )}"></script></head><body style="margin:0;padding:12px;background:#fff"><form class="paymentWidgets" data-brands="VISA MASTER AMEX"></form></body></html>`
      : ''

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
            <FeatherIcon name="chevron-left" size={20} color={theme.textColor} />
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
                color={liked ? '#ff4d4f' : 'rgba(203,255,0,0.45)'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.inlinePrice}>{priceText}</Text>
            {compareText ? <Text style={styles.compareAtPrice}>{compareText}</Text> : null}
          </View>

          <View style={styles.metaRow}>
            {metaParts.map((part, i) => (
              <View key={i} style={styles.metaChip}>
                <Text style={styles.metaChipText}>{part}</Text>
              </View>
            ))}
          </View>
        </WonderportAccentCard>

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <FeatherIcon name="minus" size={15} color={HOME_ACCENT_BG} />
            </TouchableOpacity>
            <View style={styles.qtyValueWrap}>
              <Text style={styles.qtyValue}>{quantity}</Text>
            </View>
            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.85}
              onPress={() => setQuantity(q => q + 1)}
            >
              <FeatherIcon name="plus" size={15} color={HOME_ACCENT_BG} />
            </TouchableOpacity>
          </View>
        </View>

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

        <View style={[styles.section, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>About this item</Text>
          <Text style={styles.sectionBody}>{detailText}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footerBar, { bottom: insets.bottom + 10 }]}>
        <Text style={styles.price}>{priceText}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.9}
            onPress={() => {
              addToCart(product, quantity)
              navigation.navigate('Tabs', {
                screen: 'Profile',
                params: {
                  screen: 'ProfileCart',
                },
              })
            }}
          >
            <Text style={styles.addButtonText}>Add to cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buyButton}
            activeOpacity={0.9}
            disabled={checkoutBusy}
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
        <View style={styles.deliveryBackdrop}>
          <View style={styles.deliveryCard}>
            <Text style={styles.deliveryTitle}>Delivery & contact</Text>
            <Text style={styles.deliverySub}>
              Choose delivery. Pudo R70 or standard courier R150 — included in your total (ZAR only).
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
                  Courier (R150)
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
              <Text style={styles.deliveryFieldLabel}>Your bank (optional, helps match EFT)</Text>
              <TextInput
                value={customerEftName}
                onChangeText={setCustomerEftName}
                placeholder="Account holder"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
              />
              <TextInput
                value={customerEftBank}
                onChangeText={setCustomerEftBank}
                placeholder="Bank name"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
              />
              <TextInput
                value={customerEftAcct}
                onChangeText={setCustomerEftAcct}
                placeholder="Account number"
                placeholderTextColor={theme.mutedForegroundColor}
                style={styles.deliveryInput}
                keyboardType="number-pad"
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
        </View>
      </Modal>

      <Modal visible={eftModalOpen} animationType="slide" transparent>
        <View style={styles.checkoutBackdrop}>
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
                    <FeatherIcon name="copy" size={18} color={CHECKOUT_ACCENT} />
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
                    <FeatherIcon name="copy" size={18} color={CHECKOUT_ACCENT} />
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
                        <FeatherIcon name="copy" size={18} color={CHECKOUT_ACCENT} />
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
        </View>
      </Modal>

      <Modal visible={peachModalOpen} animationType="slide">
        <View style={styles.peachPage}>
          <View style={styles.peachHeaderBar}>
            <Text style={styles.checkoutTitle}>Card payment (Peach)</Text>
            <TouchableOpacity onPress={() => setPeachModalOpen(false)} hitSlop={12}>
              <Text style={styles.checkoutGhostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          {peachWidgetUrl ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: peachHtml, baseUrl: 'https://oppwa.com' }}
              style={styles.peachWeb}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
  },
  safeTop: {
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
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
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
  },
  heroImageWrap: {
    borderRadius: 16,
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
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
    color: theme.mutedForegroundColor,
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
    alignItems: 'center',
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
    borderColor: 'rgba(203,255,0,0.35)',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlinePrice: {
    color: HOME_ACCENT_BG,
    fontFamily: theme.boldFont,
    fontSize: 22,
  },
  compareAtPrice: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: theme.mediumFont,
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: HOME_CHIP_FILL,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || 'rgba(203,255,0,0.28)',
  },
  metaChipText: {
    fontFamily: theme.mediumFont,
    color: HOME_ACCENT_BG,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
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
    borderColor: 'rgba(203,255,0,0.28)',
  },
  optionButtonActive: {
    borderWidth: 2,
    borderColor: HOME_ACCENT_BG,
    backgroundColor: HOME_CHIP_FILL,
  },
  optionText: {
    color: HOME_ACCENT_BG,
    fontFamily: theme.mediumFont,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.88,
  },
  optionTextActive: {
    color: HOME_ACCENT_BG,
    opacity: 1,
    fontFamily: theme.boldFont,
  },
  sectionTitle: {
    fontFamily: theme.boldFont,
    color: theme.headingColor || theme.textColor,
    fontSize: 18,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: theme.regularFont,
    color: theme.mutedForegroundColor,
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
    borderColor: 'rgba(203,255,0,0.55)',
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
    borderColor: 'rgba(203,255,0,0.55)',
  },
  qtyValue: {
    color: HOME_ACCENT_BG,
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
    borderColor: HOME_ACCENT_BG,
  },
  price: {
    color: HOME_ACCENT_BG,
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
    borderColor: HOME_ACCENT_BG,
  },
  addButtonText: {
    color: HOME_ACCENT_BG,
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
  },
  buyButton: {
    flex: 1,
    backgroundColor: HOME_ACCENT_BG,
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
  deliveryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  deliveryCard: {
    borderRadius: 18,
    padding: 16,
    maxHeight: '92%',
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
  },
  deliveryTitle: {
    fontFamily: theme.boldFont,
    fontSize: 20,
    color: theme.headingColor || theme.textColor,
    marginBottom: 6,
  },
  deliverySub: {
    fontFamily: theme.regularFont,
    fontSize: 13,
    color: theme.mutedForegroundColor,
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
    borderColor: 'rgba(203,255,0,0.3)',
  },
  deliveryChipActive: {
    borderWidth: 2,
    borderColor: HOME_ACCENT_BG,
  },
  deliveryChipText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 12,
    color: HOME_ACCENT_BG,
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
    color: theme.mutedForegroundColor,
    marginBottom: 4,
    marginTop: 8,
  },
  deliveryInput: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: theme.mediumFont,
    fontSize: 15,
    color: theme.textColor,
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
    borderColor: theme.borderColor,
  },
  deliveryCancelText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 14,
    color: theme.textColor,
  },
  deliveryContinueBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: HOME_ACCENT_BG,
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
    color: CHECKOUT_ACCENT,
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
    color: CHECKOUT_ACCENT,
    marginTop: 8,
    marginBottom: 10,
  },
  checkoutLabel: {
    fontFamily: theme.mediumFont,
    fontSize: 11,
    color: 'rgba(203,255,0,0.65)',
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
    borderColor: 'rgba(203,255,0,0.25)',
  },
  copyTextCol: { flex: 1, minWidth: 0 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(203,255,0,0.12)',
  },
  copyBtnText: {
    fontFamily: theme.semiBoldFont,
    fontSize: 13,
    color: CHECKOUT_ACCENT,
  },
  checkoutPrimaryBtn: {
    backgroundColor: CHECKOUT_ACCENT,
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
    color: 'rgba(203,255,0,0.85)',
  },
  peachPage: { flex: 1, backgroundColor: CHECKOUT_FILL },
  peachHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 18,
    borderBottomWidth: 2,
    borderBottomColor: CHECKOUT_ACCENT,
    backgroundColor: CHECKOUT_FILL,
  },
  peachWeb: { flex: 1, backgroundColor: '#0a0a0a' },
})
