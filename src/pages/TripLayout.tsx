import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { useTripData } from '../hooks/useTripData'
import { addMember, type ExpenseDetail } from '../lib/api'
import { getIdentity, saveIdentity } from '../lib/storage'
import type { Member, Trip } from '../lib/database.types'
import { inputCls, btnPrimary, errorBox } from '../lib/ui'

export interface TripContext {
  trip: Trip
  members: Member[]
  expenses: ExpenseDetail[]
  myMemberId: string
  /** 寫入後主動重抓,不等 Realtime(自己的操作要立刻看到) */
  reloadExpenses: () => Promise<void>
}

export function useTripContext(): TripContext {
  return useOutletContext<TripContext>()
}

const TABS = [
  { to: '', label: '支出', icon: '📒', end: true },
  { to: 'settle', label: '結算', icon: '🤝', end: false },
  { to: 'members', label: '設定', icon: '⚙️', end: false },
] as const

export default function TripLayout() {
  const { id = '' } = useParams()
  const { trip, members, expenses, loading, error, reloadExpenses } = useTripData(id)
  const [identity, setIdentity] = useState(() => getIdentity(id))

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-teal-50 text-teal-600 dark:bg-stone-950 dark:text-teal-400">
        讀取中…
      </main>
    )
  }

  if (error || !trip) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-teal-50 p-6 text-center dark:bg-stone-950">
        <p className="text-teal-900 dark:text-teal-100">{error ?? '找不到這個行程,連結可能有誤'}</p>
        <Link to="/" className="font-semibold text-teal-600 underline dark:text-teal-400">
          回首頁
        </Link>
      </main>
    )
  }

  // 開了行程連結但還不是成員 → 先選暱稱加入
  if (!identity) {
    return <JoinPrompt trip={trip} onJoined={setIdentity} />
  }

  const context: TripContext = {
    trip,
    members,
    expenses,
    myMemberId: identity.memberId,
    reloadExpenses,
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-teal-50 dark:bg-stone-950">
      <header className="sticky top-0 z-10 flex min-h-12 items-center gap-3 bg-teal-600 px-4 py-2 text-white dark:bg-teal-900">
        <Link to="/" aria-label="回首頁" className="flex min-h-11 min-w-11 items-center text-xl">
          ‹
        </Link>
        <h1 className="truncate text-lg font-semibold">{trip.name}</h1>
      </header>

      <div className="flex-1 pb-20">
        <Outlet context={context} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-teal-100 bg-white pb-[env(safe-area-inset-bottom)] dark:border-stone-800 dark:bg-stone-900">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive
                  ? 'font-semibold text-teal-600 dark:text-teal-400'
                  : 'text-stone-400 dark:text-stone-500'
              }`
            }
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function JoinPrompt({
  trip,
  onJoined,
}: {
  trip: Trip
  onJoined: (identity: ReturnType<typeof getIdentity>) => void
}) {
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const member = await addMember(trip.id, nickname.trim())
      const identity = {
        tripId: trip.id,
        memberId: member.id,
        tripName: trip.name,
        joinedAt: new Date().toISOString(),
      }
      saveIdentity(identity)
      onJoined(identity)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失敗,請再試一次')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-teal-50 px-6 dark:bg-stone-950">
      <h1 className="text-2xl font-bold text-teal-700 dark:text-teal-300">加入「{trip.name}」</h1>
      <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">
        取個旅伴看得懂的暱稱就能開始記帳
      </p>
      <form onSubmit={handleJoin} className="mt-6 space-y-4">
        <input
          className={inputCls}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="我的暱稱"
          required
          maxLength={12}
        />
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? '加入中…' : '加入行程'}
        </button>
        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
