import { useCallback, useContext, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { AvatarFrameWrapper, useEquippedAvatarFrame } from '../components'
import { ThemeContext } from '../context'
import { User } from '../../types'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import {
  loadProfileHeroPreferences,
  saveProfileHeroPreferences,
  type ProfileHeroBadgeSlots,
  type ProfileHeroPreferences,
} from '../profileHeroPreferences'
import { getProfileHero, updateProfileHero, uploadProfileBanner, uploadProfilePicture } from '../utils'
import {
  PROFILE_HERO_BANNER_H,
  PROFILE_HERO_PROFILE_AVATAR,
  PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
  profileHeroProfileOverlapMarginTop,
} from '../profileHeroLayout'

const PROFILE_ACCENT = '#CBFF00'
const PROFILE_FILL = '#000000'
const PROFILE_HERO_TILE_BG = '#262626'

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
    }, [reload, refreshAvatarFrame])
  )

  async function pickBanner() {
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
      const uri = sessionToken
        ? (
            await uploadProfileBanner({
              sessionToken,
              imageBase64: String(picked.assets[0].base64 || ''),
              mimeType: picked.assets[0].mimeType || 'image/jpeg',
            })
          ).bannerUrl
        : null
      const base = prefs ?? (await loadProfileHeroPreferences())
      const next: ProfileHeroPreferences = { ...base, bannerUri: uri }
      if (sessionToken) {
        await updateProfileHero(sessionToken, { bannerUrl: uri })
      }
      await saveProfileHeroPreferences(next)
      setPrefs(next)
    } finally {
      setBusy(false)
    }
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
    const base = prefs ?? (await loadProfileHeroPreferences())
    const next: ProfileHeroPreferences = { ...base, bannerUri: null }
    if (sessionToken) {
      await updateProfileHero(sessionToken, { bannerUrl: null })
    }
    await saveProfileHeroPreferences(next)
    setPrefs(next)
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
        <ActivityIndicator color={PROFILE_ACCENT} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>
        Tap the banner or your profile photo to change them. Use the link below for your account name and email.
      </Text>

      <View style={styles.heroCard}>
        <Pressable onPress={pickBanner} disabled={busy} style={styles.bannerPress}>
          <View style={[styles.banner, { height: PROFILE_HERO_BANNER_H }]}>
            {prefs.bannerUri ? (
              <Image source={{ uri: prefs.bannerUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : null}
            <View style={[StyleSheet.absoluteFillObject, styles.bannerTint]} />
            <View style={styles.bannerHintWrap} pointerEvents="none">
              <View style={styles.bannerHintRow}>
                <FeatherIcon name="image" size={16} color="#ffffff" />
                <Text style={styles.bannerHint}>Tap to change banner</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {prefs.bannerUri ? (
          <Pressable style={styles.resetBanner} onPress={clearBanner}>
            <Text style={styles.resetBannerText}>Use default banner</Text>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.heroOverlapBlock,
            { marginTop: profileHeroProfileOverlapMarginTop() },
          ]}
        >
          <View style={styles.heroInnerRow}>
            <View style={styles.heroAvatarRow}>
              <View style={styles.heroAvatarCol}>
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
                    innerBackgroundColor={user.profilePicture ? 'transparent' : '#000000'}
                  >
                    {user.profilePicture ? (
                      <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <FeatherIcon
                          name="user"
                          size={Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.45)}
                          color="#A8A8A8"
                        />
                      </View>
                    )}
                  </AvatarFrameWrapper>
                  <View style={styles.avatarPhotoHint} pointerEvents="none">
                    {photoBusy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <View style={styles.avatarPhotoHintRow}>
                        <FeatherIcon name="camera" size={12} color="#ffffff" />
                        <Text style={styles.avatarPhotoHintText}>Photo</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
            <View style={styles.heroNameBadgesRow}>
              <View style={styles.heroNameBand}>
                <Text style={styles.displayName} numberOfLines={2}>
                  {user.fullName}
                </Text>
              </View>
              <View style={styles.heroBadgesWrap}>
                <ProfileHeroBadgeStrip
                  slots={prefs.badgeSlots}
                  mode="edit"
                  variant="inline"
                  onEmptySlot={() => goWonderStore()}
                  onFilledSlot={(i) => void removeBadgeAt(i)}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}

      <Pressable
        style={styles.secondaryRow}
        onPress={() => navigation.navigate('ProfileAccountSettings')}
      >
        <FeatherIcon name="user" size={18} color={PROFILE_ACCENT} />
        <Text style={styles.secondaryRowText}>Edit name & email</Text>
        <FeatherIcon name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
      </Pressable>

      <Pressable style={styles.storeRow} onPress={goWonderStore}>
        <FeatherIcon name="shopping-bag" size={18} color={PROFILE_ACCENT} />
        <Text style={styles.storeRowText}>Wonder Store (themes, frames & badges soon)</Text>
        <FeatherIcon name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
      </Pressable>
    </ScrollView>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 120,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    lead: {
      color: theme.mutedForegroundColor || 'rgba(255,255,255,0.65)',
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 14,
    },
    heroCard: {
      borderRadius: 14,
      overflow: 'visible',
      backgroundColor: PROFILE_HERO_TILE_BG,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    bannerPress: {},
    banner: {
      width: '100%',
      backgroundColor: PROFILE_ACCENT,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      overflow: 'hidden',
      position: 'relative',
    },
    bannerTint: {
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    bannerHintWrap: {
      position: 'absolute',
      right: 12,
      bottom: 10,
    },
    bannerHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bannerHint: {
      color: '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 13,
    },
    resetBanner: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    resetBannerText: {
      color: PROFILE_ACCENT,
      fontFamily: theme.mediumFont,
      fontSize: 12,
    },
    heroOverlapBlock: {
      width: '100%',
      paddingHorizontal: 10,
      paddingTop: 0,
      paddingBottom: 10,
    },
    heroInnerRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
    },
    heroAvatarRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      alignSelf: 'stretch',
    },
    heroAvatarCol: {
      width: PROFILE_HERO_PROFILE_AVATAR,
      alignItems: 'center',
      marginLeft: 8,
    },
    avatarShell: {
      borderRadius: 999,
      overflow: 'hidden',
      position: 'relative',
    },
    avatarPhotoHint: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      borderBottomLeftRadius: 999,
      borderBottomRightRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    avatarPhotoHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    avatarPhotoHintText: {
      color: '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 10,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
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
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroNameBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexWrap: 'wrap',
      maxWidth: '100%',
      marginLeft: 8,
      marginTop: PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
      paddingRight: 8,
      gap: 10,
    },
    heroNameBand: {
      flexGrow: 0,
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
      color: '#ffffff',
      fontFamily: 'Montserrat_700Bold',
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'left',
      alignSelf: 'flex-start',
    },
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.22)',
      marginBottom: 10,
    },
    secondaryRowText: {
      flex: 1,
      color: '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 14,
    },
    storeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.22)',
    },
    storeRowText: {
      flex: 1,
      color: '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 14,
    },
  })
}
