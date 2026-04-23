import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import Svg, { SvgUri } from 'react-native-svg'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DailyRewardItem, DailyRewardStatus, User } from '../../types'
import {
  claimDailyReward,
  getDailyRewardStatus,
  readDailyRewardsCache,
  syncEquippedAvatarFrame,
} from '../utils'
import {
  AVATAR_FRAME_SHOP,
  AVATAR_FRAME_SIZE_PREVIEW_TILE,
  AvatarFramePreviewTile,
  loadEquippedAvatarFrame,
  saveEquippedAvatarFrame,
} from '../components/AvatarFrame'
import type { AvatarFrameId } from '../components/AvatarFrame'
import { ThemeContext } from '../context'
import { WonderBadgeImage, WonderSpinningCoin, WonderStaticCoin } from '../components'
import {
  isProfileBadgeSlotFreeForWonderEquip,
  loadProfileHeroPreferences,
  saveProfileHeroPreferences,
  type ProfileHeroBadgeSlots,
} from '../profileHeroPreferences'
import { WONDER_BADGE_IDS, type WonderBadgeId } from '../wonderBadgesCatalog'

const weekDays = ['1', '2', '3', '4', '5', '6', '7']
const weekRewards = [1, 2, 3, 4, 5, 6, 7]
const DAILY_ACCENT = '#CBFF00'
const DAILY_FILL = '#000000'
/** Horizontal gap between reward cards (must match `rewardCarousel` `gap`). */
const REWARD_CAROUSEL_GAP = 10
/** Matches `rewardCarousel` `paddingRight`. */
const REWARD_CAROUSEL_PAD_RIGHT = 16
/** Matches outer `content` `paddingHorizontal` × 2 — carousel viewport width. */
const REWARD_CONTENT_H_PAD = 32
/** Isolated so Wonder Store doesn’t re-render on every spin frame. */
function RewardCarouselSpinningCoin({ color }: { color: string }): ReactElement {
  return <WonderSpinningCoin size={72} fallbackColor={color} />
}

function RewardStaticCoin({ size = 20 }: { size?: number }): ReactElement {
  return <WonderStaticCoin size={size} fallbackColor={DAILY_ACCENT} />
}

