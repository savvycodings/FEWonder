import { useCallback, useContext, useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SvgUri } from 'react-native-svg'
import { useFocusEffect } from '@react-navigation/native'
import {
  AccountRowChevron,
  AVATAR_FRAME_SIZE_PROFILE,
  AvatarFrameWrapper,
  useEquippedAvatarFrame,
} from '../components'
import { AppContext, ThemeContext } from '../context'
import { User } from '../../types'
import * as ImagePicker from 'expo-image-picker'
import { getDailyRewardStatus, updateProfileDetails, uploadProfilePicture } from '../utils'
import { fetchMyOrders } from '../ordersApi'

const coinFrameUris = [
  '/homepageimgs/Coinrotation/CoinFRONT.svg',
  '/homepageimgs/Coinrotation/Coin2.svg',
  '/homepageimgs/Coinrotation/Coin3.svg',
  '/homepageimgs/Coinrotation/Coin4.svg',
  '/homepageimgs/Coinrotation/Coin5.svg',
  '/homepageimgs/Coinrotation/Coin6.svg',
  '/homepageimgs/Coinrotation/Coin7.svg',
  '/homepageimgs/Coinrotation/Coin8.svg',
  '/homepageimgs/Coinrotation/Coin9.svg',
  '/homepageimgs/Coinrotation/Coin10.svg',
  '/homepageimgs/Coinrotation/Coin11.svg',
  '/homepageimgs/Coinrotation/Coin12.svg',
  '/homepageimgs/Coinrotation/Coin13.svg',
  '/homepageimgs/Coinrotation/Coin14.svg',
  '/homepageimgs/Coinrotation/Coin15.svg',
  '/homepageimgs/Coinrotation/Coin16.svg',
  '/homepageimgs/Coinrotation/Coin17.svg',
  '/homepageimgs/Coinrotation/Coin18.svg',
  '/homepageimgs/Coinrotation/Coin19.svg',
  '/homepageimgs/Coinrotation/Coin20.svg',
  '/homepageimgs/Coinrotation/Coin21.svg',
  '/homepageimgs/Coinrotation/Coin22.svg',
  '/homepageimgs/Coinrotation/Coin23.svg',
  '/homepageimgs/Coinrotation/Coin24.svg',
  '/homepageimgs/Coinrotation/Coin25.svg',
  '/homepageimgs/Coinrotation/Coin26.svg',
  '/homepageimgs/Coinrotation/Coin27.svg',
  '/homepageimgs/Coinrotation/Coin28.svg',
  '/homepageimgs/Coinrotation/Coin29.svg',
  '/homepageimgs/Coinrotation/Coin30.svg',
  '/homepageimgs/Coinrotation/Coin31.svg',
  '/homepageimgs/Coinrotation/Coin32.svg',
]

