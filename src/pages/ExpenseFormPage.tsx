import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTripContext } from './TripLayout'
import { createExpense, deleteExpense, updateExpense, type SplitInput } from '../lib/api'
import { formatCents, parseAmountToCents, splitEvenly } from '../lib/money'
import { todayStr } from '../lib/date'
import { CATEGORIES } from '../lib/constants'

type SplitMode = 'even' | 'custom'

export default function ExpenseFormPage() {
  const { trip, members, expenses, myMemberId } = useTripContext()
  const { expenseId } = useParams()
  const navigate = useNavigate()

  const editing = expenseId ? expenses.find((e) => e.id === expenseId) : undefined
  const isEdit = Boolean(expenseId)

  const [title, setTitle] = useState(editing?.title ?? '')
  const [amount, setAmount] = useState(editing ? formatCents(editing.amount_cents).replace(/,/g, '') : '')
  const [payerId, setPayerId] = useState(editing?.payer_id ?? myMemberId)
  const [category, setCategory] = useState(editing?.category ?? '餐飲')
  const [spentAt, setSpentAt] = useState(editing?.spent_at ?? todayStr())
  const [note, setNote] = useState(editing?.note ?? '')
  const [participants, setParticipants] = useState<string[]>(
    editing ? editing.expense_splits.map((s) => s.member_id) : members.map((m) => m.id),
  )
  const initialCustom = useMemo(() => {
    const map: Record<string, string> = {}
    if (editing) {
      for (const s of editing.expense_splits) map[s.member_id] = formatCents(s.share_cents).replace(/,/g, '')
    }
    return map
  }, [editing])
  const [splitMode, setSplitMode] = useState<SplitMode>(() => {
    if (!editing) return 'even'
    const even = splitEvenly(editing.amount_cents, editing.expense_splits.length)
    const actual = [...editing.expense_splits.map((s) => s.share_cents)].sort((a, b) => b - a)
    return JSON.stringify(even) === JSON.stringify(actual) ? 'even' : 'custom'
  })
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(initialCustom)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編輯模式但資料還沒同步到(例如別人剛刪掉這筆)
  if (isEdit && !editing) {
    return (
      <main className="px-4 pt-8 text-center text-stone-500">
        找不到這筆帳,可能已被旅伴刪除
      </main>
    )
  }

  const totalCents = parseAmountToCents(amount)

  const customTotal = participants.reduce((sum, id) => {
    const cents = parseAmountToCents(customAmounts[id] ?? '')
    return cents === null ? NaN : sum + cents
  }, 0)
  const customDiff =
    totalCents !== null && !Number.isNaN(customTotal) ? totalCents - customTotal : null

  function toggleParticipant(id: string) {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  function buildSplits(): SplitInput[] | string {
    if (totalCents === null) return '請輸入正確的金額'
    if (participants.length === 0) return '至少要選一個人分攤'
    if (splitMode === 'even') {
      const shares = splitEvenly(totalCents, participants.length)
      return participants.map((member_id, i) => ({ member_id, share_cents: shares[i] }))
    }
    const splits: SplitInput[] = []
    for (const id of participants) {
      const cents = parseAmountToCents(customAmounts[id] ?? '')
      if (cents === null) return '每個人的分攤金額都要填'
      splits.push({ member_id: id, share_cents: cents })
    }
    const sum = splits.reduce((a, s) => a + s.share_cents, 0)
    if (sum !== totalCents) {
      return `分攤加總(${formatCents(sum)})跟總金額(${formatCents(totalCents)})對不起來`
    }
    return splits
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const splits = buildSplits()
    if (typeof splits === 'string') {
      setError(splits)
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      title: title.trim(),
      amount_cents: totalCents!,
      currency: trip.base_currency, // 多幣別在 Phase 5 開放
      fx_rate: 1,
      payer_id: payerId,
      category,
      spent_at: spentAt,
      note: note.trim() || null,
    }
    try {
      if (isEdit) {
        await updateExpense(expenseId!, payload, splits)
      } else {
        await createExpense({ ...payload, trip_id: trip.id, kind: 'expense' }, splits)
      }
      navigate(`/trip/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗,請再試一次')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('確定要刪掉這筆帳嗎?')) return
    setBusy(true)
    try {
      await deleteExpense(expenseId!)
      navigate(`/trip/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗,請再試一次')
      setBusy(false)
    }
  }

  const inputCls =
    'w-full min-h-11 rounded-xl border border-teal-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none'
  const labelCls = 'mb-1 block text-sm font-medium text-teal-900'

  return (
    <main className="px-4 pb-8 pt-4">
      <h2 className="mb-4 text-xl font-bold text-teal-800">{isEdit ? '改這筆帳' : '記一筆'}</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="exp-title" className={labelCls}>
            買了什麼
          </label>
          <input
            id="exp-title"
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如:燒肉晚餐"
            required
            maxLength={40}
          />
        </div>

        <div>
          <label htmlFor="exp-amount" className={labelCls}>
            金額({trip.base_currency})
          </label>
          <input
            id="exp-amount"
            className={`${inputCls} text-lg tabular-nums`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            required
          />
        </div>

        <div>
          <span className={labelCls}>分類</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`min-h-11 rounded-full px-4 text-sm ${
                  category === c.value
                    ? 'bg-teal-600 font-semibold text-white'
                    : 'bg-white text-stone-600 shadow-sm'
                }`}
              >
                {c.emoji} {c.value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="exp-payer" className={labelCls}>
            誰付的
          </label>
          <select
            id="exp-payer"
            className={inputCls}
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
                {m.id === myMemberId ? '(我)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelCls}>誰要分</span>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleParticipant(m.id)}
                className={`min-h-11 rounded-full px-4 text-sm ${
                  participants.includes(m.id)
                    ? 'bg-teal-600 font-semibold text-white'
                    : 'bg-white text-stone-600 shadow-sm'
                }`}
              >
                {m.nickname}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>怎麼分</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSplitMode('even')}
              className={`min-h-11 rounded-xl text-sm ${
                splitMode === 'even'
                  ? 'bg-teal-600 font-semibold text-white'
                  : 'bg-white text-stone-600 shadow-sm'
              }`}
            >
              平分
            </button>
            <button
              type="button"
              onClick={() => setSplitMode('custom')}
              className={`min-h-11 rounded-xl text-sm ${
                splitMode === 'custom'
                  ? 'bg-teal-600 font-semibold text-white'
                  : 'bg-white text-stone-600 shadow-sm'
              }`}
            >
              自訂金額
            </button>
          </div>

          {splitMode === 'even' && totalCents !== null && participants.length > 0 && (
            <p className="mt-2 text-sm text-stone-500">
              每人約 {formatCents(splitEvenly(totalCents, participants.length)[participants.length - 1])}{' '}
              {trip.base_currency},除不盡的零頭由前面的人多攤
            </p>
          )}

          {splitMode === 'custom' && (
            <div className="mt-2 space-y-2">
              {participants.map((id) => {
                const member = members.find((m) => m.id === id)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="w-20 flex-none truncate text-sm text-stone-700">
                      {member?.nickname}
                    </span>
                    <input
                      className={`${inputCls} tabular-nums`}
                      value={customAmounts[id] ?? ''}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      placeholder="0"
                      inputMode="decimal"
                      aria-label={`${member?.nickname} 分攤金額`}
                    />
                  </div>
                )
              })}
              {customDiff !== null && customDiff !== 0 && (
                <p className="text-sm text-orange-600">
                  {customDiff > 0
                    ? `還差 ${formatCents(customDiff)} 沒分完`
                    : `多分了 ${formatCents(-customDiff)}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="exp-date" className={labelCls}>
            日期
          </label>
          <input
            id="exp-date"
            type="date"
            className={inputCls}
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="exp-note" className={labelCls}>
            備註(可不填)
          </label>
          <input
            id="exp-note"
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {error}
          </p>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-teal-600 font-semibold text-white disabled:opacity-50"
          >
            {busy ? '儲存中…' : isEdit ? '存檔' : '記下來'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="min-h-12 w-full rounded-xl border border-orange-300 font-semibold text-orange-600 disabled:opacity-50"
            >
              刪掉這筆
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
