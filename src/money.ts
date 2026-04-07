export type MoneyLike =
  | { amount: string | number; currencyCode?: string | null }
  | null
  | undefined

export function formatMoney(value: MoneyLike, fallbackCurrency: string = 'USD') {
  if (!value) return ''
  const amountNum = Number((value as any).amount)
  const currency = String((value as any).currencyCode || fallbackCurrency || 'USD')
  if (!Number.isFinite(amountNum)) {
    return String((value as any).amount ?? '')
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amountNum)
  } catch {
    return `${currency} ${amountNum.toFixed(2)}`
  }
}

export function parseMoneyToNumber(value: unknown) {
  if (value && typeof value === 'object' && 'amount' in (value as any)) {
    const n = Number((value as any).amount)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  return 0
}

