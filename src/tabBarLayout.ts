/** Must stay in sync with `tabBarStyle` in `main.tsx` (floating pill nav). */
export const FLOATING_TAB_BAR_BOTTOM = 8
export const FLOATING_TAB_BAR_HEIGHT = 64

/** Gap between scroll/composer content and the top of the tab bar pill. */
export const CONTENT_ABOVE_TAB_BAR_GAP = 14

/** Fallback when `useBottomTabBarHeight()` is unavailable or returns 0. */
export function floatingTabBarClearance(bottomInset: number): number {
  return bottomInset + FLOATING_TAB_BAR_BOTTOM + FLOATING_TAB_BAR_HEIGHT + CONTENT_ABOVE_TAB_BAR_GAP
}
