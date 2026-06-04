/** Walk parent navigators until `screenName` exists, then navigate (avoids nested-stack misses). */
export function navigateOnRootStack(
  navigation: { navigate: (name: string, params?: object) => void; getParent?: () => unknown },
  screenName: string,
  params?: object,
) {
  let nav: typeof navigation | undefined = navigation
  for (let depth = 0; depth < 6 && nav; depth++) {
    const routeNames = (nav as { getState?: () => { routeNames?: string[] } }).getState?.()?.routeNames
    if (Array.isArray(routeNames) && routeNames.includes(screenName)) {
      nav.navigate(screenName, params)
      return
    }
    nav = nav.getParent?.() as typeof navigation | undefined
  }
  navigation.navigate(screenName, params)
}
