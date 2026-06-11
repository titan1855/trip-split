// localStorage 身分記憶:記住「我在每個行程裡是哪個成員」(SPEC 3.1)

export interface TripIdentity {
  tripId: string
  memberId: string
  tripName: string
  joinedAt: string
}

const KEY = 'trip-split.identities'

export function getIdentities(): TripIdentity[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getIdentity(tripId: string): TripIdentity | undefined {
  return getIdentities().find((i) => i.tripId === tripId)
}

export function saveIdentity(identity: TripIdentity): void {
  const rest = getIdentities().filter((i) => i.tripId !== identity.tripId)
  localStorage.setItem(KEY, JSON.stringify([identity, ...rest]))
}

export function removeIdentity(tripId: string): void {
  localStorage.setItem(KEY, JSON.stringify(getIdentities().filter((i) => i.tripId !== tripId)))
}

/** 行程名稱變更時同步列表顯示用 */
export function updateIdentityTripName(tripId: string, tripName: string): void {
  const identity = getIdentity(tripId)
  if (identity && identity.tripName !== tripName) {
    saveIdentity({ ...identity, tripName })
  }
}
