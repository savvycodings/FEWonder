import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SvgUri } from 'react-native-svg'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DailyRewardItem, DailyRewardStatus, User } from '../../types'
import { DOMAIN } from '../../constants'
import { claimDailyReward, getDailyRewardStatus, readDailyRewardsCache, syncEquippedAvatarFrame } from '../utils'
import {
  AVATAR_FRAME_SHOP,
  AVATAR_FRAME_SIZE_PREVIEW_TILE,
  AvatarFramePreviewTile,
  loadEquippedAvatarFrame,
  saveEquippedAvatarFrame,
} from '../components/AvatarFrame'
import type { AvatarFrameId } from '../components/AvatarFrame'
import { ThemeContext } from '../context'

const weekDays = ['1', '2', '3', '4', '5', '6', '7']
const weekRewards = [1, 2, 3, 4, 5, 6, 7]
const DAILY_ACCENT = '#CBFF00'
const DAILY_FILL = '#000000'
const storeThemes = [
  { id: 'midnight', name: 'Midnight', cost: 6, image: require('../../public/homepageimgs/dailyrewards/theme1.png') },
  { id: 'sunset', name: 'Sunset', cost: 7, image: require('../../public/homepageimgs/dailyrewards/theme2.png') },
  { id: 'mint', name: 'Mint', cost: 5, image: require('../../public/homepageimgs/dailyrewards/theme3.png') },
  { id: 'royal', name: 'Royal', cost: 8, image: require('../../public/homepageimgs/dailyrewards/theme4.png') },
  { id: 'peach', name: 'Peach', cost: 4, image: require('../../public/homepageimgs/dailyrewards/theme5.png') },
  { id: 'forest', name: 'Forest', cost: 6, image: require('../../public/homepageimgs/dailyrewards/theme6.png') },
]
/** Static coin in Wonder Store only (smooth UI; full face). */
const WONDER_STORE_COIN_SVG = '/homepageimgs/Coinrotation/CoinFRONT.svg'

