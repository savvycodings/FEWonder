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
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect } from '@react-navigation/native'
import {
  AccountRowChevron,
  AvatarFrameWrapper,
  WonderSpinningCoin,
  useEquippedAvatarFrame,
} from '../components'
import { AppContext, ThemeContext } from '../context'
import { User } from '../../types'
import * as ImagePicker from 'expo-image-picker'
import { getDailyRewardStatus, uploadProfilePicture } from '../utils'
import { fetchMyOrders } from '../ordersApi'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import {
  PROFILE_HERO_AVATAR,
  PROFILE_HERO_BANNER_H,
  profileHeroBannerOverlapPx,
} from '../profileHeroLayout'
import { loadProfileHeroPreferences, type ProfileHeroPreferences } from '../profileHeroPreferences'

const PROFILE_ACCENT = '#CBFF00'
const PROFILE_FILL = '#000000'
/** Hero tile body (below banner) — dark grey section on profile. */
const PROFILE_HERO_TILE_BG = '#262626'
/** Same Discord-style banner as community member profile. */
const PROFILE_HERO_BANNER_PURPLE = '#5B45D6'

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
  const [showWalletModal, setShowWalletModal] = useState(false)
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
  const [heroPrefs, setHeroPrefs] = useState<ProfileHeroPreferences | null>(null)
  const { frameId: avatarFrameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()

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
      loadProfileHeroPreferences().then(setHeroPrefs)
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
  const accountDetails = [
    { label: 'Settings', key: 'settings', icon: 'sliders' as const, value: 'Profile, shipping & billing' },
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
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeroCard}>
        <View style={[styles.profileHeroBanner, { height: PROFILE_HERO_BANNER_H }]}>
          {heroPrefs?.bannerUri ? (
            <Image
              source={{ uri: heroPrefs.bannerUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : null}
        </View>

        <View
          style={[
            styles.profileHeroOverlapBlock,
            { marginTop: -profileHeroBannerOverlapPx() },
          ]}
        >
          <View style={styles.profileHeroRow}>
            <View style={styles.profileHeroAvatarColumn}>
              <Pressable
                style={[styles.profileHeroAvatarShell, { width: PROFILE_HERO_AVATAR, height: PROFILE_HERO_AVATAR }]}
                onPress={handleChangePhoto}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <AvatarFrameWrapper
                  frameId={avatarFrameId}
                  size={PROFILE_HERO_AVATAR}
                  fit="default"
                  innerBackgroundColor={
                    (localPreviewUri || user.profilePicture) ? 'transparent' : '#000000'
                  }
                >
                  {(localPreviewUri || user.profilePicture) ? (
                    <Image
                      source={{ uri: localPreviewUri || user.profilePicture || '' }}
                      style={styles.profileHeroAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.profileHeroAvatarPlaceholder}>
                      <FeatherIcon
                        name="user"
                        size={Math.round(PROFILE_HERO_AVATAR * 0.45)}
                        color="#A8A8A8"
                      />
                    </View>
                  )}
                </AvatarFrameWrapper>
              </Pressable>
            </View>
            <View style={styles.profileHeroNameBadgeRow}>
              <View style={styles.profileHeroNameBand}>
                <Text style={styles.profileHeroName} numberOfLines={2}>
                  {user.fullName}
                </Text>
              </View>
              <View style={styles.profileHeroBadgesWrap}>
                <ProfileHeroBadgeStrip
                  slots={heroPrefs?.badgeSlots ?? [null, null, null]}
                  mode="home"
                  variant="inline"
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileHeroFloatingChrome} pointerEvents="box-none">
          <View
            style={[styles.profileHeroWalletCluster, { top: PROFILE_HERO_BANNER_H + 6 }]}
            pointerEvents="box-none"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={PROFILE_ACCENT} />
            ) : null}
            <Pressable style={styles.profileHeroWallet} onPress={() => setShowWalletModal(true)}>
              <WonderSpinningCoin size={18} fallbackColor={PROFILE_ACCENT} />
              <Text style={styles.profileHeroWalletValue}>{walletBalance}</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.profileHeroEdit, styles.profileHeroEditFab]}
            onPress={() => navigation.navigate('ProfileHeroEdit')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <FeatherIcon name="edit-2" size={14} color="#ffffff" />
          </Pressable>
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
        {accountShopping.map((item, index) => (
          <Pressable
            key={item.key}
            style={[styles.actionRow, index < accountShopping.length - 1 ? styles.rowGap : null]}
            onPress={() => onAccountRowPress(item.key)}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBubble}>
                <FeatherIcon name={item.icon} size={22} color={PROFILE_ACCENT} />
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
            <AccountRowChevron accentColor={PROFILE_ACCENT} />
          </Pressable>
        ))}
        {accountDetails.map((item, index) => (
          <Pressable
            key={item.key}
            style={[
              styles.actionRow,
              index === 0 ? styles.accountDetailsFirstRow : null,
              index < accountDetails.length - 1 ? styles.rowGap : null,
            ]}
            onPress={() => onAccountRowPress(item.key)}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBubble}>
                <FeatherIcon name={item.icon} size={22} color={PROFILE_ACCENT} />
              </View>
              <View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text style={styles.actionValue}>{item.value}</Text>
              </View>
            </View>
            <AccountRowChevron accentColor={PROFILE_ACCENT} />
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
                <FeatherIcon name="package" size={20} color={PROFILE_ACCENT} />
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
        <FeatherIcon name="log-out" size={16} color={PROFILE_ACCENT} />
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
              <WonderSpinningCoin size={20} fallbackColor={theme.textColor} />
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

    </ScrollView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  profileHeroCard: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'visible',
    backgroundColor: PROFILE_HERO_TILE_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  profileHeroBanner: {
    width: '100%',
    backgroundColor: PROFILE_HERO_BANNER_PURPLE,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  profileHeroFloatingChrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    borderRadius: 14,
  },
  profileHeroWalletCluster: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  profileHeroOverlapBlock: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 32,
  },
  profileHeroRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    minHeight: 168,
  },
  profileHeroAvatarColumn: {
    width: PROFILE_HERO_AVATAR + 24,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  profileHeroNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    gap: 14,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  profileHeroBadgesWrap: {
    flexShrink: 0,
  },
  profileHeroNameBand: {
    width: PROFILE_HERO_AVATAR + 24,
    alignItems: 'center',
  },
  profileHeroAvatarShell: {
    borderRadius: 999,
    overflow: 'visible',
  },
  profileHeroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  profileHeroAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroName: {
    color: '#ffffff',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  profileHeroWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  profileHeroWalletValue: {
    color: PROFILE_ACCENT,
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
  },
  profileHeroEdit: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  profileHeroEditFab: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statsGroupCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
    borderRadius: 18,
    marginBottom: 20,
    padding: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: PROFILE_FILL,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.28)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: PROFILE_ACCENT,
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountHeading: {
    color: theme.headingColor || theme.textColor,
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.textColor,
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 20,
    marginBottom: 4,
  },
  link: {
    color: PROFILE_ACCENT,
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
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderWidth: 1,
    borderColor: theme.tileBorderColor || theme.borderColor,
    borderRadius: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: PROFILE_FILL,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.24)',
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
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    marginBottom: 1,
  },
  actionValue: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  rowGap: {
    marginBottom: 6,
  },
  accountDetailsFirstRow: {
    marginTop: 6,
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
    backgroundColor: PROFILE_FILL,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.22)',
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
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  orderMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: PROFILE_ACCENT,
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
  },
  orderTotal: {
    color: PROFILE_ACCENT,
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: PROFILE_ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: PROFILE_ACCENT,
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
