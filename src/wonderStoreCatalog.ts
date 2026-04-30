/** Client-side Wonder Store pricing (must match `WONDER_STORE_ITEM_COSTS` on the server). */

export const WONDERJUMP_GHOST_STORE_ITEM_ID = 'wonderjump_character_ghost'
export const WONDERJUMP_GHOST_STORE_COST = 10

/** Paid avatar border frames: frame id → price in wonder coins. */
export const AVATAR_FRAME_SHOP_COSTS: Record<string, number> = {
  neon: 5,
  gold: 5,
  rainbow: 5,
  prism: 7,
  meridian: 7,
  hex: 12,
  shard: 12,
  rune: 12,
  sentinel: 12,
}

export function avatarFrameStoreItemId(frameId: string): string {
  return `avatar_frame_${frameId}`
}

export function getAvatarFrameStorePrice(frameId: string): number | undefined {
  return AVATAR_FRAME_SHOP_COSTS[frameId]
}
