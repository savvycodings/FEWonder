import { useCallback, useContext, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import {
  AvatarFrameWrapper,
  avatarPhotoDiscDiameterPoints,
  useEquippedAvatarFrame,
  WonderSpinningCoin,
} from '../components'
import { ProfileHeroBannerBackground } from '../components/ProfileHeroBannerBackground'
import { ProfileHeroBannerPickerModal } from '../components/ProfileHeroBannerPickerModal'
import { ThemeContext } from '../context'
import { User } from '../../types'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import {
  loadProfileHeroPreferences,
  saveProfileHeroPreferences,
  type ProfileHeroBadgeSlots,
  type ProfileHeroPreferences,
} from '../profileHeroPreferences'
import {
  getDailyRewardStatus,
  getProfileHero,
  updateProfileHero,
  uploadProfileBanner,
  uploadProfilePicture,
} from '../utils'
import { brandAccentRgba } from '../brandAccent'
import { PROFILE_HERO_BADGE_GAP } from '../profileHeroBadgeLayout'
import {
  PROFILE_HERO_BANNER_H,
  PROFILE_HERO_PROFILE_AVATAR,
  PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
  profileHeroProfileOverlapMarginTop,
} from '../profileHeroLayout'
import { encodeProfileBannerColor } from '../profileHeroBanner'

const PROFILE_PHOTO_OVERLAY_SIZE = avatarPhotoDiscDiameterPoints(PROFILE_HERO_PROFILE_AVATAR, 'default')

export function ProfileHeroEdit({
  navigation,
  user,
  sessionToken,
  onUserUpdated,
}: {
  navigation: any
  user: User
  sessionToken: string
  onUserUpdated: (user: User) => Promise<void>
}) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { frameId: avatarFrameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()
  const [prefs, setPrefs] = useState<ProfileHeroPreferences | null>(null)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [showBannerPicker, setShowBannerPicker] = useState(false)
  const displayName = user.fullName?.trim() || user.email?.split('@')[0] || 'Member'
  const avatarInitial = displayName.charAt(0).toUpperCase()

  const loadWalletBalance = useCallback(async () => {
    if (!sessionToken) return
    try {
      const rewards = await getDailyRewardStatus(sessionToken)
      setWalletBalance(rewards.walletBalance || 0)
    } catch (error) {
      console.log('Failed to load wallet balance', error)
    }
  }, [sessionToken])

  const reload = useCallback(async () => {
    const local = await loadProfileHeroPreferences()
    if (!sessionToken) {
      setPrefs(local)
      return
    }
    try {
      const remote = await getProfileHero(sessionToken)
      const merged: ProfileHeroPreferences = {
        bannerUri: remote.bannerUrl,
        badgeSlots: remote.badgeSlots,
      }
      await saveProfileHeroPreferences(merged)
      setPrefs(merged)
    } catch {
      setPrefs(local)
    }
  }, [sessionToken])

  useFocusEffect(
    useCallback(() => {
      reload()
      refreshAvatarFrame()
      loadWalletBalance()
    }, [reload, refreshAvatarFrame, loadWalletBalance])
  )

  async function applyBannerUri(uri: string | null) {
    try {
      setBusy(true)
      const base = prefs ?? (await loadProfileHeroPreferences())
      let savedUri = uri
      if (sessionToken) {
        const remote = await updateProfileHero(sessionToken, { bannerUrl: uri })
        savedUri = remote.bannerUrl
      }
      const next: ProfileHeroPreferences = { ...base, bannerUri: savedUri }
      await saveProfileHeroPreferences(next)
      setPrefs(next)
    } catch (error) {
      console.log('Failed to save profile banner', error)
    } finally {
      setBusy(false)
    }
  }

  async function pickBannerFromGallery() {
    if (busy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
      base64: true,
    })
    if (picked.canceled || !picked.assets?.[0]?.base64) return
    try {
      setBusy(true)
      let uri: string | null = null
      if (sessionToken) {
        const uploaded = await uploadProfileBanner({
          sessionToken,
          imageBase64: String(picked.assets[0].base64 || ''),
          mimeType: picked.assets[0].mimeType || 'image/jpeg',
        })
        uri = uploaded.bannerUrl
      }
      const base = prefs ?? (await loadProfileHeroPreferences())
      const next: ProfileHeroPreferences = { ...base, bannerUri: uri }
      await saveProfileHeroPreferences(next)
      setPrefs(next)
    } catch (error) {
      console.log('Failed to upload profile banner', error)
    } finally {
      setBusy(false)
    }
  }

  async function applyBannerColor(hex: string) {
    setShowBannerPicker(false)
    await applyBannerUri(encodeProfileBannerColor(hex))
  }

  async function pickProfilePhoto() {
    if (photoBusy || !sessionToken) return
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
      setPhotoError('')
      setPhotoBusy(true)
      const asset = picked.assets[0]
      const updatedUser = await uploadProfilePicture({
        sessionToken,
        imageBase64: asset.base64 ?? '',
        mimeType: asset.mimeType || 'image/jpeg',
      })
      await onUserUpdated(updatedUser)
    } catch (e) {
      console.log('Failed to upload profile photo', e)
      setPhotoError('Could not save photo. Try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function clearBanner() {
    setShowBannerPicker(false)
    await applyBannerUri(null)
  }

  async function persistBadgeSlots(slots: ProfileHeroBadgeSlots) {
    const base = prefs ?? (await loadProfileHeroPreferences())
    const next: ProfileHeroPreferences = { ...base, badgeSlots: slots }
    if (sessionToken) {
      await updateProfileHero(sessionToken, { badgeSlots: slots })
    }
    await saveProfileHeroPreferences(next)
    setPrefs(next)
  }

  function goWonderStore() {
    navigation.navigate('ProfileDailyRewards', { sessionToken })
  }

  async function removeBadgeAt(index: 0 | 1 | 2) {
    const base = prefs ?? (await loadProfileHeroPreferences())
    const next: ProfileHeroBadgeSlots = [base.badgeSlots[0], base.badgeSlots[1], base.badgeSlots[2]]
    next[index] = null
    await persistBadgeSlots(next)
  }

  if (!prefs) {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator color={theme.brandAccent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Pressable
          onPress={() => setShowBannerPicker(true)}
          disabled={busy}
          style={styles.bannerPress}
        >
          <View style={[styles.banner, { height: PROFILE_HERO_BANNER_H }]}>
            <ProfileHeroBannerBackground
              bannerUri={prefs.bannerUri}
              defaultBackgroundColor={theme.brandAccent}
            />
            <View style={[StyleSheet.absoluteFillObject, styles.bannerTint]} />
          </View>
        </Pressable>

        <View
          style={[
            styles.heroOverlapBlock,
            { marginTop: profileHeroProfileOverlapMarginTop() },
          ]}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroAvatarOnlyRow}>
              <View style={styles.heroAvatarColumn}>
                <Pressable
                  onPress={() => void pickProfilePhoto()}
                  disabled={photoBusy || !sessionToken}
                  style={[
                    styles.avatarShell,
                    { width: PROFILE_HERO_PROFILE_AVATAR, height: PROFILE_HERO_PROFILE_AVATAR },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                >
                  <AvatarFrameWrapper
                    frameId={avatarFrameId}
                    size={PROFILE_HERO_PROFILE_AVATAR}
                    fit="default"
                    innerBackgroundColor={user.profilePicture ? 'transparent' : '#FFFFFF'}
                  >
                    {user.profilePicture ? (
                      <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                      </View>
                    )}
                  </AvatarFrameWrapper>
                  <View
                    style={[
                      styles.avatarPhotoHint,
                      {
                        width: PROFILE_PHOTO_OVERLAY_SIZE,
                        height: PROFILE_PHOTO_OVERLAY_SIZE,
                        borderRadius: PROFILE_PHOTO_OVERLAY_SIZE / 2,
                        marginTop: -PROFILE_PHOTO_OVERLAY_SIZE / 2,
                        marginLeft: -PROFILE_PHOTO_OVERLAY_SIZE / 2,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    {photoBusy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <FeatherIcon name="edit-2" size={18} color="#ffffff" />
                    )}
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={styles.heroNameWalletRow}>
              <View style={styles.heroNameBadgesCluster}>
                <View style={styles.heroNameBand}>
                  <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">
                    {displayName}
                  </Text>
                </View>
                <View style={styles.heroBadgesWrap}>
                  <ProfileHeroBadgeStrip
                    slots={prefs.badgeSlots}
                    mode="edit"
                    variant="inline"
                    badgeGap={PROFILE_HERO_BADGE_GAP}
                    onEmptySlot={() => goWonderStore()}
                    onFilledSlot={(i) => void removeBadgeAt(i)}
                  />
                </View>
              </View>
              <View style={styles.heroNameWalletRowSpacer} />
              <View style={styles.heroWalletCluster} pointerEvents="box-none">
                <Pressable style={styles.heroWallet} onPress={goWonderStore}>
                  <WonderSpinningCoin size={18} fallbackColor={theme.brandAccent} />
                  <Text style={styles.heroWalletValue}>{walletBalance}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}

      <Pressable
        style={styles.actionRow}
        onPress={() => navigation.navigate('ProfileAccountSettings')}
      >
        <FeatherIcon name="user" size={18} color={theme.brandAccent} />
        <Text style={styles.actionRowText}>Edit name & email</Text>
        <FeatherIcon name="chevron-right" size={18} color={theme.mutedForegroundColor} />
      </Pressable>

      <Pressable style={styles.actionRow} onPress={goWonderStore}>
        <FeatherIcon name="shopping-bag" size={18} color={theme.brandAccent} />
        <Text style={styles.actionRowText}>Wonder Store</Text>
        <FeatherIcon name="chevron-right" size={18} color={theme.mutedForegroundColor} />
      </Pressable>

      <ProfileHeroBannerPickerModal
        visible={showBannerPicker}
        selectedBannerUri={prefs.bannerUri}
        onClose={() => setShowBannerPicker(false)}
        onPickGallery={() => void pickBannerFromGallery()}
        onPickColor={(hex) => void applyBannerColor(hex)}
        onUseDefault={() => void clearBanner()}
      />
    </ScrollView>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const cardFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const textPrimary = theme.textColor
  const textMuted = theme.mutedForegroundColor

  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 120,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: {
      borderRadius: 14,
      overflow: 'visible',
      backgroundColor: cardFill,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    bannerPress: {},
    banner: {
      width: '100%',
      backgroundColor: theme.brandAccent,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      overflow: 'hidden',
      position: 'relative',
    },
    bannerTint: {
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    heroOverlapBlock: {
      width: '100%',
      paddingHorizontal: 10,
      paddingTop: 0,
      paddingBottom: 10,
    },
    heroRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
    },
    heroAvatarOnlyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      alignSelf: 'stretch',
    },
    heroAvatarColumn: {
      width: PROFILE_HERO_PROFILE_AVATAR,
      alignItems: 'center',
      marginLeft: 8,
    },
    avatarShell: {
      borderRadius: 999,
      overflow: 'visible',
      position: 'relative',
    },
    avatarPhotoHint: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    photoError: {
      color: '#f87171',
      fontFamily: theme.mediumFont,
      fontSize: 13,
      marginBottom: 10,
      textAlign: 'center',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: '#111111',
      fontFamily: 'Montserrat_700Bold',
      fontSize: Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.42),
      lineHeight: Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.42),
      textAlign: 'center',
    },
    heroNameWalletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      marginLeft: 8,
      marginTop: PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
      paddingRight: 8,
    },
    heroNameBadgesCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minWidth: 0,
      gap: 10,
    },
    heroNameWalletRowSpacer: {
      flex: 1,
      minWidth: 8,
    },
    heroWalletCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexShrink: 0,
      gap: 10,
    },
    heroWallet: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 999,
      backgroundColor: L(0.08),
      borderWidth: 1,
      borderColor: L(0.35),
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    heroWalletValue: {
      color: theme.brandAccent,
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
    },
    heroNameBand: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    heroBadgesWrap: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    displayName: {
      color: textPrimary,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'left',
      alignSelf: 'flex-start',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: cardFill,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      marginBottom: 10,
    },
    actionRowText: {
      flex: 1,
      color: textPrimary,
      fontFamily: 'Geist-SemiBold',
      fontSize: 14,
    },
  })
}
