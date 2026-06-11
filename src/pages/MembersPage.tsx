import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTripContext } from './TripLayout'
import { deleteTrip } from '../lib/api'
import { removeIdentity } from '../lib/storage'

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
      <section className="rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="text-sm text-stone-500">把邀請碼丟給旅伴</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-teal-700">
          {trip.invite_code}
        </p>
        <button
          type="button"
          onClick={handleShare}
          className="mt-4 min-h-12 w-full rounded-xl bg-teal-600 font-semibold text-white active:bg-teal-700"
        >
          {copied ? '複製好了!' : '分享邀請碼'}
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-teal-800">
          成員({members.length} 人)
        </h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm"
            >
              <span className="font-medium text-stone-900">{m.nickname}</span>
              {m.id === myMemberId && (
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                  我
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">主幣別</span>
          <span className="font-semibold text-stone-900">{trip.base_currency}</span>
        </div>
        {/* 匯率設定在 Phase 5 加入 */}
      </section>

      <section className="mb-6 mt-10">
        <button
          type="button"
          onClick={handleDeleteTrip}
          disabled={deleting}
          className="min-h-12 w-full rounded-xl border border-red-300 font-semibold text-red-600 active:bg-red-50 disabled:opacity-50"
        >
          {deleting ? '刪除中…' : '刪除整個行程'}
        </button>
        <p className="mt-2 text-center text-xs text-stone-400">
          會刪掉所有帳目與成員,大家都看不到,無法復原
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
