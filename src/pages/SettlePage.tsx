import { useState } from 'react'
import { useTripContext } from './TripLayout'
import { computeNets, minTransfers } from '../lib/settle'
import { createSettlement } from '../lib/api'
import { formatMoney } from '../lib/money'
import { errorBox, sectionTitle } from '../lib/ui'

export default function SettlePage() {
  const { trip, members, expenses, myMemberId, reloadExpenses } = useTripContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const memberName = (id: string) => members.find((m) => m.id === id)?.nickname ?? '?'

  const nets = computeNets(expenses, members.map((m) => m.id))
  const transfers = minTransfers(nets)
  const hasExpenses = expenses.length > 0

  async function handleMarkPaid(fromId: string, toId: string, amountCents: number) {
    const from = memberName(fromId)
    const to = memberName(toId)
    const ok = window.confirm(
      `確認「${from}」已經把 ${formatMoney(amountCents, trip.base_currency)} 還給「${to}」?`,
    )
    if (!ok) return
    const key = `${fromId}-${toId}`
    setBusyKey(key)
    setError(null)
    try {
      await createSettlement({
        tripId: trip.id,
        currency: trip.base_currency,
        fromId,
        toId,
        amountCents,
        title: `${from} 還給 ${to}`,
      })
      await reloadExpenses() // 立刻重算,其他裝置由 Realtime 更新
    } catch (err) {
      setError(err instanceof Error ? err.message : '標記還款失敗,請再試一次')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <main className="px-4 pt-4">
      <section>
        <h2 className={sectionTitle}>這樣轉最快結清</h2>

        {!hasExpenses && (
          <div className="mt-16 text-center text-teal-700 dark:text-teal-300">
            <p className="text-4xl">🧮</p>
            <p className="mt-3 font-medium">還沒有帳可以算</p>
            <p className="mt-1 text-sm text-teal-500">先去記幾筆吧</p>
          </div>
        )}

        {hasExpenses && transfers.length === 0 && (
          <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-sm dark:bg-stone-900">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-medium text-teal-700 dark:text-teal-300">
              大家互不相欠,結清了!
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {transfers.map((t) => {
            const key = `${t.fromId}-${t.toId}`
            return (
              <li
                key={key}
                className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 shadow-md"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="max-w-24 truncate font-semibold text-white">
                    {memberName(t.fromId)}
                  </span>
                  <span className="text-2xl text-teal-100">➜</span>
                  <span className="max-w-24 truncate font-semibold text-white">
                    {memberName(t.toId)}
                  </span>
                </div>
                <p className="mt-1 text-center text-2xl font-bold tabular-nums text-white">
                  {formatMoney(t.amountCents, trip.base_currency)}
                </p>
                <button
                  type="button"
                  onClick={() => handleMarkPaid(t.fromId, t.toId, t.amountCents)}
                  disabled={busyKey !== null}
                  className="mt-3 min-h-11 w-full rounded-xl border-2 border-white/70 text-sm font-semibold text-white active:bg-white/10 disabled:opacity-50"
                >
                  {busyKey === key ? '記錄中…' : '標記已還款'}
                </button>
              </li>
            )
          })}
        </ul>

        {error && (
          <p role="alert" className={`mt-3 ${errorBox}`}>
            {error}
          </p>
        )}
      </section>

      {hasExpenses && (
        <section className="mt-8">
          <h2 className={sectionTitle}>每人狀況</h2>
          <ul className="space-y-2">
            {nets.map((n) => (
              <li
                key={n.memberId}
                className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm dark:bg-stone-900"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                    {memberName(n.memberId)}
                    {n.memberId === myMemberId && (
                      <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                        我
                      </span>
                    )}
                  </span>
                  <span className="block text-xs tabular-nums text-stone-500 dark:text-stone-400">
                    付了 {formatMoney(n.paidCents, trip.base_currency)} · 應攤{' '}
                    {formatMoney(n.owedCents, trip.base_currency)}
                  </span>
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    n.netCents > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : n.netCents < 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-stone-400 dark:text-stone-500'
                  }`}
                >
                  {n.netCents > 0 ? '收回 ' : n.netCents < 0 ? '該付 ' : ''}
                  {formatMoney(Math.abs(n.netCents), trip.base_currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-stone-400 dark:text-stone-500">
            金額以主幣別 {trip.base_currency} 計;標記還款後會自動重算
          </p>
        </section>
      )}
    </main>
  )
}
