import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ProductSavePayload } from './productSave'
import { getProductSaveImageSource } from './productSave'

export const SAVED_STORAGE_KEY = 'wonderport-saved-v1'

function stripSavedItemForStorage(item: ProductSavePayload): ProductSavePayload {
  return {
    id: item.id,
    handle: item.handle,
    title: item.title,
    price: item.price,
    featuredImageUrl: item.featuredImageUrl ?? null,
    category: item.category,
    productType: item.productType,
  }
}

function hydrateSavedItemFromStorage(row: ProductSavePayload): ProductSavePayload {
  const image = getProductSaveImageSource({
    featuredImageUrl: row.featuredImageUrl,
    image: undefined,
  })
  return { ...row, image }
}

export async function readPersistedSavedItems(): Promise<ProductSavePayload[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => hydrateSavedItemFromStorage(row as ProductSavePayload))
  } catch (error) {
    console.log('Unable to read saved items from storage', error)
    return []
  }
}

export async function writePersistedSavedItems(items: ProductSavePayload[]): Promise<void> {
  try {
    const payload = items.map(stripSavedItemForStorage)
    await AsyncStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.log('Unable to persist saved items to storage', error)
  }
}

export async function clearPersistedSavedItems(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVED_STORAGE_KEY)
  } catch (error) {
    console.log('Unable to clear saved storage', error)
  }
}
