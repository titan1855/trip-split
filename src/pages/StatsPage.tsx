import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { useTripContext } from './TripLayout'
import { computeStats } from '../lib/stats'
import { formatCents, formatMoney } from '../lib/money'
import { CATEGORIES } from '../lib/constants'
import { sectionTitle } from '../lib/ui'

// 分類固定配色(亮暗模式都好讀)
const CATEGORY_COLORS: Record<string, string> = {
  餐飲: '#f97316',
  交通: '#0ea5e9',
  住宿: '#8b5cf6',
  門票: '#ec4899',
  購物: '#eab308',
  其他: '#78716c',
}

export default function StatsPage() {
  const { trip, members, expenses } = useTripContext()
  const stats = computeStats(expenses, members.map((m) => m.id))

  const memberName = (id: string) => members.find((m) => m.id === id)?.nickname ?? '?'
  const categoryEmoji = (c: string) => CATEGORIES.find((x) => x.value === c)?.emoji ?? '📦'

  if (stats.totalCents === 0) {
    return (
      <main className="mt-24 px-4 text-center text-teal-700 dark:text-teal-300">
        <p className="text-4xl">📊</p>
        <p className="mt-3 font-medium">還沒有支出可以統計</p>
        <p className="mt-1 text-sm text-teal-500">記幾筆帳再來看吧</p>
      </main>
    )
  }

  const pieData = stats.byCategory.map((c) => ({
    name: c.category,
    value: c.cents / 100,
  }))
  const barData = stats.byMember
    .filter((m) => m.cents > 0)
    .map((m) => ({ name: memberName(m.memberId), value: m.cents / 100 }))

  return (
    <main className="px-4 pb-8 pt-4">
      <section className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-5 text-center shadow-md">
        <p className="text-sm text-teal-100">這趟總共花了</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-white">
          {formatMoney(stats.totalCents, trip.base_currency)}
        </p>
        <p className="mt-1 text-xs text-teal-200">不含還款記錄,外幣已換算成 {trip.base_currency}</p>
      </section>

      <section className="mt-6">
        <h2 className={sectionTitle}>花在哪些地方</h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-stone-900">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={CATEGORY_COLORS[d.name] ?? '#78716c'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {stats.byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 flex-none rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[c.category] ?? '#78716c' }}
                />
                <span className="flex-1 text-stone-700 dark:text-stone-300">
                  {categoryEmoji(c.category)} {c.category}
                </span>
                <span className="tabular-nums text-stone-900 dark:text-stone-100">
                  {formatCents(c.cents)}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-stone-400">
                  {((c.cents / stats.totalCents) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className={sectionTitle}>每人分攤多少</h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-stone-900">
          <div style={{ height: Math.max(barData.length * 44, 88) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 48 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={64}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', fontSize: 13 }}
                />
                <Bar
                  dataKey="value"
                  fill="#0d9488"
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    fill: 'currentColor',
                    fontSize: 12,
                    formatter: (v) => Number(v).toLocaleString('zh-TW'),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-stone-400 dark:text-stone-500">
            依分攤金額計,單位:{trip.base_currency}
          </p>
        </div>
      </section>
    </main>
  )
}
