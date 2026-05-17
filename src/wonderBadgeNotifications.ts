import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DailyRewardStatus } from '../types'
import type { WonderBadgeId } from './wonderBadgesCatalog'
import { listNotifiableEarnedWonderBadgeIds } from './wonderBadgeEarned'

const SEEN_BADGE_IDS_KEY = 'wonderport-seen-wonder-badge-ids'
const SEEN_BADGE_IDS_INIT_KEY = 'wonderport-seen-wonder-badge-ids-initialized'

async function readSeenWonderBadgeIdSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_BADGE_IDS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((x) => String(x)))
  } catch {
    return new Set()
  }
}

export async function markWonderBadgesSeen(ids: WonderBadgeId[]): Promise<void> {
  if (!ids.length) return
  const seen = await readSeenWonderBadgeIdSet()
  for (const id of ids) seen.add(id)
  try {
    await AsyncStorage.setItem(SEEN_BADGE_IDS_KEY, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}

/** First launch after this feature: do not alert for badges already earned. */
async function ensureSeenBadgesInitialized(earnedNow: WonderBadgeId[]): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(SEEN_BADGE_IDS_INIT_KEY)
    if (done) return
    await markWonderBadgesSeen(earnedNow)
    await AsyncStorage.setItem(SEEN_BADGE_IDS_INIT_KEY, '1')
  } catch {
    /* ignore */
  }
}

export async function hasUnseenWonderBadgeUnlock(status: DailyRewardStatus): Promise<boolean> {
  const earned = listNotifiableEarnedWonderBadgeIds(status)
  await ensureSeenBadgesInitialized(earned)
  const seen = await readSeenWonderBadgeIdSet()
  return earned.some((id) => !seen.has(id))
}

export async function shouldShowDailyRewardsHomeAlert(
  status: DailyRewardStatus | null | undefined,
): Promise<boolean> {
  if (!status) return false
  if (status.canClaim) return true
  return hasUnseenWonderBadgeUnlock(status)
}
