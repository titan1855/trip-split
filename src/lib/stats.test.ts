import { describe, it, expect } from 'vitest'
import { computeStats, type StatsExpense } from './stats'

const A = 'member-a'
const B = 'member-b'

function expense(over: Partial<StatsExpense>): StatsExpense {
  return {
    kind: 'expense',
    amount_cents: 10000,
    fx_rate: 1,
    category: '餐飲',
    expense_splits: [
      { member_id: A, share_cents: 5000 },
      { member_id: B, share_cents: 5000 },
    ],
    ...over,
  }
}

describe('computeStats', () => {
  it('加總總支出與分類', () => {
    const stats = computeStats(
      [expense({}), expense({ category: '交通', amount_cents: 6000, expense_splits: [{ member_id: A, share_cents: 6000 }] })],
      [A, B],
    )
    expect(stats.totalCents).toBe(16000)
    expect(stats.byCategory).toEqual([
      { category: '餐飲', cents: 10000 },
      { category: '交通', cents: 6000 },
    ])
    expect(stats.byMember).toEqual([
      { memberId: A, cents: 11000 },
      { memberId: B, cents: 5000 },
    ])
  })

  it('還款(settlement)不計入統計', () => {
    const stats = computeStats(
      [expense({}), expense({ kind: 'settlement', amount_cents: 99999 })],
      [A, B],
    )
    expect(stats.totalCents).toBe(10000)
  })

  it('外幣依 fx_rate 快照換算,每人加總等於總支出', () => {
    // 10000 分外幣、匯率 0.273 → 2730 分主幣別
    const stats = computeStats([expense({ fx_rate: 0.273 })], [A, B])
    expect(stats.totalCents).toBe(2730)
    expect(stats.byMember[0].cents + stats.byMember[1].cents).toBe(2730)
  })

  it('沒有帳時全部為 0', () => {
    const stats = computeStats([], [A])
    expect(stats.totalCents).toBe(0)
    expect(stats.byCategory).toEqual([])
    expect(stats.byMember).toEqual([{ memberId: A, cents: 0 }])
  })
})
