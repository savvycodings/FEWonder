import { useCallback, useContext, useState } from 'react'
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
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect } from '@react-navigation/native'
import {
  AVATAR_FRAME_SIZE_PROFILE,
  AvatarFrameWrapper,
  useEquippedAvatarFrame,
} from '../components'
import { AppContext, ThemeContext } from '../context'
import { User } from '../../types'
import * as ImagePicker from 'expo-image-picker'
import { getDailyRewardStatus, updateProfileDetails, uploadProfilePicture } from '../utils'

const recentOrders = [
  {
    id: '#WP-2049',
    name: 'Le Petit Prince Series',
    status: 'Shipped',
    total: '$48.00',
    image: require('../../public/homepageimgs/product1.webp'),
  },
  {
    id: '#WP-2027',
    name: 'Skullpanda Winter',
    status: 'Delivered',
    total: '$32.99',
    image: require('../../public/homepageimgs/product2.webp'),
  },
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
  const { frameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()
  const [walletBalance, setWalletBalance] = useState(0)
  const { cartItems, savedItems } = useContext(AppContext)
  const cartQuantityTotal = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)
  const [isUploading, setIsUploading] = useState(false)
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsMode, setDetailsMode] = useState<'shipping' | 'payment'>('shipping')
  const [shippingInput, setShippingInput] = useState(user.shippingAddress?.trim() || '')
  const [paymentInput, setPaymentInput] = useState(user.paymentMethod?.trim() || '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  useFocusEffect(
    useCallback(() => {
      refreshAvatarFrame()
      if (!sessionToken) return
      getDailyRewardStatus(sessionToken)
        .then((s) => setWalletBalance(s.walletBalance))
        .catch(() => {})
    }, [sessionToken, refreshAvatarFrame])
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

  const accountActions = [
    { label: 'Shopping Cart', key: 'cart', icon: 'shopping-bag' },
    { label: 'Saved Items', key: 'saved', icon: 'heart' },
    {
      label: 'Shipping Address',
      key: 'shipping',
      value: user.shippingAddress?.trim() || 'Not added',
      icon: 'map-pin',
    },
    {
      label: 'Payment Method',
      key: 'payment',
      value: user.paymentMethod?.trim() || 'Not added',
      icon: 'credit-card',
    },
  ]

  function openDetailsModal(mode: 'shipping' | 'payment') {
    setDetailsMode(mode)
    setDetailsError('')
    setShowDetailsModal(true)
  }

  async function saveDetails() {
    if (savingDetails) return
    try {
      setSavingDetails(true)
      setDetailsError('')
      const updatedUser = await updateProfileDetails({
        sessionToken,
        shippingAddress:
          detailsMode === 'shipping'
            ? shippingInput.trim()
            : (user.shippingAddress || '').trim(),
        paymentMethod:
          detailsMode === 'payment'
            ? paymentInput.trim()
            : (user.paymentMethod || '').trim(),
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
            frameId={frameId}
            size={AVATAR_FRAME_SIZE_PROFILE}
            innerBackgroundColor={
              localPreviewUri || user.profilePicture ? 'transparent' : theme.tileBackgroundColor
            }
          >
            {localPreviewUri || user.profilePicture ? (
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
          <Pressable
            style={styles.headerWallet}
            onPress={() =>
              navigation.navigate('ProfileDailyRewards', { sessionToken: sessionToken || '' })
            }
          >
            <FeatherIcon name="dollar-sign" size={16} color="#ffffff" />
            <Text style={styles.headerWalletValue}>{walletBalance}</Text>
          </Pressable>
          {isUploading ? <ActivityIndicator size="small" color="#ffffff" /> : null}
        </View>
      </View>
      {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

      <View style={styles.statsGroupCard}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>14</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
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

      <Text style={styles.sectionTitle}>Account</Text>
      <Text style={styles.sectionSubtitle}>Manage your profile, cart, payments, and shipping.</Text>
      <View style={styles.groupCard}>
        {accountActions.map((item, index) => (
          <Pressable
            key={item.label}
            style={[styles.actionRow, index !== accountActions.length - 1 ? styles.rowGap : null]}
            onPress={() => {
              if (item.key === 'cart') {
                navigation.navigate('ProfileCart')
              } else if (item.key === 'saved') {
                navigation.navigate('Saved')
              } else if (item.key === 'shipping') {
                openDetailsModal('shipping')
              } else if (item.key === 'payment') {
                openDetailsModal('payment')
              }
            }}
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconBubble}>
                <FeatherIcon name={item.icon as any} size={16} color={theme.tintColor || '#2a335f'} />
              </View>
              <View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text style={styles.actionValue}>
                  {item.key === 'cart'
                    ? `${cartQuantityTotal} items`
                    : item.key === 'saved'
                      ? `${savedItems.length} saved`
                      : item.value}
                </Text>
              </View>
            </View>
            <View style={styles.actionRight}>
              <FeatherIcon name="chevron-right" size={16} color="#97a0b6" />
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Previously Ordered</Text>
        <Text style={styles.link}>View all</Text>
      </View>
      <View style={styles.groupCard}>
        {recentOrders.map((order, index) => (
          <View key={order.id} style={[styles.orderRow, index !== recentOrders.length - 1 ? styles.rowGap : null]}>
            <View style={styles.orderThumb}>
              <Image source={order.image} style={styles.orderThumbImage} resizeMode="cover" />
            </View>
            <View style={styles.orderTextWrap}>
              <Text style={styles.orderName}>{order.name}</Text>
              <View style={styles.orderMetaRow}>
                <Text style={styles.orderMeta}>{order.id}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.orderTotal}>{order.total}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <FeatherIcon name="log-out" size={16} color="#ffffff" />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Modal visible={showDetailsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {detailsMode === 'shipping' ? 'Shipping Address' : 'Payment Method'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {detailsMode === 'shipping'
                ? 'Update your shipping address.'
                : 'Update your preferred payment method.'}
            </Text>

            {detailsMode === 'shipping' ? (
              <TextInput
                value={shippingInput}
                onChangeText={setShippingInput}
                placeholder="Shipping address"
                style={styles.modalInput}
                placeholderTextColor="#8b94aa"
              />
            ) : (
              <TextInput
                value={paymentInput}
                onChangeText={setPaymentInput}
                placeholder="Payment method"
                style={styles.modalInput}
                placeholderTextColor="#8b94aa"
              />
            )}

            {detailsError ? <Text style={styles.modalError}>{detailsError}</Text> : null}

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={saveDetails}>
                {savingDetails ? (
                  <ActivityIndicator color="#ffffff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#313d73',
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
    marginRight: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  headerWalletValue: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 14,
  },
  name: {
    color: '#ffffff',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  email: {
    color: 'rgba(255,255,255,.78)',
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
    backgroundColor: '#ececf4',
    borderRadius: 18,
    marginBottom: 20,
    padding: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#273163',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  statLabel: {
    color: '#8a93aa',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#243056',
    fontFamily: 'Geist-SemiBold',
    fontSize: 20,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#8d95aa',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginBottom: 10,
  },
  link: {
    color: '#f5a25d',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  sectionCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#243056',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#edf1f8',
  },
  groupCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#ececf4',
    borderRadius: 18,
    marginBottom: 20,
    padding: 10,
  },
  actionRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 13,
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
    backgroundColor: '#f3f6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#2f385e',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    marginBottom: 1,
  },
  actionValue: {
    color: '#8b94aa',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  actionRight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowGap: {
    marginBottom: 8,
  },
  orderRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#dfe6f5',
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
    color: '#273058',
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  orderMeta: {
    color: '#8b94aa',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    backgroundColor: '#ecf6ee',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: '#3e8c51',
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
  },
  orderTotal: {
    color: '#f5a25d',
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
    backgroundColor: '#2a335f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(22, 27, 46, .35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ebf3',
  },
  modalTitle: {
    color: '#243056',
    fontFamily: 'Geist-SemiBold',
    fontSize: 20,
  },
  modalSubtitle: {
    color: '#8b94aa',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d7deea',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#243056',
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
    borderColor: '#d7deea',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalSecondaryButtonText: {
    color: '#5f6884',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  modalPrimaryButton: {
    minWidth: 80,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#2a335f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalPrimaryButtonText: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
})
