# Backend handoff (Expo app ↔ API)

Living document for the **backend developer**: what the mobile app expects, how the **current server** behaves, and **schema / route gaps** to resolve—without changing DB files from this repo’s perspective (coordinate migrations in `server` separately).

---

## Expo client stack (how we call the API)

| Piece | Detail |
|--------|--------|
| Base URL | From env: `EXPO_PUBLIC_DEV_API_URL` or `EXPO_PUBLIC_PROD_API_URL`, switched by `EXPO_PUBLIC_ENV`. Resolved in `constants.ts` as `DOMAIN` (scheme added if missing; **no trailing slash**). |
| HTTP | `fetch()` + JSON bodies; `Content-Type: application/json` where needed. |
| Auth | `Authorization: Bearer <sessionToken>` after login/register. Token is opaque hex string from server. |
| Streaming | **SSE**: `react-native-sse` for `/community/stream` and for chat model streams (`/chat/:type` POST body in `utils.getEventSource`). |
| Session persistence | AsyncStorage (`wonderport-auth`); not the backend’s concern beyond issuing/revoking tokens. |

**Android dev note:** `localhost` in `.env` points at the device, not your PC. Use your machine’s LAN IP or emulator host (`10.0.2.2`) so `DOMAIN` reaches the Express server (see comments in `constants.ts`).

---

## Current server stack (reference)

| Piece | Detail |
|--------|--------|
| Runtime | Node + **Express** (`server/src/index.ts`), **CORS** enabled, JSON body limit **50mb** (images). |
| Default port | **3050** (`app.listen(3050)`). |
| Database | **PostgreSQL** via `pg`; `DATABASE_URL` in `server/.env` (often Neon). SSL used in `server/src/db/client.ts`. |
| Media | **Cloudinary** for profile/community image uploads when env vars are set. |
| External APIs | Shopify Storefront GraphQL (`/shopify/*`) when env configured; optional for catalog. |

Mount prefix map:

| Prefix | Purpose |
|--------|---------|
| `/auth` | Register, login, logout, profile, daily rewards |
| `/community` | Messages + SSE stream |
| `/chat` | Model streaming endpoints (see below) |
| `/images` | Image generation (e.g. Gemini) |
| `/shopify` | Shopify-backed product listing |
| `/` | DB-backed products router (`GET /products`, `GET /products/:handle`) |

---

## Reality check: repo `schema.sql` vs production code paths

The file `server/src/db/schema.sql` in-repo **does not fully describe** what **`authRouter` / `session.ts` actually query at runtime**.

**Runtime auth/catalog assumptions (from code):**

- `users` with columns such as **`name`**, **`image`**, **`shipping_address1`** (and possibly **`shipping_address2`**).
- `accounts` with **`provider_id`**, **`provider_user_id`**, **`access_token`** (stores **PBKDF2 password hash** for `provider_id = 'password'`—not an OAuth token).
- `sessions` table: session **id equals the Bearer token**; **`expires_at`** enforced in `getAuthUserFromRequest`.
- `user_daily_rewards` for wallet / streak (**`claimed_count`**, **`last_claimed_at`**, **`wallet_balance`**).
- **Catalog:** `products`, `product_variants` for `GET /products`.

**Ask for the backend dev**

1. Make **one canonical migration story**: either align `schema.sql` + `db:migrate` with Neon, or document Neon as source of truth and stop applying the mismatched SQL blindly.
2. Ensure **every environment** used by Expo dev builds points at an API whose DB matches that schema.

---

## Routes the Expo app uses today (`app/src/utils.ts` + screens)

All paths are relative to **`DOMAIN`** (e.g. `http://192.168.1.10:3050`).

### Auth (`/auth`)

| Method | Path | Auth | Body / notes | Response shape (success) |
|--------|------|------|----------------|---------------------------|
| POST | `/auth/register` | No | `{ fullName, email, password, shippingAddress? }` | `{ user, sessionToken }` — `user` matches `User` in `types.ts` (camelCase). |
| POST | `/auth/login` | No | `{ email, password }` | Same as register. |
| POST | `/auth/logout` | Bearer | — | `{ ok: true }` |
| POST | `/auth/profile-picture` | Bearer | `{ imageBase64, mimeType }` → uploaded to Cloudinary; URL stored on user | `{ user }` |
| PATCH | `/auth/profile-details` | Bearer | **`{ shippingAddress, paymentMethod }`** sent from app — see **gap** below | `{ user }` |

**Known gap:** Server currently **updates shipping only** (`shipping_address1`). **`paymentMethod` is ignored** and responses always **`paymentMethod: null`**.  
**Schema + route ask:** Add a durable column (e.g. on `users` or a profile extension table) and persist **`paymentMethod`** from PATCH body; return it on user objects everywhere (`login`, `register`, `profile-details`, `profile-picture`, auth middleware user snapshot).

