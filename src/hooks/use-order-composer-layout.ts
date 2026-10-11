import { useSyncExternalStore } from 'react'

const query = '(min-width: 1200px)'
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getSnapshot = () => window.matchMedia(query).matches
export function useOrderComposerLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
