import type { User } from '../types'
import { tierAllowedForCart, type PudoLockerTier } from './pudoLockerSizes'
import { linePackagingFromItem } from './pudoLockerSizes'
import { validateShippingAddressInput, type ShippingAddressInput } from './shippingAddressValidation'

export function deliveryPrefillFromUser(user: Partial<User> | null | undefined): {
  contactEmail: string
  contactPhone: string
  pudoName: string
  pudoAddr: string
  shippingLine1: string
  shippingLine2: string
  shippingPostalCode: string
  shippingCity: string
  shippingProvince: string
  customerEftName: string
  customerEftBank: string
  customerEftAcct: string
} {
  return {
    contactEmail: String(user?.email || '').trim(),
    contactPhone: String(user?.phone || '').trim(),
    pudoName: String(user?.pudoLockerName || '').trim(),
    pudoAddr: String(user?.pudoLockerAddress || '').trim(),
    shippingLine1: String(user?.shippingAddress || '').trim(),
    shippingLine2: String(user?.shippingAddressLine2 || '').trim(),
    shippingPostalCode: String(user?.shippingPostalCode || '').trim(),
    shippingCity: String(user?.shippingCity || '').trim(),
    shippingProvince: '',
    customerEftName: String(user?.eftBankAccountName || '').trim(),
    customerEftBank: String(user?.eftBankName || '').trim(),
    customerEftAcct: String(user?.eftBankAccountNumber || '').trim(),
  }
}

export type CheckoutLineItem = {
  productId: string
  quantity: number
  packaging?: 'single' | 'set'
}

export type CheckoutDeliveryDetails = {
  pudoLockerTier: PudoLockerTier
  contactPhone: string
  contactEmail: string
  pudoLockerName: string
  pudoLockerAddress: string
  shippingAddress?: string
  shippingAddressLine2?: string
  shippingPostalCode?: string
  shippingCity?: string
  shippingProvince?: string
  customerEftAccountName?: string
  customerEftBankName?: string
  customerEftAccountNumber?: string
}

export type CheckoutFlowSource = 'cart' | 'product'

export function checkoutHasWholeSet(items: CheckoutLineItem[]): boolean {
  return items.some((line) => line.packaging === 'set')
}

export function validateCheckoutDelivery(
  details: CheckoutDeliveryDetails,
  hasWholeSet: boolean,
): string | null {
  const phone = details.contactPhone.trim()
  if (!phone || phone.replace(/\D/g, '').length < 9) {
    return 'Enter a valid cellphone number for this order.'
  }
  const em = details.contactEmail.trim().toLowerCase()
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return 'Enter a valid email address for order updates.'
  }
  if (details.pudoLockerTier === 'door') {
    const addrErr = validateShippingAddressInput({
      line1: details.shippingAddress || '',
      line2: details.shippingAddressLine2 || '',
      postalCode: details.shippingPostalCode || '',
      city: details.shippingCity || '',
      province: details.shippingProvince || '',
    })
    if (addrErr) return addrErr
  } else if (!details.pudoLockerName.trim() || !details.pudoLockerAddress.trim()) {
    return 'Enter your Pudo locker name and address.'
  }
  if (hasWholeSet && !tierAllowedForCart(details.pudoLockerTier, true)) {
    return 'Whole set orders require door delivery (R110).'
  }
  return null
}

/** Build checkout line items from cart context rows. */
export function cartItemsToCheckoutLines(cartItems: any[]): CheckoutLineItem[] {
  return cartItems.map((item) => ({
    productId: String(item.id),
    quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    packaging: linePackagingFromItem(item),
  }))
}