const coinRotationFrameUris = [
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
/** Keep SVG support ready for later; disabled for now per request. */
const USE_COIN_SVG = false

function resolvePublicAssetUri(path: string): string {
  if (Platform.OS === 'web' || !DOMAIN) return path
  return `${DOMAIN}${path}`
}

/** Isolated so Wonder Store doesn’t re-render on every spin frame. */
function RewardCarouselSpinningCoin({ color }: { color: string }): ReactElement {
  if (USE_COIN_SVG) {
    return <SvgUri uri={resolvePublicAssetUri(coinRotationFrameUris[0])} width={72} height={72} />
  }
  return <FeatherIcon name="dollar-sign" size={50} color={color} />
}

function RewardStaticCoin({ size = 20 }: { size?: number }): ReactElement {
  if (USE_COIN_SVG) {
    return <SvgUri uri={resolvePublicAssetUri(WONDER_STORE_COIN_SVG)} width={size} height={size} />
  }
  return <FeatherIcon name="dollar-sign" size={size} color={DAILY_ACCENT} />
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
  const [spentCoins, setSpentCoins] = useState(0)
  const [ownedThemeIds, setOwnedThemeIds] = useState<string[]>([])
  const [storeMessage, setStoreMessage] = useState('')
  const [equippedAvatarFrame, setEquippedAvatarFrame] = useState<AvatarFrameId>('none')
  const [framePreviewUser, setFramePreviewUser] = useState<{
    uri: string | null
    initial: string
  }>({ uri: null, initial: '?' })

  const fallbackRewards = useMemo<DailyRewardItem[]>(
    () => weekDays.map((day, index) => ({ day: Number(day), amount: weekRewards[index], status: 'locked' })),
    []
  )
  const rewards = rewardStatus?.rewards?.length ? rewardStatus.rewards : fallbackRewards
  const claimedCount = rewardStatus?.claimedCount || 0
  const currentStreak = rewardStatus?.currentStreakDays || claimedCount
  const walletBalance = rewardStatus?.walletBalance || 0
  const availableCoins = Math.max(0, walletBalance - spentCoins)
  const rewardCardWidth = useMemo(() => Math.floor((screenWidth - 32 - 20 - 10) / 2), [screenWidth])

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

  useFocusEffect(
    useCallback(() => {
      loadPreviewUser()
    }, [loadPreviewUser])
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

  function handleBuyTheme(themeId: string, cost: number) {
    if (ownedThemeIds.includes(themeId)) return
    if (availableCoins < cost) {
      setStoreMessage('Not enough coins for this theme yet.')
      return
    }
    setSpentCoins((prev) => prev + cost)
    setOwnedThemeIds((prev) => [...prev, themeId])
    setStoreMessage('Theme purchased.')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
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
        <Text style={styles.headerTitle}>Daily Rewards</Text>
        <View style={styles.headerSpacer} />
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

      <ScrollView
        horizontal
        style={styles.rewardCarouselWrap}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rewardCarousel}
      >
          {rewards.map((reward, index) => {
            const isClaimed = reward.status === 'claimed'
            const isUnlocked = reward.status === 'unlocked'
            return (
              <View key={`${reward.day}-${index}`} style={[styles.rewardCard, { width: rewardCardWidth }]}>
                <Text style={styles.rewardCardDay}>Day {reward.day}</Text>
                <View style={styles.rewardCardCoinWrap}>
                  <RewardCarouselSpinningCoin color={DAILY_ACCENT} />
                </View>
                <View style={styles.rewardCardFooter}>
                  <Text style={styles.rewardCardCoins}>+{reward.amount} coins</Text>
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
      {loadingRewards ? <Text style={styles.infoText}>Loading rewards...</Text> : null}
      {rewardsError ? <Text style={styles.errorText}>{rewardsError}</Text> : null}

      <View style={styles.storeSection}>
        <Text style={styles.storeMainTitle}>Wonder Store</Text>
        <View style={styles.storeBalanceBadge}>
          <RewardStaticCoin size={22} />
          <Text style={styles.storeBalanceBadgeValue}>{availableCoins}</Text>
        </View>

        <View style={styles.storeGrid}>
          {storeThemes.map((storeTheme) => {
            const isOwned = ownedThemeIds.includes(storeTheme.id)
            const canBuy = availableCoins >= storeTheme.cost
            return (
              <View key={storeTheme.id} style={styles.storeCard}>
                <Image source={storeTheme.image} style={styles.storeThemeSwatch} resizeMode="cover" />
                <Text style={styles.storeThemeName}>{storeTheme.name}</Text>
                <View style={styles.storeThemeCostBadge}>
                  <RewardStaticCoin size={14} />
                  <Text style={styles.storeThemeCostValue}>{storeTheme.cost}</Text>
                </View>
                <Pressable
                  style={[
                    styles.storeBuyButton,
                    isOwned ? styles.storeBuyButtonOwned : null,
                    !isOwned && !canBuy ? styles.storeBuyButtonDisabled : null,
                  ]}
                  onPress={() => handleBuyTheme(storeTheme.id, storeTheme.cost)}
                >
                  <Text style={styles.storeBuyButtonText}>{isOwned ? 'Owned' : 'Buy'}</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
        {storeMessage ? <Text style={styles.infoText}>{storeMessage}</Text> : null}
      </View>

      <View style={styles.framesSection}>
        <Text style={styles.framesHeading}>Avatar frames</Text>
        <Text style={styles.framesSub}>
          preview uses your profile photo. FREE FOR TESTING PURPOSES
        </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
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
  headerTitle: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 24,
  },
  headerSpacer: {
    width: 36,
    height: 36,
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
    gap: 10,
    paddingRight: 16,
  },
  rewardCarouselWrap: {
    marginBottom: 14,
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
  storeMainTitle: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  framesSection: {
    marginTop: 22,
  },
  framesHeading: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 20,
    marginBottom: 6,
  },
  framesSub: {
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
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
    marginTop: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
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
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  storeCard: {
    width: '31.5%',
    backgroundColor: DAILY_FILL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.28)',
    padding: 10,
    alignItems: 'center',
  },
  storeThemeSwatch: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    marginBottom: 8,
  },
  storeThemeName: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  storeThemeCostBadge: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: DAILY_ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  storeThemeCostValue: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
  },
  storeBuyButton: {
    width: '100%',
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: DAILY_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeBuyButtonDisabled: {
    backgroundColor: DAILY_ACCENT,
    opacity: 0.65,
  },
  storeBuyButtonOwned: {
    backgroundColor: DAILY_ACCENT,
  },
  storeBuyButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
  },
})