### Daily rewards (`/auth`)

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/auth/daily-rewards` | Bearer | **`DailyRewardStatus`** (`types.ts`): `walletBalance`, `claimedCount`, `currentStreakDays`, `canClaim`, `nextUnlockAt`, `rewards[]` |
| POST | `/auth/daily-rewards/claim` | Bearer | Same shape; **409** may still return rewards payload (app handles and caches). |

Server logic reads/writes **`user_daily_rewards`** and implements rolling 24h claim windows + wallet increments.

### Community (`/community`)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|------|
| GET | `/community/messages` | Bearer | — | `{ messages: CommunityMessage[] }` |
| POST | `/community/messages` | Bearer | `{ body?, imageBase64?, mimeType? }` | Images → Cloudinary; row in **`community_messages`** |
| PATCH | `/community/messages/:messageId` | Bearer | `{ body }` | Owner-only |
| DELETE | `/community/messages/:messageId` | Bearer | — | Owner-only |
| GET | `/community/stream` | Bearer | — | **SSE**: `history`, `message`, `message_updated`, `message_deleted`, `heartbeat` |

### Catalog — database (`/` product router)

Used by Home / Search / Chat product references:

| Method | Path | Auth | Query | Response |
|--------|------|------|-------|----------|
| GET | `/products` | No* | `first` (1–50), `q` optional (search) | `{ products: ShopifyProduct[] }` — camelCase fields, money `{ amount, currencyCode }` |
| GET | `/products/:handle` | No | — | `{ product }` |

\*Public read; fine for Expo as long as API is reachable.

**Data dependency:** Rows in **`products`** + **`product_variants`**. Ingestion/sync is **out of band** (senior pipeline / ETL); the app does not write products.

### Catalog — Shopify proxy (`/shopify`)

Optional; used if you call `listShopifyProducts` / `getShopifyProductByHandle` in `utils.ts`:

| GET | `/shopify/products?first=&query=` | `{ products }` |
| GET | `/shopify/products/:handle` | `{ product }` |

Requires **`SHOPIFY_STORE_DOMAIN`**, **`SHOPIFY_STOREFRONT_PUBLIC_TOKEN`**, optional API version env.

### Chat / AI streaming (`/chat`)

**Implemented on server today** (see `server/src/chat/chatRouter.ts`):

- `POST /chat/claude`
- `POST /chat/gpt`
- `POST /chat/gemini`

**Expo `utils.getEventSource`** posts to **`/chat/${type}`** where `type` is **`gpt` | `gemini` | `claude`** (from `getChatType`) — matches these.

**Expo `Assistant` screen** (`assistant.tsx`) also calls **thread-style** routes:

- `POST /chat/create-assistant`
- `POST /chat/run-status`
- `GET /chat/get-thread-messages`
- `POST /chat/add-message-to-thread`

These are **not** registered on the current `chatRouter` excerpt—treat as **future routes** or remove/repoint the client. Track here when implemented or when the Assistant UI is retired.

### Images (`/images`)

| POST | `/images/gemini` | multipart `file` | Used from `images.tsx` |

---

## JSON shapes the app relies on (`types.ts`)

- **`User`**: `id`, `fullName`, `email`, `createdAt`, optional `profilePicture`, `shippingAddress`, `paymentMethod`.
- **`CommunityMessage`**: `id`, `body`, `imageUrl`, `createdAt`, nested `user` with `profilePicture`.
- **`DailyRewardStatus`**: as listed above.
- **`ShopifyProduct`**: `id`, `handle`, `title`, `descriptionHtml`, `vendor`, `productType`, `featuredImageUrl`, `price` / `compareAtPrice` money objects.

Errors: app expects `{ error: string }` on non-OK responses for user-visible messages.

---

## Checklist to hand to backend dev

- [ ] **Single schema truth:** Reconcile repo migrations with Neon (`users`, `accounts`, `sessions`, `user_daily_rewards`, `community_messages`, `products`, `product_variants`).
- [ ] **`payment_method`:** Column + PATCH `/auth/profile-details` read/write + all user payloads.
- [ ] **Products pipeline:** Confirm ingestion populates `products` / `product_variants` for Expo `GET /products`.
- [ ] **Assistant thread API:** Implement routes listed above **or** strip/replace calls in `assistant.tsx`.
- [ ] **CORS / HTTPS:** Production Expo builds need allowed origins if you tighten CORS beyond `*`.
- [ ] **Secrets:** Document required env vars (`DATABASE_URL`, Cloudinary, Shopify optional, AI keys for `/chat` and `/images`).

---

## Updating this doc

When routes or payloads change, update the tables here and bump the note at the bottom.

_Last updated: aligned with `server/src` + `app/src/utils.ts` + `types.ts`._
