import { DOMAIN } from '../constants'
import type { ShopifyProduct } from '../types'

async function parseJson(response: Response) {
  const raw = await response.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }
  return { data, raw }
}

export async function fetchSavedProducts(sessionToken: string): Promise<ShopifyProduct[]> {
  const response = await fetch(`${DOMAIN}/auth/saved-products`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to load saved products')
  }
  return Array.isArray(data?.products) ? data.products : []
}

export async function saveProductToAccount(
  sessionToken: string,
  productId: string,
): Promise<ShopifyProduct[]> {
  const response = await fetch(`${DOMAIN}/auth/saved-products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ productId }),
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to save product')
  }
  return Array.isArray(data?.products) ? data.products : []
}

export async function unsaveProductFromAccount(
  sessionToken: string,
  productId: string,
): Promise<ShopifyProduct[]> {
  const response = await fetch(`${DOMAIN}/auth/saved-products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to remove saved product')
  }
  return Array.isArray(data?.products) ? data.products : []
}