export function DailyRewards({ navigation, route }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { width: screenWidth } = useWindowDimensions()
  const [sessionToken, setSessionToken] = useState(String(route?.params?.sessionToken || ''))
  const [rewardStatus, setRewardStatus] = useState<DailyRewardStatus | null>(null)
  const [loadingRewards, setLoadingRewards] = useState(true)
  const [claimingReward, setClaimingReward] = useState(false)
  const [rewardsError, setRewardsError] = useState('')
  const [storeMessage, setStoreMessage] = useState('')
  const [equippedAvatarFrame, setEquippedAvatarFrame] = useState<AvatarFrameId>('none')
  const [framePreviewUser, setFramePreviewUser] = useState<{
    uri: string | null
    initial: string
  }>({ uri: null, initial: '?' })
  const [heroBadgeSlots, setHeroBadgeSlots] = useState<ProfileHeroBadgeSlots>([null, null, null])

  const fallbackRewards = useMemo<DailyRewardItem[]>(
    () => weekDays.map((day, index) => ({ day: Number(day), amount: weekRewards[index], status: 'locked' })),
    []
  )
  const rewards = rewardStatus?.rewards?.length ? rewardStatus.rewards : fallbackRewards
  const claimedCount = rewardStatus?.claimedCount || 0
  const currentStreak = rewardStatus?.currentStreakDays || claimedCount
  const walletBalance = rewardStatus?.walletBalance || 0
  const availableCoins = walletBalance
  const rewardCarouselViewportW = screenWidth - REWARD_CONTENT_H_PAD
  /** Two cards + one gap fill the viewport so only ~2 cards show at once. */
  const rewardCardWidth = useMemo(
    () => Math.max(140, Math.floor((rewardCarouselViewportW - REWARD_CAROUSEL_GAP) / 2)),
    [rewardCarouselViewportW],
  )
  const rewardCarouselRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)
  const [carouselScrollX, setCarouselScrollX] = useState(0)
  const rewardCarouselStep = rewardCardWidth + REWARD_CAROUSEL_GAP
  const rewardCarouselContentW = useMemo(() => {
    const n = rewards.length
    if (n <= 0) return 0
    return n * rewardCardWidth + Math.max(0, n - 1) * REWARD_CAROUSEL_GAP + REWARD_CAROUSEL_PAD_RIGHT
  }, [rewards.length, rewardCardWidth])
  const rewardCarouselMaxX = Math.max(0, rewardCarouselContentW - rewardCarouselViewportW)

  const carouselCanGoBack = carouselScrollX > 2
  const carouselCanGoForward = carouselScrollX < rewardCarouselMaxX - 2
  function scrollRewardCarousel(dir: -1 | 1) {
    const step = rewardCarouselStep
    const aligned = Math.round(scrollXRef.current / step) * step
    const base = Math.min(rewardCarouselMaxX, Math.max(0, aligned))
    const next = Math.min(rewardCarouselMaxX, Math.max(0, base + dir * step))
    rewardCarouselRef.current?.scrollTo({ x: next, animated: true })
  }
  /** Two-column badge shop: fixed width avoids `%` + `space-between` layout glitches on web/native. */
  const badgeStoreCardWidth = useMemo(
    () => Math.max(148, Math.floor((screenWidth - 32 - 11) / 2)),
    [screenWidth],
  )

  useEffect(() => {
    loadEquippedAvatarFrame().then(setEquippedAvatarFrame)
  }, [])

  const loadPreviewUser = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('wonderport-auth')
      if (!raw) return
      const parsed = JSON.parse(raw) as { user?: User }
      const u = parsed?.user
      if (!u) return
      const initial = (u.fullName || 'U').trim().slice(0, 1).toUpperCase() || '?'
      const uri = u.profilePicture?.trim() ? String(u.profilePicture) : null
      setFramePreviewUser({ uri, initial })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadPreviewUser()
  }, [loadPreviewUser])

  const refreshHeroBadges = useCallback(async () => {
    try {
      const p = await loadProfileHeroPreferences()
      setHeroBadgeSlots(p.badgeSlots)
    } catch {
      /* ignore */
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadPreviewUser()
      void refreshHeroBadges()
    }, [loadPreviewUser, refreshHeroBadges])
  )

  useEffect(() => {
    let isMounted = true
    async function resolveSessionToken() {
      const tokenFromRoute = String(route?.params?.sessionToken || '')
      if (tokenFromRoute) {
        if (isMounted) setSessionToken(tokenFromRoute)
        return
      }
      try {
        const rawAuth = await AsyncStorage.getItem('wonderport-auth')
        if (!rawAuth) return
        const parsed = JSON.parse(rawAuth)
        const tokenFromStorage = String(parsed?.sessionToken || '')
        if (isMounted && tokenFromStorage) {
          setSessionToken(tokenFromStorage)
        }
      } catch (error) {
        console.log('Failed to resolve session token for rewards', error)
      }
    }
    resolveSessionToken()
    return () => {
      isMounted = false
    }
  }, [route?.params?.sessionToken])

  useEffect(() => {
    let isMounted = true
    async function loadRewards() {
      if (!sessionToken) {
        if (isMounted) {
          setRewardsError('Please sign in again to load rewards.')
          setLoadingRewards(false)
        }
        return
      }
      let showedCached = false
      try {
        const cached = await readDailyRewardsCache()
        if (cached && isMounted) {
          setRewardStatus(cached)
          setLoadingRewards(false)
          showedCached = true
        }
      } catch {
        /* ignore */
      }
      if (!showedCached && isMounted) {
        setLoadingRewards(true)
      }
      try {
        setRewardsError('')
        const data = await getDailyRewardStatus(sessionToken)
        if (isMounted) {
          setRewardStatus(data)
        }
      } catch (error: any) {
        if (isMounted) {
          const message = String(error?.message || '')
          if (message.toLowerCase().includes('unauthorized')) {
            setRewardsError('Session expired. Please log in again.')
          } else {
            setRewardsError(message || 'Could not load daily rewards.')
          }
        }
      } finally {
        if (isMounted) {
          setLoadingRewards(false)
        }
      }
    }
    loadRewards()
    return () => {
      isMounted = false
    }
  }, [sessionToken])

  async function handleClaim() {
    if (!sessionToken || claimingReward || !rewardStatus?.canClaim) return
    try {
      setClaimingReward(true)
      setRewardsError('')
      const data = await claimDailyReward(sessionToken)
      setRewardStatus(data)
    } catch (error: any) {
      setRewardsError(error?.message || 'Could not claim reward yet.')
    } finally {
      setClaimingReward(false)
    }
  }

  async function handleEquipAvatarFrame(id: AvatarFrameId) {
    await saveEquippedAvatarFrame(id)
    setEquippedAvatarFrame(id)
    setStoreMessage(id === 'none' ? 'Plain avatar on.' : 'Frame saved. See your profile.')
    if (sessionToken) {
      try {
        await syncEquippedAvatarFrame(sessionToken, id)
      } catch (error) {
        console.log('[dailyRewards] avatar frame server sync failed', error)
      }
    }
  }

  async function equipWonderBadge(badgeId: WonderBadgeId) {
    try {
      const prefs = await loadProfileHeroPreferences()
      const slots: ProfileHeroBadgeSlots = [...prefs.badgeSlots]
      if (slots.some((s) => s === badgeId)) {
        setStoreMessage('This badge is already on your profile showcase.')
        return
      }
      const emptyIdx = slots.findIndex((s) => isProfileBadgeSlotFreeForWonderEquip(s))
      if (emptyIdx === -1) {
        setStoreMessage(
          'All three showcase slots are full. Open Edit profile and remove a badge to equip another.',
        )
        return
      }
      slots[emptyIdx] = badgeId
      await saveProfileHeroPreferences({ ...prefs, badgeSlots: slots })
      setHeroBadgeSlots(slots)
      setStoreMessage('')
    } catch {
      setStoreMessage('Could not save badge. Try again.')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroTitleRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.navigate('HomeMain' as never)
            }
          }}
        >
          <FeatherIcon name="chevron-left" size={20} color={DAILY_ACCENT} />
        </Pressable>
        <Text style={styles.mainScreenHeading} numberOfLines={2}>
          Daily Rewards
        </Text>
      </View>

      <View style={styles.bannerCard}>
          <View style={styles.bannerTopRow}>
            <Text style={styles.bannerTitle}>Keep your streak alive</Text>
          </View>
          <Text style={styles.bannerSubtitle}>Claim once each day to earn more Wonder Wallet coins.</Text>

          <View style={styles.daysRow}>
            {rewards.map((reward) => {
              const isClaimed = reward.status === 'claimed'
              return (
                <View key={String(reward.day)} style={styles.dayItem}>
                  <Text style={styles.dayLabel}>{reward.day}</Text>
                  <View style={[styles.dayCircle, isClaimed ? styles.dayCircleClaimed : null]}>
                    {isClaimed ? (
                      Platform.OS === 'web' ? (
                        <SvgUri uri="/homepageimgs/dailyrewards/lighting.svg" width={30} height={30} />
                      ) : (
                        <FeatherIcon name="zap" size={30} color="#050505" />
                      )
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.streakRow}>
            <View style={styles.streakLeft}>
              {Platform.OS === 'web' ? (
                <SvgUri uri="/homepageimgs/dailyrewards/fireicon.svg" width={30} height={30} />
              ) : (
                <FeatherIcon name="zap" size={28} color={DAILY_ACCENT} />
              )}
              <Text style={styles.streakText}>{currentStreak} days</Text>
            </View>
          </View>
      </View>

      <View style={styles.carouselNavRow}>
        <Pressable
          style={styles.carouselNavButton}
          onPress={() => scrollRewardCarousel(-1)}
          disabled={!carouselCanGoBack}
          accessibilityRole="button"
          accessibilityLabel="Previous rewards"
        >
          <FeatherIcon
            name="chevron-left"
            size={24}
            color={carouselCanGoBack ? '#ffffff' : 'rgba(255,255,255,0.28)'}
          />
        </Pressable>
        <Pressable
          style={styles.carouselNavButton}
          onPress={() => scrollRewardCarousel(1)}
          disabled={!carouselCanGoForward}
          accessibilityRole="button"
          accessibilityLabel="Next rewards"
        >
          <FeatherIcon
            name="chevron-right"
            size={24}
            color={carouselCanGoForward ? '#ffffff' : 'rgba(255,255,255,0.28)'}
          />
        </Pressable>
      </View>

      <ScrollView
        ref={rewardCarouselRef}
        horizontal
        style={styles.rewardCarouselWrap}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.rewardCarousel, { gap: REWARD_CAROUSEL_GAP }]}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x
          setCarouselScrollX(e.nativeEvent.contentOffset.x)
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x
          setCarouselScrollX(e.nativeEvent.contentOffset.x)
        }}
      >
          {rewards.map((reward, index) => {
            const isClaimed = reward.status === 'claimed'
            const isUnlocked = reward.status === 'unlocked'
            const isDay7 = reward.day === 7
            const day7BadgeSize = Math.min(112, Math.floor(rewardCardWidth * 0.72))
            return (
              <View key={`${reward.day}-${index}`} style={[styles.rewardCard, { width: rewardCardWidth }]}>
                <Text style={styles.rewardCardDay}>Day {reward.day}</Text>
                <View style={styles.rewardCardCoinWrap}>
                  {isDay7 ? (
                    <WonderBadgeImage
                      badgeId="badge:day7"
                      size={day7BadgeSize}
                      fallbackColor={DAILY_ACCENT}
                    />
                  ) : (
                    <RewardCarouselSpinningCoin color={DAILY_ACCENT} />
                  )}
                </View>
                <View style={styles.rewardCardFooter}>
                  <Text style={[styles.rewardCardCoins, isDay7 ? styles.rewardCardCoinsDay7 : null]}>
                    {isDay7 ? '7-day streak badge' : `+${reward.amount} coins`}
                  </Text>
                  {isUnlocked ? (
                    <Pressable
                      style={[styles.rewardClaimButton, claimingReward ? styles.rewardClaimButtonDisabled : null]}
                      onPress={handleClaim}
                    >
                      <Text style={styles.rewardClaimButtonText}>
                        {claimingReward ? 'Claiming...' : 'Claim'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.rewardStatusPill, isClaimed ? styles.rewardStatusClaimed : null]}>
                      <Text style={[styles.rewardStatusText, isClaimed ? styles.rewardStatusTextClaimed : null]}>
                        {isClaimed ? 'Claimed' : 'Locked'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
      </ScrollView>
      <View style={styles.wonderJumpChestHintCard}>
        <Text style={styles.wonderJumpChestHintText}>
          Mystery chests with Wonder Wallet coins appear while you climb in WonderJump (Sunset Keys tropics). Open them
          from the WonderJump menu after you find one.
        </Text>
      </View>
      {loadingRewards ? <Text style={styles.infoText}>Loading rewards...</Text> : null}
      {rewardsError ? <Text style={styles.errorText}>{rewardsError}</Text> : null}

      <View style={styles.storeSection}>
        <View style={styles.wonderStoreTitleRow}>
          <Text style={[styles.mainScreenHeading, styles.wonderStoreHeading]} numberOfLines={2}>
            Wonder Store
          </Text>
          <View style={styles.storeBalanceBadge}>
            <RewardStaticCoin size={22} />
            <Text style={styles.storeBalanceBadgeValue}>{availableCoins}</Text>
          </View>
        </View>

        <Text style={styles.badgesHeading}>Badges</Text>
        <View style={styles.badgesGrid}>
          {WONDER_BADGE_IDS.map((id) => {
            const equipped = heroBadgeSlots.some((s) => s === id)
            return (
              <View
                key={id}
                style={[
                  styles.badgeStoreCard,
                  { width: badgeStoreCardWidth },
                  equipped ? styles.badgeStoreCardEquipped : null,
                ]}
              >
                <View style={[styles.badgePreviewPlate, equipped ? styles.badgePreviewPlateEquipped : null]}>
                  <WonderBadgeImage badgeId={id} size={64} fallbackColor={DAILY_ACCENT} />
                </View>
                <Pressable
                  style={[styles.badgeEquipButton, equipped ? styles.badgeEquipButtonEquipped : null]}
                  disabled={equipped}
                  onPress={() => void equipWonderBadge(id)}
                >
                  <Text
                    style={[styles.badgeEquipButtonText, equipped ? styles.badgeEquipButtonTextEquipped : null]}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </Text>
                </Pressable>
              </View>
            )
          })}
        </View>
        {storeMessage ? <Text style={styles.infoText}>{storeMessage}</Text> : null}
      </View>

      <View style={styles.framesSection}>
        <Text style={styles.sectionHeading}>Avatar Frames</Text>
        <View style={styles.framesGrid}>
          {AVATAR_FRAME_SHOP.map((frame) => (
            <AvatarFramePreviewTile
              key={frame.id}
              frameId={frame.id}
              size={AVATAR_FRAME_SIZE_PREVIEW_TILE}
              equipped={equippedAvatarFrame === frame.id}
              onEquip={() => handleEquipAvatarFrame(frame.id)}
              previewUri={framePreviewUser.uri}
              previewInitial={framePreviewUser.initial}
            />
          ))}
        </View>
        <Pressable
          style={styles.plainFrameRow}
          onPress={() => handleEquipAvatarFrame('none')}
        >
          <Text
            style={[
              styles.plainFrameText,
              equippedAvatarFrame === 'none' ? styles.plainFrameTextActive : null,
            ]}
          >
            {equippedAvatarFrame === 'none'
              ? 'Plain avatar (active)'
              : 'Use plain avatar'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DAILY_FILL,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  /** Same footprint as `backButton` so “Wonder Store” lines up with “Daily Rewards” text. */
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DAILY_FILL,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainScreenHeading: {
    flex: 1,
    minWidth: 0,
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  wonderStoreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  wonderStoreHeading: {
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  /** In-page section titles (matches Wonder Store / home chip weight) */
  sectionHeading: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  bannerCard: {
    backgroundColor: DAILY_FILL,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.3)',
    padding: 14,
    marginBottom: 14,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bannerTitle: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 18,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayItem: {
    alignItems: 'center',
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
    marginBottom: 6,
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(203,255,0,0.35)',
    backgroundColor: DAILY_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleClaimed: {
    borderColor: DAILY_ACCENT,
    backgroundColor: DAILY_ACCENT,
  },
  streakRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    color: DAILY_ACCENT,
    fontFamily: 'Geist-SemiBold',
    fontSize: 32,
  },
  rewardCarousel: {
    paddingRight: REWARD_CAROUSEL_PAD_RIGHT,
  },
  rewardCarouselWrap: {
    marginBottom: 14,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  carouselNavButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCard: {
    minHeight: 320,
    backgroundColor: DAILY_FILL,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.3)',
    padding: 14,
  },
  rewardCardDay: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 16,
  },
  rewardCardCoinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCardFooter: {
    paddingTop: 10,
  },
  rewardCardCoins: {
    color: DAILY_ACCENT,
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 10,
    textAlign: 'center',
  },
  rewardCardCoinsDay7: {
    fontSize: 16,
    lineHeight: 22,
  },
  rewardClaimButton: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DAILY_ACCENT,
  },
  rewardClaimButtonDisabled: {
    backgroundColor: '#9fb4d8',
  },
  rewardClaimButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
  },
  rewardStatusPill: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardStatusClaimed: {
    borderColor: DAILY_ACCENT,
    backgroundColor: 'rgba(203,255,0,0.14)',
  },
  rewardStatusText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  rewardStatusTextClaimed: {
    color: DAILY_ACCENT,
  },
  wonderJumpChestHintCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    marginBottom: 8,
  },
  wonderJumpChestHintText: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  infoText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  errorText: {
    marginTop: 10,
    color: '#dc2626',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  storeSection: {
    marginTop: 18,
  },
  badgesHeading: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 20,
    marginBottom: 10,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  badgeStoreCard: {
    backgroundColor: DAILY_FILL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.28)',
    padding: 10,
    alignItems: 'stretch',
  },
  badgeStoreCardEquipped: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderColor: 'rgba(203,255,0,0.45)',
  },
  badgePreviewPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 8,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(203,255,0,0.22)',
  },
  badgePreviewPlateEquipped: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderColor: 'rgba(203,255,0,0.38)',
  },
  badgeEquipButton: {
    marginTop: 8,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: DAILY_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEquipButtonEquipped: {
    backgroundColor: 'rgba(203,255,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.45)',
  },
  badgeEquipButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  badgeEquipButtonTextEquipped: {
    color: DAILY_ACCENT,
  },
  framesSection: {
    marginTop: 22,
  },
  framesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  plainFrameRow: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  plainFrameText: {
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Geist-Medium',
    fontSize: 13,
  },
  plainFrameTextActive: {
    color: DAILY_ACCENT,
    fontFamily: 'Geist-SemiBold',
  },
  storeBalanceBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: DAILY_FILL,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  storeBalanceBadgeValue: {
    color: DAILY_ACCENT,
    fontFamily: 'Geist-SemiBold',
    fontSize: 16,
  },
})
