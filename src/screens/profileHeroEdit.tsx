import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { AvatarFrameWrapper, useEquippedAvatarFrame } from '../components'
import { ThemeContext } from '../context'
import { User } from '../../types'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import {
  loadProfileHeroPreferences,
  persistBannerFromPickedAssetUri,
  PROFILE_HERO_BIO_MAX_LEN,
  PROFILE_HERO_BIO_PLACEHOLDER,
  saveProfileHeroPreferences,
  type ProfileHeroBadgeSlots,
  type ProfileHeroPreferences,
} from '../profileHeroPreferences'
import {
  PROFILE_HERO_AVATAR,
  PROFILE_HERO_BANNER_H,
  profileHeroBannerOverlapPx,
} from '../profileHeroLayout'

const PROFILE_ACCENT = '#CBFF00'
const PROFILE_FILL = '#000000'
const PROFILE_HERO_TILE_BG = '#262626'
const PROFILE_HERO_BANNER_PURPLE = '#5B45D6'

export function ProfileHeroEdit({
  navigation,
  user,
  sessionToken,
}: {
  navigation: any
  user: User
  sessionToken: string
}) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { frameId: avatarFrameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()
  const [prefs, setPrefs] = useState<ProfileHeroPreferences | null>(null)
  const [busy, setBusy] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')

  const reload = useCallback(async () => {
    const p = await loadProfileHeroPreferences()
    setPrefs(p)
  }, [])

  useFocusEffect(
    useCallback(() => {
      reload()
      refreshAvatarFrame()
    }, [reload, refreshAvatarFrame])
  )

  useEffect(() => {
    if (prefs) setBioInput(prefs.bio ?? '')
  }, [prefs])

  async function pickBanner() {
    if (busy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    })
    if (picked.canceled || !picked.assets?.[0]?.uri) return
    try {
      setBusy(true)
      const uri = await persistBannerFromPickedAssetUri(picked.assets[0].uri)
      const base = prefs ?? (await loadProfileHeroPreferences())
      const next: ProfileHeroPreferences = { ...base, bannerUri: uri }
      await saveProfileHeroPreferences(next)
      setPrefs(next)
    } finally {
      setBusy(false)
    }
  }

  async function clearBanner() {
    const base = prefs ?? (await loadProfileHeroPreferences())
    const next: ProfileHeroPreferences = { ...base, bannerUri: null }
    await saveProfileHeroPreferences(next)
    setPrefs(next)
  }

  async function persistBadgeSlots(slots: ProfileHeroBadgeSlots) {
    const base = prefs ?? (await loadProfileHeroPreferences())
    const next: ProfileHeroPreferences = { ...base, badgeSlots: slots }
    await saveProfileHeroPreferences(next)
    setPrefs(next)
  }

  async function persistBioFromInput() {
    if (!prefs || savingBio) return
    const trimmed = bioInput.trim() ? bioInput.trim().slice(0, PROFILE_HERO_BIO_MAX_LEN) : null
    if ((prefs.bio ?? '') === (trimmed ?? '')) return
    try {
      setSavingBio(true)
      const next: ProfileHeroPreferences = { ...prefs, bio: trimmed }
      await saveProfileHeroPreferences(next)
      setPrefs(next)
    } finally {
      setSavingBio(false)
    }
  }

  function goWonderStore() {
    navigation.navigate('ProfileDailyRewards', { sessionToken })
  }

  function confirmRemoveBadge(index: 0 | 1 | 2) {
    Alert.alert('Remove badge', 'Clear this showcase slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const base = prefs ?? (await loadProfileHeroPreferences())
            const next: ProfileHeroBadgeSlots = [base.badgeSlots[0], base.badgeSlots[1], base.badgeSlots[2]]
            next[index] = null
            await persistBadgeSlots(next)
          })()
        },
      },
    ])
  }

  async function applySampleBadges() {
    await persistBadgeSlots(['sample:star', 'sample:bolt', 'sample:spark'])
  }

  const overlap = profileHeroBannerOverlapPx()

  const bioDirty = useMemo(() => {
    if (!prefs) return false
    const a = bioInput.trim()
    const b = (prefs.bio ?? '').trim()
    return a !== b
  }, [prefs, bioInput])

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
        Banner, showcase badges, and photo. Use the link below for account name and email.
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
            <Text style={styles.resetBannerText}>Use default purple banner</Text>
          </Pressable>
        ) : null}

        <View style={[styles.heroRow, { marginTop: -overlap, paddingBottom: 32 }]}>
          <View style={styles.leftCol}>
            <View style={[styles.avatarShell, { width: PROFILE_HERO_AVATAR, height: PROFILE_HERO_AVATAR }]}>
              <AvatarFrameWrapper
                frameId={avatarFrameId}
                size={PROFILE_HERO_AVATAR}
                fit="default"
                innerBackgroundColor={user.profilePicture ? 'transparent' : '#000000'}
              >
                {user.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <FeatherIcon name="user" size={Math.round(PROFILE_HERO_AVATAR * 0.45)} color="#A8A8A8" />
                  </View>
                )}
              </AvatarFrameWrapper>
            </View>
          </View>
          <View style={styles.nameBadgeRow}>
            <View style={styles.nameBand}>
              <Text style={styles.displayName} numberOfLines={2}>
                {user.fullName}
              </Text>
            </View>
            <ProfileHeroBadgeStrip
              slots={prefs.badgeSlots}
              mode="edit"
              variant="inline"
              onEmptySlot={() => goWonderStore()}
              onFilledSlot={(i) => confirmRemoveBadge(i)}
            />
          </View>
          <Text style={styles.bioLabel}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bioInput}
            onChangeText={setBioInput}
            onBlur={() => void persistBioFromInput()}
            placeholder={PROFILE_HERO_BIO_PLACEHOLDER}
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={PROFILE_HERO_BIO_MAX_LEN}
            textAlignVertical="top"
            editable={!busy && !savingBio}
          />
          <View style={styles.bioSaveRow}>
            <Text style={styles.bioCharHint}>
              {bioInput.length}/{PROFILE_HERO_BIO_MAX_LEN}
            </Text>
            <Pressable
              style={[styles.bioSaveBtn, (!bioDirty || savingBio) && styles.bioSaveBtnDisabled]}
              onPress={() => void persistBioFromInput()}
              disabled={!bioDirty || savingBio}
            >
              <Text style={styles.bioSaveBtnText}>Save bio</Text>
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.sampleLink} onPress={applySampleBadges}>
          <Text style={styles.sampleLinkText}>Load sample badges (preview)</Text>
        </Pressable>
      </View>

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
      backgroundColor: PROFILE_HERO_BANNER_PURPLE,
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
    heroRow: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      paddingHorizontal: 14,
      paddingTop: 0,
      minHeight: 208,
    },
    leftCol: {
      width: PROFILE_HERO_AVATAR + 24,
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    avatarShell: {
      borderRadius: 999,
      overflow: 'visible',
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
    nameBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: 'stretch',
      gap: 14,
      marginTop: 18,
      flexWrap: 'wrap',
    },
    nameBand: {
      width: PROFILE_HERO_AVATAR + 24,
      alignItems: 'center',
    },
    displayName: {
      color: '#ffffff',
      fontFamily: 'Geist-Bold',
      fontSize: 19,
      lineHeight: 24,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    bioLabel: {
      marginTop: 10,
      alignSelf: 'flex-start',
      color: 'rgba(255,255,255,0.55)',
      fontFamily: theme.mediumFont,
      fontSize: 12,
      letterSpacing: 0.3,
    },
    bioInput: {
      marginTop: 6,
      alignSelf: 'stretch',
      minHeight: 72,
      maxHeight: 160,
      width: '100%',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(0,0,0,0.25)',
      color: 'rgba(255,255,255,0.9)',
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'left',
    },
    bioSaveRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
    },
    bioCharHint: {
      color: 'rgba(255,255,255,0.4)',
      fontFamily: theme.regularFont,
      fontSize: 11,
    },
    bioSaveBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: 'rgba(203,255,0,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.45)',
    },
    bioSaveBtnDisabled: {
      opacity: 0.35,
    },
    bioSaveBtnText: {
      color: PROFILE_ACCENT,
      fontFamily: 'Geist-SemiBold',
      fontSize: 13,
    },
    sampleLink: {
      marginTop: 6,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    sampleLinkText: {
      color: PROFILE_ACCENT,
      fontFamily: theme.mediumFont,
      fontSize: 12,
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
