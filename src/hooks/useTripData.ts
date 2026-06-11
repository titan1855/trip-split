import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchExpenses, fetchMembers, fetchTrip, type ExpenseWithSplits } from '../lib/api'
import { updateIdentityTripName } from '../lib/storage'
import type { Member, Trip } from '../lib/database.types'

export interface TripData {
  trip: Trip | null
  members: Member[]
  expenses: ExpenseWithSplits[]
  loading: boolean
  error: string | null
  reloadMembers: () => Promise<void>
  reloadExpenses: () => Promise<void>
}

/**
 * 載入行程資料並訂閱 Realtime。
 * expense_splits 沒有 trip_id 欄位無法按行程過濾訂閱,但本 app 對 splits 的每次寫入
 * 都伴隨一筆 expenses 寫入(新增/更新/刪除),訂閱 expenses 事件即可涵蓋。
 */
export function useTripData(tripId: string): TripData {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadMembers = useCallback(async () => {
    try {
      setMembers(await fetchMembers(tripId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取資料失敗')
    }
  }, [tripId])

  const reloadExpenses = useCallback(async () => {
    try {
      setExpenses(await fetchExpenses(tripId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取資料失敗')
    }
  }, [tripId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([fetchTrip(tripId), fetchMembers(tripId), fetchExpenses(tripId)])
      .then(([t, m, e]) => {
        if (cancelled) return
        setTrip(t)
        setMembers(m)
        setExpenses(e)
        if (t) updateIdentityTripName(t.id, t.name)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '讀取資料失敗')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
        () => void reloadExpenses(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` },
        () => void reloadMembers(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [tripId, reloadMembers, reloadExpenses])

  return { trip, members, expenses, loading, error, reloadMembers, reloadExpenses }
}
