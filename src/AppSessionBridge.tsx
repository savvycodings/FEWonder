import { useContext, useEffect } from 'react'
import { AppContext } from './context'

/** Syncs auth session into AppContext and reloads account-backed cart and saved products. */
export function AppSessionBridge({ sessionToken }: { sessionToken: string }) {
  const { setSessionToken, refreshSavedItems, refreshCart } = useContext(AppContext)

  useEffect(() => {
    setSessionToken(sessionToken)
    void refreshSavedItems(sessionToken)
    void refreshCart(sessionToken)
  }, [sessionToken, setSessionToken, refreshSavedItems, refreshCart])

  return null
}
