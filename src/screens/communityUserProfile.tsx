import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { AvatarFrameWrapper, coerceAvatarFrameId } from '../components'
import { fetchCommunityUserPublicProfile } from '../communityUserPublicApi'
import { resolveCommunityUserStub } from '../communityUserProfileStubs'
import {
  PROFILE_HERO_AVATAR,
  PROFILE_HERO_BANNER_H,
  PROFILE_HERO_BANNER_OVERLAP_PX,
  profileHeroRightColumnPaddingTop,
} from '../profileHeroLayout'

/** Temporary banner fill (Discord-ish); swap for image URL when the API supports it. */
const COMMUNITY_PROFILE_BANNER_PURPLE = '#5B45D6'

export type CommunityUserProfileRouteParams = {
  userId: string
  fullName: string
  profilePicture?: string | null
  avatarFrameId?: string | null
  sessionToken: string
}

export function CommunityUserProfile() {
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const params = route.params as CommunityUserProfileRouteParams | undefined

  const userId = String(params?.userId || '')
  const fullName = String(params?.fullName || 'Member')
  const profilePicture = params?.profilePicture?.trim() || null
  const avatarFrameId = coerceAvatarFrameId(params?.avatarFrameId)
  const sessionToken = String(params?.sessionToken || '')

  const [apiDetail, setApiDetail] = useState<Awaited<ReturnType<typeof fetchCommunityUserPublicProfile>>>(null)
  const [apiChecked, setApiChecked] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: fullName,
      headerTransparent: false,
      headerStyle: {
        backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
      },
      headerTintColor: theme.textColor,
      headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
      headerShadowVisible: false,
    })
  }, [navigation, fullName, theme])

  useEffect(() => {
    let cancelled = false
    if (!userId || !sessionToken) {
      setApiChecked(true)
      return () => {
        cancelled = true
      }
    }
    fetchCommunityUserPublicProfile(sessionToken, userId)
      .then((detail) => {
        if (!cancelled) setApiDetail(detail)
      })
      .finally(() => {
        if (!cancelled) setApiChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken, userId])

  const stub = useMemo(() => resolveCommunityUserStub(userId, fullName), [userId, fullName])

  const bio =
    (apiDetail?.bio && String(apiDetail.bio).trim()) ||
    (stub?.bio && stub.bio.trim()) ||
    null

  const tagline =
    (apiDetail?.tagline && String(apiDetail.tagline).trim()) ||
    (stub?.tagline && stub.tagline.trim()) ||
    null

  const styles = useMemo(() => getStyles(theme), [theme])

  const overlap = PROFILE_HERO_BANNER_OVERLAP_PX

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={[styles.banner, { height: PROFILE_HERO_BANNER_H, backgroundColor: COMMUNITY_PROFILE_BANNER_PURPLE }]} />

        <View style={[styles.discordRow, { marginTop: -overlap, paddingBottom: 16 }]}>
          <View style={styles.leftCol}>
            <View style={[styles.avatarShell, { width: PROFILE_HERO_AVATAR, height: PROFILE_HERO_AVATAR }]}>
              <AvatarFrameWrapper
                frameId={avatarFrameId}
                size={PROFILE_HERO_AVATAR}
                fit="default"
                innerBackgroundColor={profilePicture ? 'transparent' : '#000000'}
              >
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <FeatherIcon name="user" size={Math.round(PROFILE_HERO_AVATAR * 0.45)} color="#A8A8A8" />
                  </View>
                )}
              </AvatarFrameWrapper>
            </View>
            <Text style={styles.displayName} numberOfLines={2}>
              {fullName}
            </Text>
          </View>

          <View style={styles.rightCol}>
            {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}

            {bio ? (
              <Text style={styles.bio}>{bio}</Text>
            ) : apiChecked ? (
              <Text style={styles.placeholder}>No extra bio for this person yet.</Text>
            ) : (
              <Text style={styles.placeholder}>Loading…</Text>
            )}

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Photo, frame, and name from chat. More fields when the API exists or you add id-based stubs.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: 32,
    },
    profileCard: {
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      overflow: 'visible',
      marginHorizontal: 12,
      marginTop: 4,
      backgroundColor: theme.tileBackgroundColor || 'rgba(255,255,255,0.06)',
    },
    banner: {
      width: '100%',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },
    discordRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 14,
      gap: 14,
    },
    leftCol: {
      width: PROFILE_HERO_AVATAR + 24,
      alignItems: 'flex-start',
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
    displayName: {
      marginTop: 10,
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 19,
      lineHeight: 24,
      textAlign: 'left',
      width: '100%',
    },
    rightCol: {
      flex: 1,
      minWidth: 0,
      paddingTop: profileHeroRightColumnPaddingTop(),
    },
    tagline: {
      color: theme.mutedForegroundColor || 'rgba(255,255,255,0.65)',
      fontFamily: theme.mediumFont,
      fontSize: 13,
      marginBottom: 8,
    },
    bio: {
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
    },
    placeholder: {
      color: theme.mutedForegroundColor || 'rgba(255,255,255,0.6)',
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
    },
    notice: {
      marginTop: 14,
      padding: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    noticeText: {
      color: theme.mutedForegroundColor || 'rgba(255,255,255,0.55)',
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 16,
    },
  })
}

