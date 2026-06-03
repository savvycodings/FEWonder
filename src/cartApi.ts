import { DOMAIN } from '../constants'
import type { ShopifyProduct } from '../types'
import type { CartSyncLine } from './cartLine'

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

export type CartApiItem = ShopifyProduct & {
  quantity: number
  selectedPackaging?: 'single' | 'set'
}

export async function fetchCart(sessionToken: string): Promise<CartApiItem[]> {
  const response = await fetch(`${DOMAIN}/auth/cart`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to load cart')
  }
  return Array.isArray(data?.items) ? data.items : []
}

export async function syncCartToAccount(
  sessionToken: string,
  lines: CartSyncLine[],
): Promise<CartApiItem[]> {
  const response = await fetch(`${DOMAIN}/auth/cart`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      items: lines.map((line) => ({
        productId: line.productId,
        packaging: line.packaging,
        quantity: line.quantity,
      })),
    }),
  })
  const { data } = await parseJson(response)
  if (!response.ok) {
    throw new Error(data?.error || data?.raw || 'Unable to update cart')
  }
  return Array.isArray(data?.items) ? data.items : []
}
