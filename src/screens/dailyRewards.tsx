import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SvgUri } from 'react-native-svg'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DailyRewardItem, DailyRewardStatus, User } from '../../types'
import {
  claimDailyReward,
  getDailyRewardStatus,
  getProfileHero,
  updateProfileHero,
  purchaseWonderStoreItem,
  readDailyRewardsCache,
  syncEquippedAvatarFrame,
} from '../utils'
import {
  avatarFrameStoreItemId,
  getAvatarFrameStorePrice,
  WONDERJUMP_GHOST_STORE_COST,
  WONDERJUMP_GHOST_STORE_ITEM_ID,
} from '../wonderStoreCatalog'
import {
  AVATAR_FRAME_SHOP,
  AVATAR_FRAME_SIZE_PREVIEW_TILE,
  AvatarFramePreviewTile,
  loadEquippedAvatarFrame,
  saveEquippedAvatarFrame,
} from '../components/AvatarFrame'
import type { AvatarFrameId } from '../components/AvatarFrame'
import { ThemeContext } from '../context'
import { brandAccentRgba, normalizeBrandAccentId } from '../brandAccent'
import { WonderBadgeImage, WonderSpinningCoin, WonderStaticCoin } from '../components'
import {
  isProfileBadgeSlotFreeForWonderEquip,
  loadProfileHeroPreferences,
  saveProfileHeroPreferences,
  type ProfileHeroBadgeSlots,
} from '../profileHeroPreferences'
import {
  WONDER_BADGE_CATALOG,
  WONDER_BADGE_IDS,
  migrateWonderBadgeSlotId,
  type WonderBadgeId,
} from '../wonderBadgesCatalog'
import {
  WONDER_JUMP_CHARACTER_OPTIONS,
  loadWonderJumpCharacterStyle,
  saveWonderJumpCharacterStyle,
  type WonderJumpCharacterStyle,
} from '../wonderJumpCharacters'
import { WonderJumpCharacterSvg } from '../components/WonderJumpCharacterSvg'

type WonderBadgeCardMeta = {
  earned: boolean
  label: string
  caption: string
  /** `null` = no numeric progress row (e.g. heart). */
  progressLabel: string | null
  fillRatio: number
}

