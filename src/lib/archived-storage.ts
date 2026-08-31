// Persistent storage and database synchronization helper for tracked archived entity IDs
export function getArchivedIds(storageKey: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !isNaN(n) && n > 0) : []
  } catch {
    return []
  }
}

export function addArchivedId(storageKey: string, id: number): void {
  try {
    if (!id || isNaN(id) || id <= 0) return
    const ids = getArchivedIds(storageKey)
    if (!ids.includes(id)) {
      ids.push(id)
      localStorage.setItem(storageKey, JSON.stringify(ids))
    }
  } catch {
    // Ignore storage issues
  }
}

export function removeArchivedId(storageKey: string, id: number): void {
  try {
    if (!id) return
    const ids = getArchivedIds(storageKey).filter((i) => i !== id)
    localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    // Ignore
  }
}
