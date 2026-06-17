import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { WonderSpinningCoin } from './WonderCoin'
import type { CheckoutLineItem } from '../checkoutFlow'
import type { PudoLockerTier } from '../pudoLockerSizes'
import { getUserSessionToken, quoteOrder, type OrderQuoteResult } from '../ordersApi'

function formatZar(cents: number): string {
  return `R${(Math.max(0, cents) / 100).toFixed(2)}`
}

type CheckoutWonderCoinsSectionProps = {
  theme: any
  items: CheckoutLineItem[]
  pudoLockerTier: PudoLockerTier
  applyWonderCoins: boolean
  wonderCoinsToRedeem: number
  onApplyWonderCoinsChange: (value: boolean) => void
  onWonderCoinsToRedeemChange: (value: number) => void
  onQuoteChange?: (quote: OrderQuoteResult | null) => void
}

export function CheckoutWonderCoinsSection({
  theme,
  items,
  pudoLockerTier,
  applyWonderCoins,
  wonderCoinsToRedeem,
  onApplyWonderCoinsChange,
  onWonderCoinsToRedeemChange,
  onQuoteChange,
}: CheckoutWonderCoinsSectionProps) {
  const styles = useMemo(() => getStyles(theme), [theme])
  const [quote, setQuote] = useState<OrderQuoteResult | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [coinsInput, setCoinsInput] = useState(String(wonderCoinsToRedeem || ''))

  useEffect(() => {
    setCoinsInput(String(wonderCoinsToRedeem || ''))
  }, [wonderCoinsToRedeem])

  const refreshQuote = useCallback(async () => {
    if (!items.length) {
      setQuote(null)
      onQuoteChange?.(null)
      return
    }
    const token = await getUserSessionToken()
    setSignedIn(Boolean(token))
    if (!token) {
      setQuote(null)
      onQuoteChange?.(null)
      return
    }
    setQuoteBusy(true)
    setQuoteError('')
    try {
      const coins = applyWonderCoins ? wonderCoinsToRedeem : 0
      const result = await quoteOrder({
        items,
        pudoLockerTier,
        wonderCoinsToRedeem: coins,
      })
      setQuote(result)
      onQuoteChange?.(result)
    } catch (e: any) {
      setQuoteError(e?.message || 'Could not load WonderCoins quote.')
      setQuote(null)
      onQuoteChange?.(null)
    } finally {
      setQuoteBusy(false)
    }
  }, [applyWonderCoins, items, onQuoteChange, pudoLockerTier, wonderCoinsToRedeem])

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote()
    }, 280)
    return () => clearTimeout(t)
  }, [refreshQuote])

  const walletBalance = quote?.walletBalance ?? 0
  const maxRedeemable = quote?.maxRedeemableCoins ?? 0

  function handleUseMax() {
    onWonderCoinsToRedeemChange(maxRedeemable)
    setCoinsInput(String(maxRedeemable))
  }

  function commitCoinsInput(raw: string) {
    const n = Math.max(0, Math.floor(Number(raw.replace(/\D/g, '')) || 0))
    const capped = Math.min(n, maxRedeemable > 0 ? maxRedeemable : n)
    onWonderCoinsToRedeemChange(capped)
    setCoinsInput(String(capped))
  }

  if (signedIn === false) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionLabel}>Wonder Coins</Text>
        <Text style={styles.hint}>Sign in to earn and redeem WonderCoins at checkout.</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Wonder Coins</Text>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Apply WonderCoins</Text>
        <Switch
          value={applyWonderCoins}
          onValueChange={(v) => {
            onApplyWonderCoinsChange(v)
            if (v && wonderCoinsToRedeem === 0 && maxRedeemable > 0) {
              onWonderCoinsToRedeemChange(maxRedeemable)
              setCoinsInput(String(maxRedeemable))
            }
          }}
          trackColor={{ false: theme.tileBorderColor, true: theme.brandAccent }}
          thumbColor="#ffffff"
        />
      </View>

      <View style={styles.balanceRow}>
        <WonderSpinningCoin size={18} fallbackColor={theme.brandAccent} />
        <Text style={styles.balanceText}>Balance: {walletBalance}</Text>
      </View>

      {applyWonderCoins ? (
        <View style={styles.inputRow}>
          <TextInput
            value={coinsInput}
            onChangeText={setCoinsInput}
            onBlur={() => commitCoinsInput(coinsInput)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
          />
          <Pressable style={styles.maxBtn} onPress={handleUseMax} disabled={maxRedeemable <= 0}>
            <Text style={styles.maxBtnText}>Use max</Text>
          </Pressable>
        </View>
      ) : null}

      {quoteError ? <Text style={styles.errorText}>{quoteError}</Text> : null}

      {quote ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatZar(quote.subtotalCents)}</Text>
          </View>
          {quote.discountCents > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>WonderCoins discount</Text>
              <Text style={[styles.summaryValue, styles.discountValue]}>
                −{formatZar(quote.discountCents)}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>
              {quote.freeDelivery ? 'Free' : formatZar(quote.shippingCents)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatZar(quote.totalCents)}</Text>
          </View>
          {quote.wonderCoinsEarned > 0 ? (
            <Text style={styles.earnPreview}>
              {"You'll earn "}{quote.wonderCoinsEarned} WonderCoins on this order
            </Text>
          ) : null}
        </View>
      ) : quoteBusy ? (
        <ActivityIndicator color={theme.brandAccent} style={styles.loader} />
      ) : null}
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    wrap: {
      marginTop: 12,
      marginBottom: 8,
    },
    sectionLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: theme.textColor,
      marginBottom: 10,
    },
    hint: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 10,
      lineHeight: 17,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    balanceText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    toggleLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: theme.textColor,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor,
      backgroundColor: theme.tileBackgroundColor || '#fff',
      paddingHorizontal: 12,
      fontFamily: theme.regularFont,
      fontSize: 15,
      color: theme.textColor,
    },
    maxBtn: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor,
    },
    maxBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
    },
    summaryCard: {
      marginTop: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.tileBorderColor,
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor,
      padding: 12,
      gap: 6,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
    },
    summaryValue: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: theme.textColor,
    },
    discountValue: {
      color: theme.brandAccent,
    },
    totalRow: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.tileBorderColor,
    },
    totalLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    totalValue: {
      fontFamily: theme.boldFont || theme.semiBoldFont,
      fontSize: 16,
      color: theme.textColor,
    },
    earnPreview: {
      marginTop: 6,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
    },
    errorText: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.destructiveColor || '#c0392b',
      marginBottom: 6,
    },
    loader: {
      marginVertical: 8,
    },
  })
}