function wonderBadgeCardMeta(
  id: WonderBadgeId,
  claimedCount: number,
  loginStreak: number,
  paidOrders: number,
  wonderJumpRank: number | null,
): WonderBadgeCardMeta {
  const entry = WONDER_BADGE_CATALOG[id]
  switch (id) {
    case 'badge:day7': {
      const target = 7
      const p = Math.min(Math.max(0, claimedCount), target)
      return {
        earned: claimedCount >= 7,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:day30': {
      const target = 30
      const s = Math.max(0, loginStreak)
      const p = Math.min(s, target)
      return {
        earned: s >= target,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:day90': {
      const target = 90
      const s = Math.max(0, loginStreak)
      const p = Math.min(s, target)
      return {
        earned: s >= target,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:order1': {
      const target = 1
      const o = Math.max(0, paidOrders)
      const p = Math.min(o, target)
      return {
        earned: o >= 1,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:order5': {
      const target = 5
      const o = Math.max(0, paidOrders)
      const p = Math.min(o, target)
      return {
        earned: o >= 5,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:order10': {
      const target = 10
      const o = Math.max(0, paidOrders)
      const p = Math.min(o, target)
      return {
        earned: o >= 10,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: `${p} / ${target}`,
        fillRatio: target > 0 ? p / target : 0,
      }
    }
    case 'badge:heart':
      return {
        earned: true,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: null,
        fillRatio: 1,
      }
    case 'badge:wj_top100':
    case 'badge:wj_top50':
    case 'badge:wj_top10':
    case 'badge:wj_top3':
    case 'badge:wj_top2':
    case 'badge:wj_top1': {
      const targetById: Record<string, number> = {
        'badge:wj_top100': 100,
        'badge:wj_top50': 50,
        'badge:wj_top10': 10,
        'badge:wj_top3': 3,
        'badge:wj_top2': 2,
        'badge:wj_top1': 1,
      }
      const target = targetById[id]
      const rank = typeof wonderJumpRank === 'number' && wonderJumpRank > 0 ? Math.floor(wonderJumpRank) : null
      return {
        earned: rank !== null && rank <= target,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: rank === null ? 'Unranked' : `Rank #${rank}`,
        fillRatio: rank !== null && rank <= target ? 1 : 0,
      }
    }
    default:
      return {
        earned: false,
        label: entry.label,
        caption: entry.acquire,
        progressLabel: null,
        fillRatio: 0,
      }
  }
}

const weekDays = ['1', '2', '3', '4', '5', '6', '7']
const weekRewards = [1, 2, 3, 4, 5, 6, 7]
const DAILY_FILL = '#000000'
const THEME_STORE_OWNED_KEY = 'wonderport-theme-store-owned-ids'
const THEME_STORE_ITEMS = [
  { id: 'midnight', name: 'Midnight', cost: 5, image: require('../../assets/dailyrewards/midnight.png') },
  { id: 'sunset', name: 'Sunset', cost: 5, image: require('../../assets/dailyrewards/sunset.png') },
  { id: 'mint', name: 'Mint', cost: 5, image: require('../../assets/dailyrewards/mint.png') },
  { id: 'royal', name: 'Royal', cost: 5, image: require('../../assets/dailyrewards/royal.png') },
  { id: 'peach', name: 'Peach', cost: 5, image: require('../../assets/dailyrewards/peach.png') },
  { id: 'forest', name: 'Forest', cost: 5, image: require('../../assets/dailyrewards/forest.png') },
] as const

function normalizeThemeStoreId(id: string): string {
  return String(id || '').trim().toLowerCase()
}

function isThemeStoreIdOwned(ownedIds: string[], themeId: string): boolean {
  const t = normalizeThemeStoreId(themeId)
  return ownedIds.some((x) => normalizeThemeStoreId(x) === t)
}

/** Horizontal gap between reward cards (must match `rewardCarousel` `gap`). */
const REWARD_CAROUSEL_GAP = 10
/** Matches `rewardCarousel` `paddingRight`. */
const REWARD_CAROUSEL_PAD_RIGHT = 16
/** Matches outer `content` `paddingHorizontal` × 2 — carousel viewport width. */
const REWARD_CONTENT_H_PAD = 32
const WONDER_JUMP_CHARACTER_PREVIEW_PX = 56
const TEMP_WHITE_PREVIEW_OWNER_KEY = 'wonderport-debug-white-preview-owner-user-id'
/** Isolated so Wonder Store doesn’t re-render on every spin frame. */
function RewardCarouselSpinningCoin({ color }: { color: string }): ReactElement {
  return <WonderSpinningCoin size={72} fallbackColor={color} />
}

function RewardStaticCoin({ size = 20, color }: { size?: number; color: string }): ReactElement {
  return <WonderStaticCoin size={size} fallbackColor={color} />
}

function WonderJumpCharacterPreview({ styleId }: { styleId: WonderJumpCharacterStyle }): ReactElement {
  return (
    <WonderJumpCharacterSvg variant={styleId} width={WONDER_JUMP_CHARACTER_PREVIEW_PX} height={WONDER_JUMP_CHARACTER_PREVIEW_PX} />
  )
}

export function DailyRewards({ navigation, route }: any) {
  const { theme, brandAccentId, setBrandAccentId } = useContext(ThemeContext)
  const styles = useMemo(() => buildDailyRewardStyles(theme), [theme])
  const { width: screenWidth } = useWindowDimensions()
  const [sessionToken, setSessionToken] = useState(String(route?.params?.sessionToken || ''))
  const [rewardStatus, setRewardStatus] = useState<DailyRewardStatus | null>(null)
  const [loadingRewards, setLoadingRewards] = useState(true)
  const [claimingReward, setClaimingReward] = useState(false)
  const [rewardsError, setRewardsError] = useState('')
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [ownedThemeIds, setOwnedThemeIds] = useState<string[]>([])
  const [storeMessage, setStoreMessage] = useState('')
  const [equippedAvatarFrame, setEquippedAvatarFrame] = useState<AvatarFrameId>('none')
  const [framePreviewUser, setFramePreviewUser] = useState<{
    uri: string | null
    initial: string
  }>({ uri: null, initial: '?' })
  const [useWhiteFramePreviewFallback, setUseWhiteFramePreviewFallback] = useState(false)
  const [heroBadgeSlots, setHeroBadgeSlots] = useState<ProfileHeroBadgeSlots>([null, null, null])
  const [equippedWonderJumpCharacter, setEquippedWonderJumpCharacter] =
    useState<WonderJumpCharacterStyle>('classic')
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null)

  const isStoreItemOwned = useCallback(
    (itemId: string, freshStatus?: DailyRewardStatus | null) => {
      const list = freshStatus?.ownedStoreItemIds ?? rewardStatus?.ownedStoreItemIds ?? []
      return list.some((s) => String(s).toLowerCase() === itemId.toLowerCase())
    },
    [rewardStatus?.ownedStoreItemIds],
  )

  const fallbackRewards = useMemo<DailyRewardItem[]>(
    () => weekDays.map((day, index) => ({ day: Number(day), amount: weekRewards[index], status: 'locked' })),
    []
  )
  const rewards = rewardStatus?.rewards?.length ? rewardStatus.rewards : fallbackRewards
  const claimedCount = rewardStatus?.claimedCount || 0
  const currentStreak =
    rewardStatus != null &&
    typeof rewardStatus.currentStreakDays === 'number' &&
    Number.isFinite(rewardStatus.currentStreakDays)
      ? Math.max(0, Math.floor(rewardStatus.currentStreakDays))
      : claimedCount
  const paidOrderCount = rewardStatus?.paidOrderCount ?? 0
  const wonderJumpRank =
    typeof rewardStatus?.wonderJumpRank === 'number' && Number.isFinite(rewardStatus.wonderJumpRank)
      ? Math.max(1, Math.floor(rewardStatus.wonderJumpRank))
      : null
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
  const visibleBadgeIds = useMemo(
    () => (showAllBadges ? WONDER_BADGE_IDS : WONDER_BADGE_IDS.slice(0, 4)),
    [showAllBadges],
  )
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

  useEffect(() => {
    let mounted = true
    void loadWonderJumpCharacterStyle().then((style) => {
      if (mounted) setEquippedWonderJumpCharacter(style)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const rawOwned = await AsyncStorage.getItem(THEME_STORE_OWNED_KEY)
        if (!mounted) return
        const parsedOwned = rawOwned ? JSON.parse(rawOwned) : []
        const nextOwned = Array.isArray(parsedOwned)
          ? parsedOwned.map((v) => normalizeThemeStoreId(String(v))).filter(Boolean)
          : []
        setOwnedThemeIds(nextOwned)
      } catch {
        /* ignore theme store cache errors */
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  /** Pull theme ownership from the server's wonder-store owned ids whenever rewardStatus changes. */
  useEffect(() => {
    const serverOwned = (rewardStatus?.ownedStoreItemIds ?? [])
      .map((s) => normalizeThemeStoreId(String(s)))
      .filter((s) => THEME_STORE_ITEMS.some((t) => t.id === s))
    if (!serverOwned.length) return
    setOwnedThemeIds((prev) => {
      const merged = [...prev, ...serverOwned].filter((v, i, a) => a.indexOf(v) === i)
      if (merged.length === prev.length && merged.every((v, i) => v === prev[i])) return prev
      void AsyncStorage.setItem(THEME_STORE_OWNED_KEY, JSON.stringify(merged)).catch(() => {})
      return merged
    })
  }, [rewardStatus?.ownedStoreItemIds])

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
      const currentUserId = String(u.id || '').trim()
      if (!currentUserId) {
        setUseWhiteFramePreviewFallback(false)
        return
      }
      const pinnedOwnerId = String((await AsyncStorage.getItem(TEMP_WHITE_PREVIEW_OWNER_KEY)) || '').trim()
      if (!pinnedOwnerId) {
        // Temporary local debug helper: pin this override to the first account that loads the store.
        await AsyncStorage.setItem(TEMP_WHITE_PREVIEW_OWNER_KEY, currentUserId)
        setUseWhiteFramePreviewFallback(true)
      } else {
        setUseWhiteFramePreviewFallback(pinnedOwnerId === currentUserId)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadPreviewUser()
  }, [loadPreviewUser])

  const refreshHeroBadges = useCallback(async () => {
    try {
      if (sessionToken) {
        const remote = await getProfileHero(sessionToken)
        const migrated: ProfileHeroBadgeSlots = [
          migrateWonderBadgeSlotId(remote.badgeSlots[0]),
          migrateWonderBadgeSlotId(remote.badgeSlots[1]),
          migrateWonderBadgeSlotId(remote.badgeSlots[2]),
        ]
        setHeroBadgeSlots(migrated)
      } else {
        const p = await loadProfileHeroPreferences()
        const migrated: ProfileHeroBadgeSlots = [
          migrateWonderBadgeSlotId(p.badgeSlots[0]),
          migrateWonderBadgeSlotId(p.badgeSlots[1]),
          migrateWonderBadgeSlotId(p.badgeSlots[2]),
        ]
        setHeroBadgeSlots(migrated)
      }
    } catch {
      /* ignore */
    }
  }, [sessionToken])

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

  async function purchaseStoreItem(
    itemId: string,
    afterSuccess?: (status: DailyRewardStatus) => Promise<void>,
  ) {
    if (!sessionToken) {
      setStoreMessage('Log in to purchase from the Wonder Store.')
      return
    }
    setPurchasingItemId(itemId)
    setStoreMessage('')
    try {
      const status = await purchaseWonderStoreItem(sessionToken, itemId)
      const mergedOwned = Array.isArray(status.ownedStoreItemIds)
        ? status.ownedStoreItemIds
        : []
      const hasOwned = mergedOwned.some((s) => String(s).toLowerCase() === itemId.toLowerCase())
      const nextStatus: DailyRewardStatus = hasOwned
        ? status
        : {
            ...status,
            ownedStoreItemIds: [...mergedOwned, itemId],
          }
      setRewardStatus(nextStatus)
      if (afterSuccess) await afterSuccess(nextStatus)
    } catch (e: any) {
      const msg = String(e?.message || 'Could not complete purchase.')
      if (msg.toLowerCase().includes('already purchased')) {
        try {
          const fresh = await getDailyRewardStatus(sessionToken)
          setRewardStatus(fresh)
          if (afterSuccess) await afterSuccess(fresh)
          setStoreMessage('Already owned. You can equip it now.')
        } catch {
          setStoreMessage('Already owned. Please reopen Wonder Store to refresh.')
        }
      } else {
        setStoreMessage(msg)
      }
    } finally {
      setPurchasingItemId(null)
    }
  }

  async function handleEquipAccentTheme(themeId: 'default' | string) {
    setStoreMessage('')
    const id = themeId === 'default' ? 'default' : normalizeThemeStoreId(themeId)
    if (id !== 'default' && !isThemeStoreIdOwned(ownedThemeIds, id)) {
      setStoreMessage('Purchase this theme in the Wonder Store first.')
      return
    }
    const label =
      id === 'default'
        ? 'Default lime'
        : THEME_STORE_ITEMS.find((t) => t.id === id)?.name ?? 'Theme'
    setBrandAccentId(id === 'default' ? 'default' : normalizeBrandAccentId(id))
    setStoreMessage(`${label} accent equipped.`)
  }

  async function handleBuyTheme(themeId: string, cost: number) {
    const id = normalizeThemeStoreId(themeId)
    if (isThemeStoreIdOwned(ownedThemeIds, id)) return
    if (availableCoins < cost) {
      setStoreMessage('Not enough coins for this theme yet.')
      return
    }
    if (!sessionToken) {
      setStoreMessage('Log in to purchase from the Wonder Store.')
      return
    }

    /** Optimistic update: flip the button to Equip + decrement wallet immediately. */
    const prevOwned = ownedThemeIds
    const prevStatus = rewardStatus
    const optimisticOwned = [...ownedThemeIds, id].filter((v, i, a) => a.indexOf(v) === i)
    setOwnedThemeIds(optimisticOwned)
    setRewardStatus((curr) =>
      curr
        ? { ...curr, walletBalance: Math.max(0, (curr.walletBalance || 0) - cost) }
        : curr,
    )
    setStoreMessage('Theme purchased. Tap Equip to use this accent across the app.')
    void AsyncStorage.setItem(THEME_STORE_OWNED_KEY, JSON.stringify(optimisticOwned)).catch(
      () => {},
    )

    try {
      const status = await purchaseWonderStoreItem(sessionToken, id)
      const serverOwned = (status?.ownedStoreItemIds ?? [])
        .map((s) => normalizeThemeStoreId(String(s)))
        .filter((s) => THEME_STORE_ITEMS.some((t) => t.id === s))
      const merged = [...optimisticOwned, ...serverOwned].filter(
        (v, i, a) => a.indexOf(v) === i,
      )
      setOwnedThemeIds(merged)
      setRewardStatus(status)
      void AsyncStorage.setItem(THEME_STORE_OWNED_KEY, JSON.stringify(merged)).catch(() => {})
    } catch (e: any) {
      const msg = String(e?.message || 'Could not complete purchase.')
      if (msg.toLowerCase().includes('already purchased')) {
        try {
          const fresh = await getDailyRewardStatus(sessionToken)
          setRewardStatus(fresh)
          setStoreMessage('Already owned. You can equip it now.')
        } catch {
          /* leave optimistic state */
        }
        return
      }
      /** Roll back the optimistic update on real failures. */
      setOwnedThemeIds(prevOwned)
      setRewardStatus(prevStatus)
      void AsyncStorage.setItem(THEME_STORE_OWNED_KEY, JSON.stringify(prevOwned)).catch(
        () => {},
      )
      setStoreMessage(msg)
    }
  }

  async function handleEquipAvatarFrame(id: AvatarFrameId, freshStatus?: DailyRewardStatus) {
    const prev = equippedAvatarFrame
    setStoreMessage('')
    if (id !== 'none') {
      const itemId = avatarFrameStoreItemId(id)
      if (getAvatarFrameStorePrice(id) != null && !isStoreItemOwned(itemId, freshStatus ?? null)) {
        setStoreMessage('Purchase this frame in the Wonder Store first.')
        return
      }
    }
    try {
      await saveEquippedAvatarFrame(id)
      setEquippedAvatarFrame(id)
      setStoreMessage(id === 'none' ? 'Plain avatar on.' : 'Frame saved. See your profile.')
      if (sessionToken) {
        try {
          await syncEquippedAvatarFrame(sessionToken, id)
        } catch (error: any) {
          await saveEquippedAvatarFrame(prev)
          setEquippedAvatarFrame(prev)
          setStoreMessage(String(error?.message || 'Could not sync avatar frame. Try again.'))
        }
      }
    } catch {
      setStoreMessage('Could not save frame locally.')
    }
  }

  async function handleEquipWonderJumpCharacter(
    style: WonderJumpCharacterStyle,
    freshStatus?: DailyRewardStatus,
  ) {
    if (style === 'ghost') {
      if (!isStoreItemOwned(WONDERJUMP_GHOST_STORE_ITEM_ID, freshStatus ?? null)) {
        setStoreMessage('Purchase the Ghost character first.')
        return
      }
    }
    await saveWonderJumpCharacterStyle(style)
    setEquippedWonderJumpCharacter(style)
    setStoreMessage(`${style[0].toUpperCase()}${style.slice(1)} character equipped for WonderJump.`)
  }

  async function equipWonderBadge(badgeId: WonderBadgeId) {
    try {
      const prefs = await loadProfileHeroPreferences()
      const slots: ProfileHeroBadgeSlots = [...prefs.badgeSlots]
      if (slots.some((s) => (migrateWonderBadgeSlotId(s) ?? s) === badgeId)) {
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
      if (sessionToken) {
        await updateProfileHero(sessionToken, { badgeSlots: slots })
      }
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
          <FeatherIcon name="chevron-left" size={20} color={theme.brandAccent} />
        </Pressable>
        <Text style={styles.mainScreenHeading} numberOfLines={2}>
          Daily Rewards
        </Text>
      </View>

      <View style={styles.bannerCard}>
          <View style={styles.bannerTopRow}>
            <Text style={styles.bannerTitle}>Keep your streak alive</Text>
          </View>
          <Text style={styles.bannerSubtitle}>
            After day 7, open this screen once a day to grow your streak.
          </Text>

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
                <FeatherIcon name="zap" size={28} color={theme.brandAccent} />
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
                      fallbackColor={theme.brandAccent}
                    />
                  ) : (
                    <RewardCarouselSpinningCoin color={theme.brandAccent} />
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
      {loadingRewards ? <Text style={styles.infoText}>Loading rewards...</Text> : null}
      {rewardsError ? <Text style={styles.errorText}>{rewardsError}</Text> : null}

      <View style={styles.storeSection}>
        <View style={styles.wonderStoreTitleRow}>
          <Text style={[styles.mainScreenHeading, styles.wonderStoreHeading]} numberOfLines={2}>
            Wonder Store
          </Text>
          <View style={styles.storeBalanceBadge}>
            <RewardStaticCoin size={22} color={theme.brandAccent} />
            <Text style={styles.storeBalanceBadgeValue}>{availableCoins}</Text>
          </View>
        </View>

        <Text style={styles.badgesHeading}>Badges</Text>
        <View style={styles.badgesGrid}>
          {visibleBadgeIds.map((id) => {
            const slotMatches = (s: string | null) => (migrateWonderBadgeSlotId(s) ?? s) === id
            const equipped = heroBadgeSlots.some((s) => slotMatches(s))
            const meta = wonderBadgeCardMeta(id, claimedCount, currentStreak, paidOrderCount, wonderJumpRank)
            return (
              <View
                key={id}
                style={[
                  styles.badgeStoreCard,
                  { width: badgeStoreCardWidth },
                  equipped ? styles.badgeStoreCardEquipped : null,
                ]}
              >
                <View style={styles.badgeCardBody}>
                  <View style={[styles.badgePreviewPlate, equipped ? styles.badgePreviewPlateEquipped : null]}>
                    <WonderBadgeImage badgeId={id} size={64} fallbackColor={theme.brandAccent} />
                  </View>
                  <View style={styles.badgeTitleSlot}>
                    <Text style={styles.badgeCardTitle} numberOfLines={2}>
                      {meta.label}
                    </Text>
                  </View>
                  <View style={styles.badgeCaptionSlot}>
                    <Text style={styles.badgeCardCaption} numberOfLines={3}>
                      {meta.caption}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeCardFooter}>
                  <View style={styles.badgeProgressSlot}>
                    {meta.progressLabel ? (
                      <View style={styles.badgeProgressBlock}>
                        <View style={styles.badgeProgressLabels}>
                          <Text style={styles.badgeProgressText}>{meta.progressLabel}</Text>
                        </View>
                        <View style={styles.badgeProgressTrack}>
                          <View
                            style={[
                              styles.badgeProgressFill,
                              { width: `${Math.min(100, Math.max(0, meta.fillRatio * 100))}%` },
                            ]}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.badgeProgressSlotSpacer} />
                    )}
                  </View>
                  <Pressable
                    style={[
                      styles.badgeEquipButton,
                      equipped ? styles.badgeEquipButtonEquipped : null,
                      !meta.earned || equipped ? styles.badgeEquipButtonDisabled : null,
                    ]}
                    disabled={!meta.earned || equipped}
                    onPress={() => void equipWonderBadge(id)}
                  >
                    <Text
                      style={[
                        styles.badgeEquipButtonText,
                        equipped ? styles.badgeEquipButtonTextEquipped : null,
                        !meta.earned || equipped ? styles.badgeEquipButtonTextDisabled : null,
                      ]}
                    >
                      {equipped ? 'Equipped' : !meta.earned ? 'Locked' : 'Equip'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
        {WONDER_BADGE_IDS.length > 4 ? (
          <Pressable
            style={styles.badgesSeeAllButton}
            onPress={() => setShowAllBadges((prev) => !prev)}
          >
            <Text style={styles.badgesSeeAllButtonText}>{showAllBadges ? 'Show less' : 'See all'}</Text>
          </Pressable>
        ) : null}
        <View style={styles.themeSection}>
          <Text style={styles.sectionHeading}>Themes</Text>
          <View style={styles.themeGrid}>
            {THEME_STORE_ITEMS.map((themeItem) => {
              const isOwned = isThemeStoreIdOwned(ownedThemeIds, themeItem.id)
              const canBuy = availableCoins >= themeItem.cost
              const accentEquipped =
                normalizeBrandAccentId(brandAccentId) === normalizeThemeStoreId(themeItem.id)
              return (
                <View key={themeItem.id} style={styles.themeCard}>
                  <View style={styles.themeSwatch}>
                    <Image source={themeItem.image} style={styles.themeSwatchImage} resizeMode="cover" />
                  </View>
                  <Text style={styles.themeName}>{themeItem.name}</Text>
                  <View style={styles.themeCostRow}>
                    <RewardStaticCoin size={14} color={theme.brandAccent} />
                    <Text style={styles.themeCostValue}>{themeItem.cost}</Text>
                  </View>
                  <Pressable
                    style={[
                      styles.themeBuyButton,
                      isOwned
                        ? accentEquipped
                          ? styles.themeBuyButtonEquipped
                          : styles.themeBuyButtonOwned
                        : null,
                    ]}
                    disabled={isOwned ? accentEquipped : !canBuy}
                    onPress={() => {
                      if (isOwned) void handleEquipAccentTheme(themeItem.id)
                      else void handleBuyTheme(themeItem.id, themeItem.cost)
                    }}
                  >
                    <Text
                      style={[
                        styles.themeBuyButtonText,
                        isOwned ? (accentEquipped ? styles.themeBuyButtonTextEquipped : styles.themeBuyButtonTextOwned) : null,
                      ]}
                    >
                      {isOwned ? (accentEquipped ? 'Equipped' : 'Equip') : 'Buy'}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
          <Pressable style={styles.themeDefaultRow} onPress={() => void handleEquipAccentTheme('default')}>
            <Text style={styles.themeDefaultText}>Set to default</Text>
          </Pressable>
        </View>
        <View style={styles.charactersSection}>
          <Text style={styles.sectionHeading}>Wonderjump Characters</Text>
          <View style={styles.charactersGrid}>
            {WONDER_JUMP_CHARACTER_OPTIONS.map((option) => {
              const equipped = equippedWonderJumpCharacter === option.id
              const isGhost = option.id === 'ghost'
              const ghostOwned = isStoreItemOwned(WONDERJUMP_GHOST_STORE_ITEM_ID)
              const ghostBusy = purchasingItemId === WONDERJUMP_GHOST_STORE_ITEM_ID
              const ghostCanAfford = availableCoins >= WONDERJUMP_GHOST_STORE_COST
              return (
                <View key={option.id} style={styles.characterCard}>
                  <View style={styles.characterPreviewPlate}>
                    <WonderJumpCharacterPreview styleId={option.id} />
                  </View>
                  <Text style={styles.characterName}>{option.label}</Text>
                  <View
                    style={styles.characterMetaRow}
                  >
                    {isGhost ? (
                      <View style={styles.characterPriceRow}>
                        <RewardStaticCoin size={16} color={theme.brandAccent} />
                        <Text style={styles.characterPrice}>{WONDERJUMP_GHOST_STORE_COST}</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={[
                        styles.characterEquipButton,
                        equipped ? styles.characterEquipButtonEquipped : null,
                        !equipped && isGhost && !ghostOwned && (ghostBusy || !ghostCanAfford)
                          ? styles.characterEquipButtonDisabled
                          : null,
                      ]}
                      disabled={
                        equipped || (isGhost && !ghostOwned && (ghostBusy || !ghostCanAfford))
                      }
                      onPress={() => {
                        if (isGhost && !ghostOwned) {
                          void purchaseStoreItem(WONDERJUMP_GHOST_STORE_ITEM_ID, async (status) => {
                            await handleEquipWonderJumpCharacter('ghost', status)
                          })
                          return
                        }
                        void handleEquipWonderJumpCharacter(option.id)
                      }}
                    >
                      <Text
                        style={[
                          styles.characterEquipButtonText,
                          equipped ? styles.characterEquipButtonTextEquipped : null,
                        ]}
                      >
                        {equipped
                          ? 'Equipped'
                          : isGhost && !ghostOwned
                            ? ghostBusy
                              ? 'Buying...'
                              : 'Buy'
                            : 'Equip'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
        {storeMessage ? <Text style={styles.infoText}>{storeMessage}</Text> : null}
      </View>

      <View style={styles.framesSection}>
        <Text style={styles.sectionHeading}>Avatar Frames</Text>
        <View style={styles.framesGrid}>
          {AVATAR_FRAME_SHOP.map((frame) => {
            const itemId = avatarFrameStoreItemId(frame.id)
            const price = getAvatarFrameStorePrice(frame.id) ?? 0
            const owned = isStoreItemOwned(itemId)
            const busy = purchasingItemId === itemId
            const canAfford = availableCoins >= price
            return (
              <AvatarFramePreviewTile
                key={frame.id}
                frameId={frame.id}
                size={AVATAR_FRAME_SIZE_PREVIEW_TILE}
                equipped={equippedAvatarFrame === frame.id}
                owned={owned}
                priceCoins={price}
                canAfford={canAfford}
                busy={busy}
                onPrimaryPress={() => {
                  if (!owned) {
                    void purchaseStoreItem(itemId, async (status) => {
                      await handleEquipAvatarFrame(frame.id, status)
                    })
                    return
                  }
                  void handleEquipAvatarFrame(frame.id)
                }}
                previewUri={framePreviewUser.uri}
                previewInitial={framePreviewUser.initial}
                previewFallbackBackgroundColor={useWhiteFramePreviewFallback ? '#FFFFFF' : undefined}
                previewFallbackTextColor={useWhiteFramePreviewFallback ? '#111111' : undefined}
              />
            )
          })}
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

function buildDailyRewardStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DAILY_FILL,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 110,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  /** Same footprint as `backButton` so “Wonder Store” lines up with “Daily Rewards” text. */
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DAILY_FILL,
    borderWidth: 1,
    borderColor: L(0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainScreenHeading: {
    flex: 1,
    minWidth: 0,
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  wonderStoreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
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
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  bannerCard: {
    backgroundColor: DAILY_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L(0.3),
    padding: 12,
    marginBottom: 10,
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
    fontSize: 16,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Geist-Regular',
    fontSize: 11,
    marginBottom: 10,
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
    fontSize: 11,
    marginBottom: 4,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: L(0.35),
    backgroundColor: DAILY_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleClaimed: {
    borderColor: theme.brandAccent,
    backgroundColor: theme.brandAccent,
  },
  streakRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  streakText: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 26,
  },
  rewardCarousel: {
    paddingRight: REWARD_CAROUSEL_PAD_RIGHT,
  },
  rewardCarouselWrap: {
    marginBottom: 10,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  carouselNavButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCard: {
    minHeight: 280,
    backgroundColor: DAILY_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L(0.3),
    padding: 12,
  },
  rewardCardDay: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
  },
  rewardCardCoinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCardFooter: {
    paddingTop: 8,
  },
  rewardCardCoins: {
    color: theme.brandAccent,
    fontFamily: 'Geist-Bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  rewardCardCoinsDay7: {
    fontSize: 14,
    lineHeight: 18,
  },
  rewardClaimButton: {
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brandAccent,
  },
  rewardClaimButtonDisabled: {
    backgroundColor: '#9fb4d8',
  },
  rewardClaimButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
  },
  rewardStatusPill: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L(0.35),
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardStatusClaimed: {
    borderColor: theme.brandAccent,
    backgroundColor: L(0.14),
  },
  rewardStatusText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  rewardStatusTextClaimed: {
    color: theme.brandAccent,
  },
  infoText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Geist-Medium',
    fontSize: 11,
  },
  errorText: {
    marginTop: 8,
    color: '#dc2626',
    fontFamily: 'Geist-Medium',
    fontSize: 11,
  },
  storeSection: {
    marginTop: 14,
  },
  badgesHeading: {
    color: '#ffffff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 17,
    marginBottom: 8,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'stretch',
  },
  badgesSeeAllButton: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  badgesSeeAllButtonText: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  badgeStoreCard: {
    backgroundColor: DAILY_FILL,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L(0.28),
    padding: 7,
    alignItems: 'stretch',
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  badgeCardBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  badgeStoreCardEquipped: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderColor: L(0.45),
  },
  badgeTitleSlot: {
    minHeight: 28,
    marginBottom: 2,
    justifyContent: 'flex-start',
  },
  badgeCaptionSlot: {
    minHeight: 36,
    justifyContent: 'flex-start',
  },
  badgeCardTitle: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    lineHeight: 16,
  },
  badgeCardCaption: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: 'Geist-Regular',
    fontSize: 11,
    lineHeight: 13,
  },
  /** Progress + action: fixed rhythm so bars and Locked/Equip line up across tiles. */
  badgeCardFooter: {
    alignSelf: 'stretch',
    gap: 5,
    paddingTop: 1,
  },
  badgeProgressSlot: {
    height: 28,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  badgeProgressSlotSpacer: {
    height: 28,
  },
  badgeProgressBlock: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  badgeProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 1,
  },
  badgeProgressText: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Geist-Medium',
    fontSize: 10,
  },
  badgeProgressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  badgeProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.brandAccent,
  },
  badgePreviewPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 3,
    minHeight: 60,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  badgePreviewPlateEquipped: {
    
  },
  badgeEquipButton: {
    minHeight: 30,
    borderRadius: 7,
    backgroundColor: theme.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEquipButtonEquipped: {
    backgroundColor: L(0.22),
    borderWidth: 1,
    borderColor: L(0.45),
  },
  badgeEquipButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badgeEquipButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  badgeEquipButtonTextEquipped: {
    color: theme.brandAccent,
  },
  badgeEquipButtonTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  themeSection: {
    marginTop: 14,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeCard: {
    width: '48.5%',
    backgroundColor: DAILY_FILL,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L(0.28),
    padding: 8,
  },
  themeSwatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 6,
  },
  themeSwatchImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }],
  },
  themeName: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    marginBottom: 4,
  },
  themeCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  themeCostValue: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
  },
  themeBuyButton: {
    minHeight: 30,
    borderRadius: 7,
    backgroundColor: theme.brandAccent,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBuyButtonOwned: {
    backgroundColor: theme.brandAccent,
  },
  themeBuyButtonEquipped: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.brandAccent,
  },
  themeBuyButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  themeBuyButtonTextOwned: {
    color: '#050505',
  },
  themeBuyButtonTextEquipped: {
    color: theme.brandAccent,
  },
  themeDefaultRow: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  themeDefaultText: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
  },
  charactersSection: {
    marginTop: 14,
  },
  charactersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  characterCard: {
    flexBasis: '31%',
    minWidth: 108,
    flexGrow: 1,
    backgroundColor: DAILY_FILL,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L(0.28),
    padding: 8,
    minHeight: 152,
  },
  characterPreviewPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    marginBottom: 6,
  },
  characterName: {
    color: '#ffffff',
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    minHeight: 16,
  },
  characterMetaRow: {
    marginTop: 'auto',
    alignItems: 'stretch',
    gap: 6,
  },
  characterPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  characterPrice: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
  },
  characterEquipButton: {
    minHeight: 30,
    width: '100%',
    borderRadius: 7,
    backgroundColor: theme.brandAccent,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterEquipButtonEquipped: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.brandAccent,
  },
  characterEquipButtonDisabled: {
    opacity: 0.5,
  },
  characterEquipButtonText: {
    color: '#050505',
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
  },
  characterEquipButtonTextEquipped: {
    color: theme.brandAccent,
  },
  framesSection: {
    marginTop: 16,
  },
  framesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  plainFrameRow: {
    marginTop: 3,
    paddingVertical: 8,
    alignItems: 'center',
  },
  plainFrameText: {
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  plainFrameTextActive: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
  },
  storeBalanceBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: DAILY_FILL,
    borderWidth: 1,
    borderColor: L(0.35),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storeBalanceBadgeValue: {
    color: theme.brandAccent,
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
  },
})
}
