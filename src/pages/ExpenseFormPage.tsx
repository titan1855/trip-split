import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTripContext } from './TripLayout'
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type PayerInput,
  type SplitInput,
} from '../lib/api'
import { formatCents, parseAmountToCents, parseCentsAllowZero, splitEvenly } from '../lib/money'
import { todayStr } from '../lib/date'
import { CATEGORIES } from '../lib/constants'
import { inputCls, labelCls, btnPrimary, errorBox, chipCls } from '../lib/ui'

type SplitMode = 'even' | 'custom'

/** 分 → 不帶千分位的輸入框字串 */
function centsToInput(cents: number): string {
  return formatCents(cents).replace(/,/g, '')
}

export default function ExpenseFormPage() {
  const { trip, members, expenses, fxRates, myMemberId, reloadExpenses } = useTripContext()
  const { expenseId } = useParams()
  const navigate = useNavigate()

  const editing = expenseId ? expenses.find((e) => e.id === expenseId) : undefined
  const isEdit = Boolean(expenseId)

  const [title, setTitle] = useState(editing?.title ?? '')
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount_cents) : '')
  // 幣別與匯率快照:記帳當下把行程匯率寫進 fx_rate,之後改行程匯率不影響這筆帳
  const [currency, setCurrency] = useState(editing?.currency ?? trip.base_currency)
  const [fxRate, setFxRate] = useState(editing?.fx_rate ?? 1)
  const [category, setCategory] = useState(editing?.category ?? '餐飲')
  const [spentAt, setSpentAt] = useState(editing?.spent_at ?? todayStr())
  const [note, setNote] = useState(editing?.note ?? '')

  // 付款人(可多人,各自輸入金額)
  const [payers, setPayers] = useState<string[]>(() => {
    if (!editing) return [myMemberId]
    if (editing.expense_payers.length > 0) return editing.expense_payers.map((p) => p.member_id)
    return editing.payer_id ? [editing.payer_id] : [myMemberId]
  })
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const p of editing?.expense_payers ?? []) map[p.member_id] = centsToInput(p.paid_cents)
    return map
  })

  // 分攤對象與方式
  const [participants, setParticipants] = useState<string[]>(
    editing ? editing.expense_splits.map((s) => s.member_id) : members.map((m) => m.id),
  )
  const [splitMode, setSplitMode] = useState<SplitMode>(() => {
    if (!editing) return 'even'
    const even = splitEvenly(editing.amount_cents, editing.expense_splits.length)
    const actual = [...editing.expense_splits.map((s) => s.share_cents)].sort((a, b) => b - a)
    return JSON.stringify(even) === JSON.stringify(actual) ? 'even' : 'custom'
  })
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const s of editing?.expense_splits ?? []) map[s.member_id] = centsToInput(s.share_cents)
    return map
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編輯模式但資料還沒同步到(例如別人剛刪掉這筆)
  if (isEdit && !editing) {
    return (
      <main className="px-4 pt-8 text-center text-stone-500 dark:text-stone-400">
        找不到這筆帳,可能已被旅伴刪除
      </main>
    )
  }

  const totalCents = parseAmountToCents(amount)

  // 即時計算「尚未分配」:沒填的視為 0
  function remainingOf(ids: string[], amounts: Record<string, string>): number | null {
    if (totalCents === null) return null
    let sum = 0
    for (const id of ids) {
      const cents = parseCentsAllowZero(amounts[id] ?? '')
      if (cents === null) return null
      sum += cents
    }
    return totalCents - sum
  }
  const payerRemaining = payers.length > 1 ? remainingOf(payers, payerAmounts) : null
  const splitRemaining = splitMode === 'custom' ? remainingOf(participants, customAmounts) : null

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function buildPayers(): PayerInput[] | string {
    if (totalCents === null) return '請輸入正確的金額'
    if (payers.length === 0) return '至少要選一個付款人'
    if (payers.length === 1) return [{ member_id: payers[0], paid_cents: totalCents }]
    const rows: PayerInput[] = []
    for (const id of payers) {
      const cents = parseCentsAllowZero(payerAmounts[id] ?? '')
      if (cents === null) return '付款金額格式不對,請檢查一下'
      if (cents > 0) rows.push({ member_id: id, paid_cents: cents })
    }
    const sum = rows.reduce((a, p) => a + p.paid_cents, 0)
    if (sum !== totalCents) {
      return `付款加總(${formatCents(sum)})跟總金額(${formatCents(totalCents)})對不起來`
    }
    return rows
  }

  function buildSplits(): SplitInput[] | string {
    if (totalCents === null) return '請輸入正確的金額'
    if (participants.length === 0) return '至少要選一個人分攤'
    if (splitMode === 'even') {
      const shares = splitEvenly(totalCents, participants.length)
      return participants.map((member_id, i) => ({ member_id, share_cents: shares[i] }))
    }
    const rows: SplitInput[] = []
    for (const id of participants) {
      const cents = parseCentsAllowZero(customAmounts[id] ?? '')
      if (cents === null) return '分攤金額格式不對,請檢查一下'
      if (cents > 0) rows.push({ member_id: id, share_cents: cents })
    }
    if (rows.length === 0) return '至少要有一個人分攤金額大於 0'
    const sum = rows.reduce((a, s) => a + s.share_cents, 0)
    if (sum !== totalCents) {
      return `還有 ${formatCents(totalCents - sum)} 沒分配完,加總要等於總金額`
    }
    return rows
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payerRows = buildPayers()
    if (typeof payerRows === 'string') {
      setError(payerRows)
      return
    }
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
      currency,
      fx_rate: currency === trip.base_currency ? 1 : fxRate,
      category,
      spent_at: spentAt,
      note: note.trim() || null,
    }
    try {
      if (isEdit) {
        await updateExpense(expenseId!, payload, payerRows, splits)
      } else {
        await createExpense({ ...payload, trip_id: trip.id, kind: 'expense' }, payerRows, splits)
      }
      await reloadExpenses()
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
      await reloadExpenses()
      navigate(`/trip/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗,請再試一次')
      setBusy(false)
    }
  }

  function RemainingLine({ remaining }: { remaining: number | null }) {
    if (remaining === null) return null
    if (remaining === 0) {
      return (
        <p className="mt-2 text-sm font-medium text-teal-600 dark:text-teal-400">✓ 分配完成</p>
      )
    }
    return (
      <p className="mt-2 text-sm font-medium text-orange-600 dark:text-orange-400">
        {remaining > 0
          ? `尚未分配:${formatCents(remaining)} ${currency}`
          : `超出總金額:${formatCents(-remaining)} ${currency}`}
      </p>
    )
  }

  return (
    <main className="px-4 pb-8 pt-4">
      <h2 className="mb-4 text-xl font-bold text-teal-800 dark:text-teal-300">
        {isEdit ? '改這筆帳' : '記一筆'}
      </h2>

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
            金額
          </label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
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
            <select
              className={`${inputCls} !w-24 flex-none`}
              value={currency}
              onChange={(e) => {
                const c = e.target.value
                setCurrency(c)
                setFxRate(
                  c === trip.base_currency
                    ? 1
                    : (fxRates.find((r) => r.currency === c)?.rate ?? fxRate),
                )
              }}
              aria-label="幣別"
            >
              {[...new Set([trip.base_currency, ...fxRates.map((r) => r.currency), ...(editing ? [editing.currency] : [])])].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </div>
          {currency !== trip.base_currency && (
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              匯率快照 1 {currency} = {fxRate} {trip.base_currency}
              {totalCents !== null &&
                `,約 ${formatCents(Math.round(totalCents * fxRate))} ${trip.base_currency}`}
            </p>
          )}
          {fxRates.length === 0 && !editing && (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              要記外幣?先到「設定」加匯率
            </p>
          )}
        </div>

        <div>
          <span className={labelCls}>分類</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={chipCls(category === c.value)}
              >
                {c.emoji} {c.value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>誰付的(可多人)</span>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(payers, setPayers, m.id)}
                className={chipCls(payers.includes(m.id))}
              >
                {m.nickname}
                {m.id === myMemberId ? '(我)' : ''}
              </button>
            ))}
          </div>

          {payers.length > 1 && (
            <div className="mt-2 space-y-2">
              {payers.map((id) => {
                const member = members.find((m) => m.id === id)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="w-20 flex-none truncate text-sm text-stone-700 dark:text-stone-300">
                      {member?.nickname}
                    </span>
                    <input
                      className={`${inputCls} tabular-nums`}
                      value={payerAmounts[id] ?? ''}
                      onChange={(e) =>
                        setPayerAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      placeholder="0"
                      inputMode="decimal"
                      aria-label={`${member?.nickname} 付款金額`}
                    />
                  </div>
                )
              })}
              <RemainingLine remaining={payerRemaining} />
            </div>
          )}
        </div>

        <div>
          <span className={labelCls}>誰要分</span>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(participants, setParticipants, m.id)}
                className={chipCls(participants.includes(m.id))}
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
                  : 'bg-white text-stone-600 shadow-sm dark:bg-stone-800 dark:text-stone-300'
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
                  : 'bg-white text-stone-600 shadow-sm dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              自訂金額
            </button>
          </div>

          {splitMode === 'even' && totalCents !== null && participants.length > 0 && (
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              每人約 {formatCents(splitEvenly(totalCents, participants.length)[participants.length - 1])}{' '}
              {currency},除不盡的零頭由前面的人多攤
            </p>
          )}

          {splitMode === 'custom' && (
            <div className="mt-2 space-y-2">
              {participants.map((id) => {
                const member = members.find((m) => m.id === id)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="w-20 flex-none truncate text-sm text-stone-700 dark:text-stone-300">
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
              <RemainingLine remaining={splitRemaining} />
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
            className={`${inputCls} block appearance-none`}
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
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}

        <div className="space-y-3 pt-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? '儲存中…' : isEdit ? '存檔' : '記下來'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="min-h-12 w-full rounded-xl border border-orange-300 font-semibold text-orange-600 disabled:opacity-50 dark:border-orange-900 dark:text-orange-400"
            >
              刪掉這筆
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
