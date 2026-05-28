import { useContext, useEffect } from 'react'
import { AppContext } from './context'

/** Syncs auth session into AppContext and reloads account-backed saved products. */
export function AppSessionBridge({ sessionToken }: { sessionToken: string }) {
  const { setSessionToken, refreshSavedItems } = useContext(AppContext)

  useEffect(() => {
    setSessionToken(sessionToken)
    void refreshSavedItems(sessionToken)
  }, [sessionToken, setSessionToken, refreshSavedItems])

  return null
}
