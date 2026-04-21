import { SetStateAction, Dispatch } from 'react'

export interface IIconProps {
  type: string
  props: any
}

export interface IThemeContext {
  theme: any
  setTheme: Dispatch<SetStateAction<string>>
  themeName: string
}

export interface Model {
  name: string;
  label: string;
  icon: any
}

export interface User {
  id: string
  fullName: string
  email: string
  createdAt: string
  profilePicture?: string | null
  avatarFrameId?: string | null
  shippingAddress?: string | null
  shippingAddressLine2?: string | null
  phone?: string | null
  pudoLockerName?: string | null
  pudoLockerAddress?: string | null
  eftBankAccountName?: string | null
  eftBankName?: string | null
  eftBankAccountNumber?: string | null
  eftBankBranch?: string | null
  paymentMethod?: string | null
}

export interface AuthPayload {
  user: User
  sessionToken: string
}

export interface CommunityMessage {
  id: string
  body: string
  imageUrl?: string | null
  createdAt: string
  user: {
    id: string
    fullName: string
    profilePicture?: string | null
    avatarFrameId?: string | null
  }
}

export interface DailyRewardItem {
  day: number
  amount: number
  status: 'claimed' | 'unlocked' | 'locked'
}

export interface DailyRewardStatus {
  walletBalance: number
  /** Wonder Store items already purchased (server-backed). */
  ownedStoreItemIds: string[]
  claimedCount: number
  currentStreakDays: number
  canClaim: boolean
  nextUnlockAt: string | null
  rewards: DailyRewardItem[]
}

export interface ShopifyMoney {
  amount: string
  currencyCode: string
}

export interface ShopifyProduct {
  id: string
  handle: string
  title: string
  descriptionHtml?: string | null
  vendor?: string | null
  productType?: string | null
  tags?: string[]
  featuredImageUrl?: string | null
  price?: ShopifyMoney | null
  compareAtPrice?: ShopifyMoney | null
}

export interface IAppContext {
  chatType: Model
  setChatType: Dispatch<SetStateAction<Model>>
  handlePresentModalPress: () => void
  setImageModel: Dispatch<SetStateAction<string>>
  imageModel: string,
  closeModal: () => void,
  cartItems: any[],
  addToCart: (item: any, quantity?: number) => void,
  updateCartItemQuantity: (title: string, quantity: number) => void,
  removeFromCart: (title: string) => void,
  clearCart: () => void,
  savedItems: any[],
  toggleSavedItem: (item: any) => void,
  removeSavedItem: (title: string) => void,
}