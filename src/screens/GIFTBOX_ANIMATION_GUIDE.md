# Gift Box Animation Guide (Daily Rewards)

This guide explains where the gift box animation lives, how it is triggered, and what to edit when tuning it.

## Main File

- Animation implementation: `app/src/screens/dailyRewards.tsx`
- SVG asset: `app/assets/giftbox.svg`

## Where To Find It In Code

Look for these symbols in `dailyRewards.tsx`:

- `GIFT_BOX_PREVIEW_RAY_ANGLES`
  - Static angle data for the rotating ray burst.
- `GiftBoxPrizeRays()`
  - Renders the sunburst/rays behind the box.
- `giftBoxPreviewPhase`
  - Core animation phase value used for floating + tilt motion.
- `giftBoxGlowRotateAnim`
  - Rotation value for the ray burst.
- `giftBoxFloatY`, `giftBoxTiltDeg`, `giftBoxGlowRotateDeg`
  - Interpolated transforms used by the animated wrappers.
- `isGiftBoxReadyToClaim`
  - Ready-state gate for the real box animation.
- `showGiftBoxAnimationPreview`
  - Gate for showing the separate preview/test animation card.

## How It Works

There are two animation displays in the screen:

1. **Real mystery gift box**
   - Plays the animation when the box is ready to claim.
   - Ready condition is based on timer logic:
     - `isGiftBoxReadyToClaim = Boolean(giftBoxReadyAt) && !isGiftBoxCoolingDown`

2. **Preview/test card**
   - Always shows the same final animation for visual testing.
   - Controlled by `showGiftBoxAnimationPreview`.

Animation lifecycle is controlled in a `useEffect` that:

- starts `Animated.loop(Animated.timing(...))` for motion
- starts a second loop for ray rotation
- stops and resets values when not needed

## Motion Layers

The animation is built from two layers:

- **Box layer**
  - Wrapped in `styles.giftBoxAnimatedPreviewGroup`
  - Uses `translateY` (`giftBoxFloatY`) + `rotate` (`giftBoxTiltDeg`)

- **Glow/ray layer**
  - Wrapped in `styles.giftBoxPrizeRaysOrbit`
  - Uses `rotate` (`giftBoxGlowRotateDeg`)
  - Rays are drawn by `GiftBoxPrizeRays()`

## Tuning Cheatsheet

For smoother/faster/slower animation, edit these:

- Motion speed:
  - `duration` values in the `Animated.timing(...)` loops
- Motion shape:
  - `giftBoxFloatY` interpolation `outputRange`
  - `giftBoxTiltDeg` interpolation `outputRange`
- Glow speed:
  - `duration` in `giftBoxGlowRotateAnim` timing loop
- Ray look:
  - `GIFT_BOX_PREVIEW_RAY_ANGLES`
  - geometry/opacities in `GiftBoxPrizeRays()`

## Related Interaction Logic

- Start timer: `handleOpenGiftBox()`
- Claim reward when ready: `handleClaimGiftBoxReward()`
- Reward amount: `GIFT_BOX_REWARD_COINS`
- Cooldown length: `GIFT_BOX_COOLDOWN_MS`

## Quick Debug Tips

- If animation does not play on the real box:
  - verify `isGiftBoxReadyToClaim` becomes `true`
- If preview is missing:
  - verify `showGiftBoxAnimationPreview` is `true`
- If SVG falls back to icon:
  - check `giftBoxSvgXml` / `giftBoxSvgUri` loading path

