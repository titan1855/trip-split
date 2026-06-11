import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTrip, findTripByInviteCode, addMember } from '../lib/api'
import { getIdentities, saveIdentity } from '../lib/storage'
import { normalizeInviteCode } from '../lib/inviteCode'
import { CURRENCIES } from '../lib/constants'
import { inputCls, labelCls, btnPrimary, errorBox } from '../lib/ui'

export default function Home() {
  const navigate = useNavigate()
  const identities = getIdentities()

  const [mode, setMode] = useState<'none' | 'create' | 'join'>(identities.length ? 'none' : 'join')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 建立行程表單
  const [tripName, setTripName] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [createNickname, setCreateNickname] = useState('')

  // 加入行程表單
  const [code, setCode] = useState('')
  const [joinNickname, setJoinNickname] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { trip, member } = await createTrip(
        tripName.trim(),
        currency,
        createNickname.trim(),
      )
      saveIdentity({
        tripId: trip.id,
        memberId: member.id,
        tripName: trip.name,
        joinedAt: new Date().toISOString(),
      })
      navigate(`/trip/${trip.id}/members`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立行程失敗,請再試一次')
      setBusy(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const trip = await findTripByInviteCode(normalizeInviteCode(code))
      if (!trip) {
        setError('找不到這個邀請碼,請跟旅伴確認一下')
        setBusy(false)
        return
      }
      const member = await addMember(trip.id, joinNickname.trim())
      saveIdentity({
        tripId: trip.id,
        memberId: member.id,
        tripName: trip.name,
        joinedAt: new Date().toISOString(),
      })
      navigate(`/trip/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入行程失敗,請再試一次')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-teal-50 px-5 pb-10 pt-12 dark:bg-stone-950">
      <h1 className="text-3xl font-bold text-teal-700 dark:text-teal-300">旅行拆帳</h1>
      <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">
        跟旅伴一起記帳,回來算一下誰欠誰
      </p>

      {identities.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-teal-800 dark:text-teal-300">我的行程</h2>
          <ul className="space-y-2">
            {identities.map((i) => (
              <li key={i.tripId}>
                <Link
                  to={`/trip/${i.tripId}`}
                  className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm active:bg-teal-100 dark:bg-stone-900 dark:active:bg-stone-800"
                >
                  <span className="font-medium text-teal-950 dark:text-teal-100">{i.tripName}</span>
                  <span className="text-teal-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-3">
        <button
          type="button"
          onClick={() => setMode(mode === 'create' ? 'none' : 'create')}
          className="min-h-12 w-full rounded-2xl bg-teal-600 px-5 font-semibold text-white shadow active:bg-teal-700"
        >
          開新行程
        </button>

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-stone-900">
            <div>
              <label htmlFor="trip-name" className={labelCls}>
                行程名稱
              </label>
              <input
                id="trip-name"
                className={inputCls}
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="例如:沖繩四天三夜"
                required
                maxLength={30}
              />
            </div>
            <div>
              <label htmlFor="trip-currency" className={labelCls}>
                主幣別(結算用)
              </label>
              <select
                id="trip-currency"
                className={inputCls}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="create-nickname" className={labelCls}>
                我的暱稱
              </label>
              <input
                id="create-nickname"
                className={inputCls}
                value={createNickname}
                onChange={(e) => setCreateNickname(e.target.value)}
                placeholder="旅伴看得懂的名字"
                required
                maxLength={12}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={btnPrimary}
            >
              {busy ? '建立中…' : '建立行程'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === 'join' ? 'none' : 'join')}
          className="min-h-12 w-full rounded-2xl border-2 border-teal-600 px-5 font-semibold text-teal-700 active:bg-teal-100 dark:text-teal-300 dark:active:bg-stone-900"
        >
          用邀請碼加入
        </button>

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-stone-900">
            <div>
              <label htmlFor="invite-code" className={labelCls}>
                邀請碼
              </label>
              <input
                id="invite-code"
                className={`${inputCls} font-mono uppercase tracking-widest`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 碼,例如 K3M9QP"
                required
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="join-nickname" className={labelCls}>
                我的暱稱
              </label>
              <input
                id="join-nickname"
                className={inputCls}
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="旅伴看得懂的名字"
                required
                maxLength={12}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={btnPrimary}
            >
              {busy ? '加入中…' : '加入行程'}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
