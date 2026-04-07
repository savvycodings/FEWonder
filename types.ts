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
  shippingAddress?: string | null
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
  }
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