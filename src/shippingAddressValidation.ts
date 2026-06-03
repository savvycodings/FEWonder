const ADDRESS_TEXT_PATTERN = /^[a-zA-Z0-9\s,.'#/-]+$/
const PLACE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z\s'.-]*$/

export type ShippingAddressInput = {
  line1: string
  line2: string
  postalCode: string
  city: string
  province: string
}

export function validateShippingAddressInput(input: ShippingAddressInput): string | null {
  const line1 = input.line1.trim()
  const line2 = input.line2.trim()
  const postalCode = input.postalCode.trim()
  const city = input.city.trim()
  const province = input.province.trim()

  if (!line1 || line1.length < 5 || !ADDRESS_TEXT_PATTERN.test(line1)) {
    return 'Enter a valid street address.'
  }
  if (line2 && !ADDRESS_TEXT_PATTERN.test(line2)) {
    return 'Enter a valid apartment, suite, or unit.'
  }
  if (!/^\d{4}$/.test(postalCode)) {
    return 'Enter a valid 4-digit postal code.'
  }
  if (!city || !PLACE_NAME_PATTERN.test(city)) {
    return 'Enter a valid city name.'
  }
  if (!province || !PLACE_NAME_PATTERN.test(province)) {
    return 'Enter a valid province.'
  }
  return null
}

export function formatShippingAddressLine2(input: ShippingAddressInput): string {
  const parts = [
    input.line2.trim(),
    input.city.trim(),
    input.province.trim(),
    input.postalCode.trim(),
  ].filter(Boolean)
  return parts.join(', ')
}