export function Profile({
  navigation,
  user,
  onLogout,
  onUserUpdated,
  sessionToken,
}: {
  navigation: any
  user: User
  onLogout: () => Promise<void>
  onUserUpdated: (user: User) => Promise<void>
  sessionToken: string
}) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const { cartItems, savedItems } = useContext(AppContext)
  const cartQuantityTotal = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)
  const [isUploading, setIsUploading] = useState(false)
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [shippingInput, setShippingInput] = useState(user.shippingAddress?.trim() || '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [coinFrameIndex, setCoinFrameIndex] = useState(0)
  const [walletBalance, setWalletBalance] = useState(0)
  const [ordersPreview, setOrdersPreview] = useState<
    {
      id: string
      referenceCode: string
      status: string
      paymentMethod: string
      totalCents: number
      currencyCode: string
    }[]
  >([])
  const [orderTotalCount, setOrderTotalCount] = useState(0)
  const { frameId: avatarFrameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()

  useEffect(() => {
    const timer = setInterval(() => {
      setCoinFrameIndex((prev) => (prev + 1) % coinFrameUris.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  const loadWalletBalance = useCallback(async () => {
    if (!sessionToken) return
    try {
      const rewards = await getDailyRewardStatus(sessionToken)
      setWalletBalance(rewards.walletBalance || 0)
    } catch (error) {
      console.log('Failed to load wallet balance', error)
    }
  }, [sessionToken])

  const loadOrdersPreview = useCallback(async () => {
    if (!sessionToken) return
    try {
      const { orders } = await fetchMyOrders()
      const list = orders || []
      setOrderTotalCount(list.length)
      setOrdersPreview(list.slice(0, 4))
    } catch {
      setOrdersPreview([])
      setOrderTotalCount(0)
    }
  }, [sessionToken])

  useFocusEffect(
    useCallback(() => {
      loadWalletBalance()
      refreshAvatarFrame()
      loadOrdersPreview()
    }, [loadWalletBalance, refreshAvatarFrame, loadOrdersPreview])
  )

  async function handleChangePhoto() {
    if (isUploading) return

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    })

    if (picked.canceled || !picked.assets?.[0]?.base64) return

    try {
      setUploadError('')
      setIsUploading(true)
      const asset = picked.assets[0]
      if (asset.uri) {
        setLocalPreviewUri(asset.uri)
      }
      const updatedUser = await uploadProfilePicture({
        sessionToken,
        imageBase64: asset.base64 ?? '',
        mimeType: asset.mimeType || 'image/jpeg',
      })
      await onUserUpdated(updatedUser)
      setLocalPreviewUri(null)
    } catch (error) {
      console.log('Failed to upload profile photo', error)
      setUploadError('Could not save photo to cloud. Please try again.')
      setLocalPreviewUri(null)
    } finally {
      setIsUploading(false)
    }
  }

  const accountShopping = [
    { label: 'Shopping Cart', key: 'cart', icon: 'shopping-bag' as const },
    { label: 'Saved Items', key: 'saved', icon: 'heart' as const },
    { label: 'My orders', key: 'my_orders', icon: 'inbox' as const },
  ]
  const shippingPreview = user.shippingAddress?.trim() || 'No saved address'
  const accountDetails = [
    { label: 'Settings', key: 'settings', icon: 'sliders' as const, value: 'Theme & preferences' },
    {
      label: 'Shipping address',
      key: 'shipping_payment',
      value: shippingPreview,
      icon: 'package' as const,
    },
  ]

  function onAccountRowPress(key: string) {
    if (key === 'settings') {
      navigation.navigate('ProfileSettings')
    } else if (key === 'cart') {
      navigation.navigate('ProfileCart')
    } else if (key === 'saved') {
      navigation.navigate('Saved')
    } else if (key === 'my_orders') {
      navigation.navigate('ProfileMyOrders')
    } else if (key === 'shipping_payment') {
      openShippingPaymentModal()
    }
  }

  function openShippingPaymentModal() {
    setShippingInput(user.shippingAddress?.trim() || '')
    setDetailsError('')
    setShowDetailsModal(true)
  }

  function closeShippingPaymentModal() {
    setShowDetailsModal(false)
    setShippingInput(user.shippingAddress?.trim() || '')
    setDetailsError('')
  }

  async function saveDetails() {
    if (savingDetails) return
    try {
      setSavingDetails(true)
      setDetailsError('')
      const updatedUser = await updateProfileDetails({
        sessionToken,
        shippingAddress: shippingInput.trim(),
      })
      await onUserUpdated(updatedUser)
      setShowDetailsModal(false)
    } catch (error: any) {
      setDetailsError(error?.message || 'Could not update details')
    } finally {
      setSavingDetails(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Pressable style={styles.avatarPressable} onPress={handleChangePhoto}>
          <AvatarFrameWrapper
            frameId={avatarFrameId}
            size={AVATAR_FRAME_SIZE_PROFILE}
            innerBackgroundColor={(localPreviewUri || user.profilePicture) ? 'transparent' : theme.tileBackgroundColor}
          >
            {(localPreviewUri || user.profilePicture) ? (
              <Image
                source={{ uri: localPreviewUri || user.profilePicture || '' }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <FeatherIcon name="user" size={22} color={theme.textColor} />
            )}
          </AvatarFrameWrapper>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerWallet} onPress={() => setShowWalletModal(true)}>
            {Platform.OS === 'web' ? (
              <SvgUri uri={coinFrameUris[coinFrameIndex]} width={18} height={18} />
            ) : (
              <FeatherIcon name="dollar-sign" size={16} color={theme.tintColor} />
            )}
            <Text style={styles.headerWalletValue}>{walletBalance}</Text>
          </Pressable>
          {isUploading ? <ActivityIndicator size="small" color={theme.tintColor} /> : null}
        </View>
      </View>
      {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

      <View style={styles.statsGroupCard}>
        <View style={styles.statsRow}>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('ProfileMyOrders')}>
            <Text style={styles.statValue}>{orderTotalCount}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </Pressable>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{cartItems.length}</Text>
            <Text style={styles.statLabel}>In Cart</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{savedItems.length}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>
      </View>

      <Text style={styles.accountHeading}>Account</Text>
      <View style={styles.groupCard}>
        <Text style={styles.accountSectionLabel}>Shopping</Text>
        {accountShopping.map((item, index) => (
          <Pressable
            key={item.key}
            style={[styles.actionRow, index < accountShopping.length - 1 ? styles.rowGap : null]}
            onPress={() => onAccountRowPress(item.key)}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBubble}>
                <FeatherIcon name={item.icon} size={16} color={theme.tintColor} />
              </View>
              <View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text style={styles.actionValue}>
                  {item.key === 'cart'
                    ? `${cartQuantityTotal} items`
                    : item.key === 'saved'
                      ? `${savedItems.length} saved`
                      : item.key === 'my_orders'
                        ? `${orderTotalCount} order${orderTotalCount === 1 ? '' : 's'}`
                        : ''}
                </Text>
              </View>
            </View>
            <AccountRowChevron accentColor={theme.tintColor} />
          </Pressable>
        ))}
        <View style={styles.accountSectionDivider} />
        <Text style={[styles.accountSectionLabel, styles.accountSectionLabelSpaced]}>Profile & billing</Text>
        {accountDetails.map((item, index) => (
          <Pressable
            key={item.key}
            style={[styles.actionRow, index < accountDetails.length - 1 ? styles.rowGap : null]}
            onPress={() => onAccountRowPress(item.key)}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBubble}>
                <FeatherIcon name={item.icon} size={16} color={theme.tintColor} />
              </View>
              <View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text
                  style={styles.actionValue}
                  {...(item.key === 'shipping_payment' ? { numberOfLines: 2 } : {})}
                >
                  {item.value}
                </Text>
              </View>
            </View>
            <AccountRowChevron accentColor={theme.tintColor} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My orders</Text>
        <Pressable onPress={() => navigation.navigate('ProfileMyOrders')}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>
      <View style={styles.groupCard}>
        {ordersPreview.length === 0 ? (
          <Text style={styles.orderEmpty}>No orders yet. Buy something with EFT or Peach to see it here.</Text>
        ) : (
          ordersPreview.map((order, index) => (
            <Pressable
              key={order.id}
              style={[styles.orderRow, index !== ordersPreview.length - 1 ? styles.rowGap : null]}
              onPress={() => navigation.navigate('ProfileMyOrderDetail', { orderId: order.id })}
            >
              <View style={styles.orderThumb}>
                <FeatherIcon name="package" size={20} color={theme.tintColor} />
              </View>
              <View style={styles.orderTextWrap}>
                <Text style={styles.orderName}>{order.referenceCode}</Text>
                <View style={styles.orderMetaRow}>
                  <Text style={styles.orderMeta}>{order.paymentMethod?.toUpperCase()}</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.orderTotal}>
                {(order.totalCents / 100).toFixed(2)} {order.currencyCode}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <FeatherIcon name="log-out" size={16} color={theme.tintColor} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Modal visible={showWalletModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.walletModalCard]}>
            <View style={styles.walletHelpIconWrap}>
              <FeatherIcon name="help-circle" size={18} color={theme.mutedForegroundColor} />
            </View>
            <Text style={styles.walletModalTitle}>Wonder Wallet</Text>
            <Text style={styles.walletModalSubtitle}>Your current Wonder Wallet balance.</Text>

            <View style={styles.walletModalBalanceRow}>
              {Platform.OS === 'web' ? (
                <SvgUri uri={coinFrameUris[coinFrameIndex]} width={20} height={20} />
              ) : (
                <FeatherIcon name="dollar-sign" size={18} color={theme.textColor} />
              )}
              <Text style={styles.walletModalBalanceValue}>{walletBalance}</Text>
            </View>

            <View style={styles.walletModalButtons}>
              <Pressable style={styles.walletModalButtonSecondary} onPress={() => setShowWalletModal(false)}>
                <Text style={styles.walletModalButtonSecondaryText}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.walletModalButtonPrimary}
                onPress={() => {
                  setShowWalletModal(false)
                  navigation.getParent()?.navigate('Home', {
                    screen: 'DailyRewards',
                    params: { sessionToken },
                  })
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>Wonderstore</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.shippingPaymentModalCard]}>
            <Text style={styles.modalTitle}>Shipping address</Text>
            <Text style={styles.modalSubtitle}>
              Saved to your profile for faster checkout. You can also enter a different address when you buy.
            </Text>

            <ScrollView
              style={styles.shippingPaymentModalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalFieldLabel}>Shipping address</Text>
              <TextInput
                value={shippingInput}
                onChangeText={setShippingInput}
                placeholder="Street, city, postal code…"
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholderTextColor={theme.placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            {detailsError ? <Text style={styles.modalError}>{detailsError}</Text> : null}

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalSecondaryButton} onPress={closeShippingPaymentModal}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={saveDetails}>
                {savingDetails ? (
                  <ActivityIndicator color={theme.tintTextColor || '#fff'} />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.appBackgroundColor || '#f7f8fb',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.sheetBackgroundColor || theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1b244b',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  avatarPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerWalletValue: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
  },
  name: {
    color: theme.textColor,
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  email: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statsGroupCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.sheetBackgroundColor || theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    borderRadius: 18,
    marginBottom: 20,
    padding: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: theme.textColor,
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  statLabel: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountHeading: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 20,
    marginBottom: 4,
  },
  link: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  sectionCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#edf1f8',
  },
  groupCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.sheetBackgroundColor || theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    borderRadius: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  accountSectionLabel: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  accountSectionLabelSpaced: {
    marginTop: 0,
  },
  accountSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.tileBorderColor || '#e7ebf3',
    marginVertical: 8,
    marginHorizontal: 4,
  },
  actionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    marginBottom: 1,
  },
  actionValue: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  rowGap: {
    marginBottom: 6,
  },
  orderEmpty: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontFamily: theme.mediumFont,
    fontSize: 13,
    color: theme.mutedForegroundColor,
    textAlign: 'center',
  },
  orderRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.appBackgroundColor || '#f2f4f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  orderThumbImage: {
    width: '100%',
    height: '100%',
  },
  orderTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  orderName: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  orderMeta: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    backgroundColor: theme.appBackgroundColor || '#f2f4f8',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
  },
  orderTotal: {
    color: theme.textColor,
    fontFamily: 'Geist-Bold',
    fontSize: 15,
  },
  logoutButton: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
  },
  errorText: {
    marginTop: -6,
    marginBottom: 10,
    color: '#dc2626',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.modalOverlayColor || 'rgba(22, 27, 46, .35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
  },
  shippingPaymentModalCard: {
    maxHeight: '88%',
  },
  shippingPaymentModalScroll: {
    maxHeight: 320,
    marginBottom: 4,
  },
  modalFieldLabel: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
    marginBottom: 6,
  },
  modalFieldLabelSpaced: {
    marginTop: 4,
  },
  modalInputMultiline: {
    minHeight: 88,
    marginBottom: 4,
  },
  modalTitle: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 20,
  },
  modalSubtitle: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#d7deea',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.textColor,
    fontFamily: 'Geist-Medium',
    marginBottom: 10,
  },
  modalError: {
    color: '#dc2626',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  modalButtons: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalSecondaryButton: {
    minWidth: 80,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#d7deea',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalSecondaryButtonText: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  modalPrimaryButton: {
    minWidth: 80,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: theme.tintColor || theme.tileActiveBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalPrimaryButtonText: {
    color: theme.tintTextColor || '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  walletModalBalanceRow: {
    marginTop: 4,
    marginBottom: 10,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  walletModalBalanceValue: {
    color: theme.textColor,
    fontFamily: 'Geist-Bold',
    fontSize: 22,
  },
  walletModalCard: {
    position: 'relative',
  },
  walletHelpIconWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#e7ebf3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletModalTitle: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  walletModalSubtitle: {
    color: theme.mutedForegroundColor,
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
    textAlign: 'center',
  },
  walletModalButtons: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  walletModalButtonSecondary: {
    flex: 1,
    maxWidth: 150,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || '#cfd8ec',
    backgroundColor: theme.tileBackgroundColor || '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  walletModalButtonSecondaryText: {
    color: theme.textColor,
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  walletModalButtonPrimary: {
    flex: 1,
    maxWidth: 150,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: theme.tintColor || theme.tileActiveBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
})
