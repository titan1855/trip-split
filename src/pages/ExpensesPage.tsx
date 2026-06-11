import { Link } from 'react-router-dom'
import { useTripContext } from './TripLayout'
import { formatDateLabel } from '../lib/date'
import { formatMoney } from '../lib/money'
import { CATEGORIES } from '../lib/constants'
import type { ExpenseDetail } from '../lib/api'

function categoryEmoji(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.emoji ?? '📦'
}

export default function ExpensesPage() {
  const { trip, members, expenses } = useTripContext()

  const memberName = (id: string) => members.find((m) => m.id === id)?.nickname ?? '?'

  // 付款人顯示:單人直接給名字,多人顯示「某某 等 n 人」
  function payersLabel(expense: ExpenseDetail): string {
    const payers = expense.expense_payers
    if (payers.length === 0) {
      // 遷移前的舊資料還沒有 expense_payers 列時退回 payer_id
      return expense.payer_id ? memberName(expense.payer_id) : '?'
    }
    const first = memberName(payers[0].member_id)
    return payers.length === 1 ? first : `${first} 等 ${payers.length} 人`
  }

  // 依日期分組(fetch 已按 spent_at 新到舊排序)
  const groups: { date: string; items: ExpenseDetail[] }[] = []
  for (const expense of expenses) {
    const last = groups[groups.length - 1]
    if (last && last.date === expense.spent_at) {
      last.items.push(expense)
    } else {
      groups.push({ date: expense.spent_at, items: [expense] })
    }
  }

  return (
    <main className="px-4 pt-4">
      {expenses.length === 0 && (
        <div className="mt-24 text-center text-teal-700 dark:text-teal-300">
          <p className="text-4xl">🧾</p>
          <p className="mt-3 font-medium">還沒有帳</p>
          <p className="mt-1 text-sm text-teal-500 dark:text-teal-500">點下面的「記一筆」開始吧</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.date}>
            <h2 className="mb-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
              {formatDateLabel(group.date)}
            </h2>
            <ul className="space-y-2">
              {group.items.map((expense) => (
                <li key={expense.id}>
                  <Link
                    to={`edit/${expense.id}`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm active:bg-teal-100 dark:bg-stone-900 dark:active:bg-stone-800"
                  >
                    <span className="text-2xl">
                      {expense.kind === 'settlement' ? '🤝' : categoryEmoji(expense.category)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                        {expense.title}
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        {expense.kind === 'settlement'
                          ? '還款記錄'
                          : `${payersLabel(expense)} 付的 · ${expense.expense_splits.length} 人分`}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                      {formatMoney(expense.amount_cents, expense.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Link
        to="new"
        className="fixed bottom-20 left-1/2 z-10 flex min-h-13 -translate-x-1/2 items-center rounded-full bg-teal-600 px-8 py-3 text-lg font-bold text-white shadow-lg active:bg-teal-700"
      >
        ✏️ 記一筆
      </Link>

      <p className="sr-only">行程主幣別:{trip.base_currency}</p>
    </main>
  )
}
