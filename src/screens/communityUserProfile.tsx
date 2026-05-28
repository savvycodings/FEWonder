import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { AvatarFrameWrapper, resolveEquippedAvatarFrameForDisplay } from '../components'
import { ProfileHeroBannerBackground } from '../components/ProfileHeroBannerBackground'
import { ProfileHeroBadgeStrip } from '../profileHeroBadgeStrip'
import { fetchCommunityUserPublicProfile } from '../communityUserPublicApi'
import { resolveCommunityUserStub } from '../communityUserProfileStubs'
import { brandAccentRgba } from '../brandAccent'
import {
  PROFILE_HERO_BADGE_GAP,
  countEquippedProfileHeroBadges,
  profileHeroBadgeSlotSize,
} from '../profileHeroBadgeLayout'
import {
  PROFILE_HERO_BANNER_H,
  PROFILE_HERO_PROFILE_AVATAR,
  PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
  profileHeroProfileOverlapMarginTop,
} from '../profileHeroLayout'

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
  const fullName = String(params?.fullName || 'Member').trim() || 'Member'
  const profilePictureParam = params?.profilePicture?.trim() || null
  const sessionToken = String(params?.sessionToken || '')

  const [apiDetail, setApiDetail] = useState<Awaited<ReturnType<typeof fetchCommunityUserPublicProfile>>>(null)
  const [loading, setLoading] = useState(true)
  const [nameBadgesClusterWidth, setNameBadgesClusterWidth] = useState(0)
  const [nameNaturalWidth, setNameNaturalWidth] = useState(0)

  const profilePicture = apiDetail?.profilePicture?.trim() || profilePictureParam
  /** Prefer API frame, then chat snapshot — avoid `??` when API returns explicit `'none'`. */
  const avatarFrameId = resolveEquippedAvatarFrameForDisplay(
    apiDetail?.avatarFrameId,
    params?.avatarFrameId,
  )
  const badgeSlots = apiDetail?.badgeSlots ?? [null, null, null]
  const equippedBadgeCount = countEquippedProfileHeroBadges(badgeSlots)
  const avatarInitial = fullName.charAt(0).toUpperCase()

  const profileBadgeSlotSize = useMemo(
    () =>
      profileHeroBadgeSlotSize({
        clusterWidth: nameBadgesClusterWidth,
        nameNaturalWidth,
        badgeCount: equippedBadgeCount,
      }),
    [nameBadgesClusterWidth, nameNaturalWidth, equippedBadgeCount],
  )

  const stub = useMemo(() => resolveCommunityUserStub(userId, fullName), [userId, fullName])
  const bio =
    (apiDetail?.bio && String(apiDetail.bio).trim()) ||
    (stub?.bio && stub.bio.trim()) ||
    null

  const styles = useMemo(() => getStyles(theme), [theme])

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
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    fetchCommunityUserPublicProfile(sessionToken, userId)
      .then((detail) => {
        if (!cancelled) setApiDetail(detail)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken, userId])

  useEffect(() => {
    setNameNaturalWidth(0)
  }, [fullName])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeroCard}>
        <View style={[styles.profileHeroBanner, { height: PROFILE_HERO_BANNER_H }]}>
          <ProfileHeroBannerBackground
            bannerUri={apiDetail?.bannerUrl}
            defaultBackgroundColor={theme.brandAccent}
          />
        </View>

        <View
          style={[
            styles.profileHeroOverlapBlock,
            { marginTop: profileHeroProfileOverlapMarginTop() },
          ]}
        >
          <View style={styles.profileHeroRow}>
            <View style={styles.profileHeroAvatarOnlyRow}>
              <View style={styles.profileHeroAvatarColumn}>
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
                    innerBackgroundColor={profilePicture ? 'transparent' : '#FFFFFF'}
                  >
                    {profilePicture ? (
                      <Image source={{ uri: profilePicture }} style={styles.profileHeroAvatarImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.profileHeroAvatarPlaceholder}>
                        <Text style={styles.profileHeroAvatarInitial}>{avatarInitial}</Text>
                      </View>
                    )}
                  </AvatarFrameWrapper>
                </View>
              </View>
            </View>

            <View style={styles.profileHeroNameRow}>
              <View
                style={styles.profileHeroNameBadgesCluster}
                onLayout={(event) => {
                  const w = event.nativeEvent.layout.width
                  if (w > 0) setNameBadgesClusterWidth(w)
                }}
              >
                <Text
                  style={styles.profileHeroNameMeasure}
                  numberOfLines={1}
                  onTextLayout={(event) => {
                    const w = event.nativeEvent.lines[0]?.width ?? 0
                    if (w > 0) setNameNaturalWidth(w)
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {fullName}
                </Text>
                <View style={styles.profileHeroNameBand}>
                  <Text style={styles.profileHeroName} numberOfLines={1} ellipsizeMode="tail">
                    {fullName}
                  </Text>
                </View>
                <View style={styles.profileHeroBadgesWrap}>
                  <ProfileHeroBadgeStrip
                    slots={badgeSlots}
                    mode="home"
                    variant="inline"
                    slotSize={profileBadgeSlotSize}
                    badgeGap={PROFILE_HERO_BADGE_GAP}
                  />
                </View>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.brandAccent} size="small" />
            </View>
          ) : null}

          {bio ? (
            <View style={styles.profileHeroBioBlock}>
              <Text style={styles.profileHeroBio}>{bio}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const cardFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const textPrimary = theme.textColor
  const textMuted = theme.mutedForegroundColor

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
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
      backgroundColor: cardFill,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      position: 'relative',
    },
    profileHeroBanner: {
      width: '100%',
      backgroundColor: theme.brandAccent,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      overflow: 'hidden',
    },
    profileHeroOverlapBlock: {
      width: '100%',
      paddingHorizontal: 10,
      paddingTop: 0,
      paddingBottom: 12,
    },
    profileHeroRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
    },
    profileHeroAvatarOnlyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      alignSelf: 'stretch',
    },
    profileHeroAvatarColumn: {
      width: PROFILE_HERO_PROFILE_AVATAR,
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
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileHeroAvatarInitial: {
      color: '#111111',
      fontFamily: 'Montserrat_700Bold',
      fontSize: Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.42),
      lineHeight: Math.round(PROFILE_HERO_PROFILE_AVATAR * 0.42),
      textAlign: 'center',
    },
    profileHeroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      marginLeft: 8,
      marginTop: PROFILE_HERO_PROFILE_NAME_ROW_MARGIN_TOP,
      paddingRight: 8,
    },
    profileHeroNameBadgesCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minWidth: 0,
      gap: 10,
    },
    profileHeroNameMeasure: {
      position: 'absolute',
      opacity: 0,
      left: 0,
      top: 0,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 22,
      lineHeight: 28,
      maxWidth: 10000,
    },
    profileHeroNameBand: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    profileHeroName: {
      color: textPrimary,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'left',
      alignSelf: 'flex-start',
    },
    profileHeroBadgesWrap: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingRow: {
      paddingTop: 12,
      paddingHorizontal: 8,
      alignItems: 'flex-start',
    },
    profileHeroBioBlock: {
      marginTop: 14,
      paddingHorizontal: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: L(0.12),
    },
    profileHeroBio: {
      color: textMuted,
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
    },
  })
}
