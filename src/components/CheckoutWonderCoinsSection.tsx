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
import { estimateCheckoutQuote } from '../checkoutQuoteEstimate'
import type { PudoLockerTier } from '../pudoLockerSizes'
import { getUserSessionToken, quoteOrder, type OrderQuoteResult } from '../ordersApi'
import { getDailyRewardStatus } from '../utils'

function formatZar(cents: number): string {
  return `R${(Math.max(0, cents) / 100).toFixed(2)}`
}

type CheckoutWonderCoinsSectionProps = {
  theme: any
  items: CheckoutLineItem[]
  subtotalZar: number
  pudoLockerTier: PudoLockerTier
  applyWonderCoins: boolean
  wonderCoinsToRedeem: number
  onApplyWonderCoinsChange: (value: boolean) => void
  onWonderCoinsToRedeemChange: (value: number) => void
  onQuoteChange?: (quote: OrderQuoteResult | null) => void
}

function CheckoutOrderSummaryCard({
  theme,
  quote,
  isEstimate,
  styles,
}: {
  theme: any
  quote: OrderQuoteResult
  isEstimate: boolean
  styles: ReturnType<typeof getStyles>
}) {
  return (
    <View style={styles.summaryCard}>
      {isEstimate ? (
        <Text style={styles.estimateNote}>
          Estimated totals — final amounts confirmed when you pay.
        </Text>
      ) : null}
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
  )
}

export function CheckoutWonderCoinsSection({
  theme,
  items,
  subtotalZar,
  pudoLockerTier,
  applyWonderCoins,
  wonderCoinsToRedeem,
  onApplyWonderCoinsChange,
  onWonderCoinsToRedeemChange,
  onQuoteChange,
}: CheckoutWonderCoinsSectionProps) {
  const styles = useMemo(() => getStyles(theme), [theme])
  const [serverQuote, setServerQuote] = useState<OrderQuoteResult | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [walletBalanceHint, setWalletBalanceHint] = useState(0)
  const [coinsInput, setCoinsInput] = useState(String(wonderCoinsToRedeem || ''))

  useEffect(() => {
    setCoinsInput(String(wonderCoinsToRedeem || ''))
  }, [wonderCoinsToRedeem])

  const loadWalletBalanceHint = useCallback(async (token: string) => {
    try {
      const rewards = await getDailyRewardStatus(token)
      setWalletBalanceHint(rewards.walletBalance ?? 0)
    } catch {
      /* optional — server quote also returns walletBalance */
    }
  }, [])

  const refreshQuote = useCallback(async () => {
    if (!items.length) {
      setServerQuote(null)
      onQuoteChange?.(null)
      return
    }

    const token = await getUserSessionToken()
    setSignedIn(Boolean(token))
    if (token) {
      void loadWalletBalanceHint(token)
    } else {
      setWalletBalanceHint(0)
    }

    setQuoteBusy(true)
    setQuoteError('')
    try {
      const coins = token && applyWonderCoins ? wonderCoinsToRedeem : 0
      const result = await quoteOrder({
        items,
        pudoLockerTier,
        wonderCoinsToRedeem: coins,
      })
      setServerQuote(result)
      setWalletBalanceHint(result.walletBalance)
      onQuoteChange?.(result)
    } catch (e: any) {
      setQuoteError(e?.message || 'Could not refresh order totals.')
      setServerQuote(null)
      onQuoteChange?.(null)
    } finally {
      setQuoteBusy(false)
    }
  }, [
    applyWonderCoins,
    items,
    loadWalletBalanceHint,
    onQuoteChange,
    pudoLockerTier,
    wonderCoinsToRedeem,
  ])

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote()
    }, 280)
    return () => clearTimeout(t)
  }, [refreshQuote])

  const fallbackQuote = useMemo(
    () =>
      estimateCheckoutQuote({
        subtotalZar,
        pudoLockerTier,
        wonderCoinsToRedeem: applyWonderCoins ? wonderCoinsToRedeem : 0,
        walletBalance: serverQuote?.walletBalance ?? walletBalanceHint,
      }),
    [
      applyWonderCoins,
      pudoLockerTier,
      serverQuote?.walletBalance,
      subtotalZar,
      walletBalanceHint,
      wonderCoinsToRedeem,
    ],
  )

  const displayQuote = serverQuote ?? fallbackQuote
  const isEstimate = serverQuote == null && subtotalZar > 0
  const walletBalance = serverQuote?.walletBalance ?? walletBalanceHint
  const maxRedeemable = displayQuote.maxRedeemableCoins

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

  const showSummary = displayQuote.subtotalCents > 0 || subtotalZar > 0

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Wonder Coins</Text>

      {signedIn === false ? (
        <Text style={styles.hint}>Sign in to earn and redeem WonderCoins at checkout.</Text>
      ) : (
        <>
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

          {applyWonderCoins && displayQuote.maxRedeemableCoins <= 0 ? (
            <Text style={styles.hint}>
              {walletBalance <= 0
                ? 'You have no WonderCoins to apply yet. Earn them from completed orders or redeem codes.'
                : 'WonderCoins only discount merchandise (not delivery). Your subtotal may be too low to redeem coins on this order.'}
            </Text>
          ) : null}
        </>
      )}

      {quoteError ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{quoteError}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refreshQuote()} disabled={quoteBusy}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {showSummary ? (
        <CheckoutOrderSummaryCard
          theme={theme}
          quote={displayQuote}
          isEstimate={isEstimate}
          styles={styles}
        />
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
    estimateNote: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      marginBottom: 4,
      lineHeight: 15,
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
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    errorText: {
      flex: 1,
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.destructiveColor || '#c0392b',
    },
    retryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.tileBorderColor,
    },
    retryBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: theme.textColor,
    },
    loader: {
      marginVertical: 8,
    },
  })
}
