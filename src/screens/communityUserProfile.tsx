import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { AvatarFrameWrapper, coerceAvatarFrameId } from '../components'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import { fetchCommunityUserPublicProfile } from '../communityUserPublicApi'
import { resolveCommunityUserStub } from '../communityUserProfileStubs'
import {
  PROFILE_HERO_BANNER_H,
  PROFILE_HERO_PROFILE_AVATAR,
  profileHeroProfileOverlapMarginTop,
} from '../profileHeroLayout'

/** Temporary banner fill (Discord-ish); swap for image URL when the API supports it. */
const COMMUNITY_PROFILE_ACCENT = '#CBFF00'
const COMMUNITY_PROFILE_FILL = '#000000'
const COMMUNITY_PROFILE_HERO_TILE_BG = '#262626'

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeroCard}>
        <View style={[styles.profileHeroBanner, { height: PROFILE_HERO_BANNER_H }]}>
          {apiDetail?.bannerUrl ? (
            <Image source={{ uri: apiDetail.bannerUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
        </View>

        <View style={[styles.profileHeroOverlapBlock, { marginTop: profileHeroProfileOverlapMarginTop() }]}>
          <View style={styles.profileHeroAvatarRow}>
            <View
              style={[
                styles.profileHeroAvatarShell,
                { width: PROFILE_HERO_PROFILE_AVATAR, height: PROFILE_HERO_PROFILE_AVATAR },
              ]}
            >
              <AvatarFrameWrapper
                frameId={avatarFrameId}
                size={PROFILE_HERO_PROFILE_AVATAR}
                fit="default"
                innerBackgroundColor={profilePicture ? 'transparent' : COMMUNITY_PROFILE_FILL}
              >
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.profileHeroAvatarImage} resizeMode="cover" />
                ) : (
                  <View style={styles.profileHeroAvatarPlaceholder}>
                    <FeatherIcon
                      name="user"
                      size={Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.45)}
                      color="#A8A8A8"
                    />
                  </View>
                )}
              </AvatarFrameWrapper>
            </View>
          </View>
          <View style={styles.profileHeroContent}>
            <View style={styles.profileHeroNameBand}>
              <Text style={styles.profileHeroName} numberOfLines={2}>
                {fullName}
              </Text>
            </View>
            <View style={styles.profileHeroBadgesWrap}>
              <ProfileHeroBadgeStrip
                slots={apiDetail?.badgeSlots ?? [null, null, null]}
                mode="home"
                variant="inline"
              />
            </View>
            {tagline ? <Text style={styles.profileHeroTagline}>{tagline}</Text> : null}
            {bio ? (
              <Text style={styles.profileHeroBio}>{bio}</Text>
            ) : apiChecked ? (
              <Text style={styles.profileHeroPlaceholder}>No extra bio for this person yet.</Text>
            ) : (
              <Text style={styles.profileHeroPlaceholder}>Loading…</Text>
            )}
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
      backgroundColor: COMMUNITY_PROFILE_FILL,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    profileHeroCard: {
      width: '100%',
      alignSelf: 'stretch',
      borderRadius: 14,
      overflow: 'visible',
      backgroundColor: COMMUNITY_PROFILE_HERO_TILE_BG,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      position: 'relative',
    },
    profileHeroBanner: {
      width: '100%',
      backgroundColor: COMMUNITY_PROFILE_ACCENT,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      overflow: 'hidden',
    },
    profileHeroOverlapBlock: {
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      width: '100%',
      paddingHorizontal: 10,
      paddingBottom: 12,
    },
    profileHeroAvatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
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
      backgroundColor: COMMUNITY_PROFILE_FILL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileHeroContent: {
      marginTop: 12,
      paddingHorizontal: 8,
    },
    profileHeroNameBand: {
      alignSelf: 'flex-start',
      minWidth: 0,
      marginBottom: 6,
    },
    profileHeroName: {
      color: '#ffffff',
      fontFamily: 'Montserrat_700Bold',
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'left',
    },
    profileHeroTagline: {
      color: 'rgba(255,255,255,0.78)',
      fontFamily: theme.mediumFont,
      fontSize: 14,
      marginBottom: 10,
    },
    profileHeroBadgesWrap: {
      marginBottom: 8,
      minHeight: 20,
    },
    profileHeroBio: {
      color: '#ffffff',
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
    },
    profileHeroPlaceholder: {
      color: 'rgba(255,255,255,0.65)',
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
    },
  })
}

