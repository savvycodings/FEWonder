import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ImageSourcePropType } from 'react-native'
import type { ShopifyMoney } from '../types'
import { getProductSaveImageSource } from './productSave'

export const CART_STORAGE_KEY = 'wonderport-cart-v1'

export type PersistedCartItem = {
  id: string
  handle?: string
  title: string
  quantity: number
  price?: ShopifyMoney | string | null
  selectedPackaging?: 'single' | 'set'
  featuredImageUrl?: string | null
  productType?: string | null
  totalInventory?: number | null
  availableForSale?: boolean | null
  inStock?: boolean
}

function stripCartItemForStorage(item: any): PersistedCartItem | null {
  const id = String(item?.id || '').trim()
  const title = String(item?.title || '').trim()
  if (!id || !title) return null
  return {
    id,
    handle: item.handle,
    title,
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    price: item.price ?? null,
    selectedPackaging: item.selectedPackaging,
    featuredImageUrl: item.featuredImageUrl ?? null,
    productType: item.productType ?? null,
    totalInventory: item.totalInventory ?? null,
    availableForSale: item.availableForSale ?? null,
    inStock: item.inStock,
  }
}

export function hydrateCartItemFromStorage(row: PersistedCartItem) {
  const image: ImageSourcePropType | undefined = getProductSaveImageSource({
    featuredImageUrl: row.featuredImageUrl,
    image: undefined,
  })
  return {
    ...row,
    image,
  }
}

export async function readPersistedCartItems(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => hydrateCartItemFromStorage(row as PersistedCartItem))
      .filter((item) => item.id && item.title)
  } catch (error) {
    console.log('Unable to read cart from storage', error)
    return []
  }
}

export async function writePersistedCartItems(items: any[]): Promise<void> {
  try {
    const payload = items
      .map(stripCartItemForStorage)
      .filter((row): row is PersistedCartItem => row != null)
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.log('Unable to persist cart to storage', error)
  }
}

export async function clearPersistedCartItems(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_STORAGE_KEY)
  } catch (error) {
    console.log('Unable to clear cart storage', error)
  }
}
