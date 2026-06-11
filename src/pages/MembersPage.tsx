import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTripContext } from './TripLayout'
import { deleteFxRate, deleteTrip, upsertFxRate } from '../lib/api'
import { removeIdentity } from '../lib/storage'
import { CURRENCIES } from '../lib/constants'
import { btnPrimary, errorBox, inputCls, sectionTitle } from '../lib/ui'

/** 匯率輸入驗證:正數,最多 6 位小數 */
function parseRate(input: string): number | null {
  const t = input.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null
  const rate = Number(t)
  return rate > 0 ? rate : null
}

export default function MembersPage() {
  const { trip, members, myMemberId } = useTripContext()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDeleteTrip() {
    const ok = window.confirm(
      `確定要刪除「${trip.name}」嗎?\n\n所有帳目和成員都會一起刪掉,每個旅伴都看不到,而且無法復原!`,
    )
    if (!ok) return
    setDeleting(true)
    setError(null)
    try {
      await deleteTrip(trip.id)
      removeIdentity(trip.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除行程失敗,請再試一次')
      setDeleting(false)
    }
  }

  const shareText = `來加入「${trip.name}」一起記帳!邀請碼:${trip.invite_code}\n${location.origin}${import.meta.env.BASE_URL}#/trip/${trip.id}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: shareText })
        return
      } catch {
        // 使用者取消分享面板時不做事
        return
      }
    }
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="px-4 pt-4">
      <section className="rounded-2xl bg-white p-5 text-center shadow-sm dark:bg-stone-900">
        <p className="text-sm text-stone-500 dark:text-stone-400">把邀請碼丟給旅伴</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-teal-700 dark:text-teal-300">
          {trip.invite_code}
        </p>
        <button type="button" onClick={handleShare} className={`mt-4 ${btnPrimary}`}>
          {copied ? '複製好了!' : '分享邀請碼'}
        </button>
      </section>

      <section className="mt-6">
        <h2 className={sectionTitle}>
          成員({members.length} 人)
        </h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm dark:bg-stone-900"
            >
              <span className="font-medium text-stone-900 dark:text-stone-100">{m.nickname}</span>
              {m.id === myMemberId && (
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                  我
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white px-5 py-4 shadow-sm dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500 dark:text-stone-400">主幣別</span>
          <span className="font-semibold text-stone-900 dark:text-stone-100">
            {trip.base_currency}
          </span>
        </div>
      </section>

      <FxRateSection />


      <section className="mb-6 mt-10">
        <button
          type="button"
          onClick={handleDeleteTrip}
          disabled={deleting}
          className="min-h-12 w-full rounded-xl border border-red-300 font-semibold text-red-600 active:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:active:bg-red-950"
        >
          {deleting ? '刪除中…' : '刪除整個行程'}
        </button>
        <p className="mt-2 text-center text-xs text-stone-400 dark:text-stone-500">
          會刪掉所有帳目與成員,大家都看不到,無法復原
        </p>
        {error && (
          <p role="alert" className={`mt-2 ${errorBox}`}>
            {error}
          </p>
        )}
      </section>
    </main>
  )
}

/** 匯率設定:支出可用外幣記,結算自動換回主幣別;這裡的匯率是「新增支出時的預設值」 */
function FxRateSection() {
  const { trip, fxRates, reloadFxRates } = useTripContext()
  const [newCurrency, setNewCurrency] = useState('')
  const [newRate, setNewRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = CURRENCIES.filter(
    (c) => c !== trip.base_currency && !fxRates.some((r) => r.currency === c),
  )

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const rate = parseRate(newRate)
    if (!newCurrency) {
      setError('先選一個幣別')
      return
    }
    if (rate === null) {
      setError('匯率要是正數,例如 0.21')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await upsertFxRate(trip.id, newCurrency, rate)
      await reloadFxRates()
      setNewCurrency('')
      setNewRate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存匯率失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6">
      <h2 className={sectionTitle}>匯率(記外幣用)</h2>
      <p className="mb-2 text-xs text-stone-400 dark:text-stone-500">
        設定後記帳可選外幣,結算自動換回 {trip.base_currency};改匯率不影響已記的帳
      </p>

      <ul className="space-y-2">
        {fxRates.map((r) => (
          <FxRateRow
            key={`${r.currency}-${r.rate}`}
            currency={r.currency}
            rate={r.rate}
            base={trip.base_currency}
            onSave={async (rate) => {
              await upsertFxRate(trip.id, r.currency, rate)
              await reloadFxRates()
            }}
            onDelete={async () => {
              await deleteFxRate(trip.id, r.currency)
              await reloadFxRates()
            }}
          />
        ))}
      </ul>

      {available.length > 0 && (
        <form
          onSubmit={handleAdd}
          className="mt-2 space-y-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-stone-900"
        >
          <select
            className={inputCls}
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
            aria-label="新增幣別"
          >
            <option value="">選幣別</option>
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              className={`${inputCls} tabular-nums`}
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder={`兌 ${trip.base_currency} 匯率`}
              inputMode="decimal"
              aria-label="匯率"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 flex-none rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white active:bg-teal-700 disabled:opacity-50"
            >
              加入
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className={`mt-2 ${errorBox}`}>
          {error}
        </p>
      )}
    </section>
  )
}

function FxRateRow({
  currency,
  rate,
  base,
  onSave,
  onDelete,
}: {
  currency: string
  rate: number
  base: string
  onSave: (rate: number) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [value, setValue] = useState(String(rate))
  const [busy, setBusy] = useState(false)
  const changed = value.trim() !== String(rate)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch {
      // 失敗時還原輸入,錯誤訊息由上層 Realtime 重抓後狀態自然回復
      setValue(String(rate))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-stone-900">
      <span className="w-16 flex-none text-sm font-semibold text-stone-700 dark:text-stone-300">
        1 {currency}
      </span>
      <span className="flex-none text-sm text-stone-400">=</span>
      <input
        className={`${inputCls} tabular-nums`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        aria-label={`${currency} 匯率`}
      />
      <span className="flex-none text-sm text-stone-400">{base}</span>
      {changed ? (
        <button
          type="button"
          disabled={busy || parseRate(value) === null}
          onClick={() => {
            const parsed = parseRate(value)
            if (parsed !== null) void run(() => onSave(parsed))
          }}
          className="min-h-11 flex-none rounded-xl bg-teal-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          存
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`確定要移除 ${currency} 的匯率?已記的帳不受影響`)) {
              void run(onDelete)
            }
          }}
          className="min-h-11 flex-none rounded-xl px-3 text-sm font-semibold text-stone-400 active:text-red-500"
          aria-label={`刪除 ${currency} 匯率`}
        >
          ✕
        </button>
      )}
    </li>
  )
}
