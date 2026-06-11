import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchExpenses, fetchMembers, fetchTrip, type ExpenseDetail } from '../lib/api'
import { updateIdentityTripName } from '../lib/storage'
import type { Member, Trip } from '../lib/database.types'

export interface TripData {
  trip: Trip | null
  members: Member[]
  expenses: ExpenseDetail[]
  loading: boolean
  error: string | null
  reloadMembers: () => Promise<void>
  reloadExpenses: () => Promise<void>
}

/**
 * 載入行程資料並訂閱 Realtime。
 * expense_splits / expense_payers 沒有 trip_id 欄位無法按行程過濾訂閱,但本 app 對它們的
 * 每次寫入都伴隨一筆 expenses 寫入(新增/更新/刪除),訂閱 expenses 事件即可涵蓋。
 */
export function useTripData(tripId: string): TripData {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<ExpenseDetail[]>([])
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
      // DELETE 事件的舊資料列只帶主鍵,trip_id 過濾條件比對不到,上面的訂閱收不到刪除;
      // 改用不過濾的 DELETE 訂閱補洞(別的行程刪帳只是多一次重抓,查詢仍以 trip_id 過濾)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expenses' },
        () => void reloadExpenses(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` },
        () => void reloadMembers(),
      )
      .subscribe()

    // 手機鎖屏/切到背景時 WebSocket 可能斷線,回前景時主動重抓一次
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void reloadExpenses()
        void reloadMembers()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [tripId, reloadMembers, reloadExpenses])

  return { trip, members, expenses, loading, error, reloadMembers, reloadExpenses }
}
