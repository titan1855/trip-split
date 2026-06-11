import { describe, it, expect } from 'vitest'
import { computeNets, minTransfers, type SettleExpense } from './settle'

const A = 'member-a'
const B = 'member-b'
const C = 'member-c'
const D = 'member-d'

function expense(
  payers: [string, number][],
  splits: [string, number][],
  fxRate = 1,
): SettleExpense {
  const amount = payers.reduce((a, [, cents]) => a + cents, 0)
  return {
    amount_cents: amount,
    fx_rate: fxRate,
    expense_payers: payers.map(([member_id, paid_cents]) => ({ member_id, paid_cents })),
    expense_splits: splits.map(([member_id, share_cents]) => ({ member_id, share_cents })),
  }
}

describe('computeNets', () => {
  it('100 元 3 人平分(除不盡:33.34/33.33/33.33),A 付全額', () => {
    const nets = computeNets(
      [expense([[A, 10000]], [[A, 3334], [B, 3333], [C, 3333]])],
      [A, B, C],
    )
    expect(nets).toEqual([
      { memberId: A, paidCents: 10000, owedCents: 3334, netCents: 6666 },
      { memberId: B, paidCents: 0, owedCents: 3333, netCents: -3333 },
      { memberId: C, paidCents: 0, owedCents: 3333, netCents: -3333 },
    ])
    // 淨額總和必為 0
    expect(nets.reduce((a, n) => a + n.netCents, 0)).toBe(0)
  })

  it('多人付款:A 付 600、B 付 400,三人平分 1000', () => {
    const nets = computeNets(
      [expense([[A, 60000], [B, 40000]], [[A, 33334], [B, 33333], [C, 33333]])],
      [A, B, C],
    )
    expect(nets[0].netCents).toBe(26666) // A: 60000 - 33334
    expect(nets[1].netCents).toBe(6667) // B: 40000 - 33333
    expect(nets[2].netCents).toBe(-33333)
  })

  it('settlement 還款計入淨額:B 還 A 之後兩清', () => {
    const nets = computeNets(
      [
        expense([[A, 10000]], [[A, 5000], [B, 5000]]), // A 先付 100,兩人平分
        expense([[B, 5000]], [[A, 5000]]), // B 還 A 50(settlement 同樣數學)
      ],
      [A, B],
    )
    expect(nets[0].netCents).toBe(0)
    expect(nets[1].netCents).toBe(0)
  })

  it('沒有任何帳時人人為 0', () => {
    const nets = computeNets([], [A, B])
    expect(nets.every((n) => n.netCents === 0)).toBe(true)
  })

  it('多幣別:fx_rate 換算後付款側與分攤側加總一致(無 1 分落差)', () => {
    // 100 元外幣、匯率 0.273:換算 2730 分;兩人平分各 50 → floor 後靠餘數補齊
    const nets = computeNets(
      [expense([[A, 10000]], [[B, 5000], [C, 5000]], 0.273)],
      [A, B, C],
    )
    expect(nets[0].paidCents).toBe(2730)
    expect(nets[1].owedCents + nets[2].owedCents).toBe(2730)
    expect(nets.reduce((a, n) => a + n.netCents, 0)).toBe(0)
  })
})

describe('minTransfers', () => {
  it('100 元 3 人平分 → 兩筆轉帳給 A', () => {
    const nets = computeNets(
      [expense([[A, 10000]], [[A, 3334], [B, 3333], [C, 3333]])],
      [A, B, C],
    )
    const transfers = minTransfers(nets)
    expect(transfers).toEqual([
      { fromId: B, toId: A, amountCents: 3333 },
      { fromId: C, toId: A, amountCents: 3333 },
    ])
  })

  it('結清後沒有任何轉帳', () => {
    const nets = computeNets(
      [
        expense([[A, 10000]], [[A, 5000], [B, 5000]]),
        expense([[B, 5000]], [[A, 5000]]),
      ],
      [A, B],
    )
    expect(minTransfers(nets)).toEqual([])
  })

  it('鏈狀債務合併:轉帳數最多 n-1 筆', () => {
    // A 付 300 給 ABC 平分;B 付 300 給 BCD 平分;C 付 300 給 CDA 平分
    const nets = computeNets(
      [
        expense([[A, 30000]], [[A, 10000], [B, 10000], [C, 10000]]),
        expense([[B, 30000]], [[B, 10000], [C, 10000], [D, 10000]]),
        expense([[C, 30000]], [[C, 10000], [D, 10000], [A, 10000]]),
      ],
      [A, B, C, D],
    )
    const transfers = minTransfers(nets)
    expect(transfers.length).toBeLessThanOrEqual(3)
    // 驗證轉帳後人人歸零
    const balance = new Map(nets.map((n) => [n.memberId, n.netCents]))
    for (const t of transfers) {
      balance.set(t.fromId, balance.get(t.fromId)! + t.amountCents)
      balance.set(t.toId, balance.get(t.toId)! - t.amountCents)
    }
    expect([...balance.values()].every((v) => v === 0)).toBe(true)
  })

  it('一人欠多人', () => {
    // D 欠 A/B/C 各 100
    const nets = computeNets(
      [
        expense([[A, 10000]], [[D, 10000]]),
        expense([[B, 10000]], [[D, 10000]]),
        expense([[C, 10000]], [[D, 10000]]),
      ],
      [A, B, C, D],
    )
    const transfers = minTransfers(nets)
    expect(transfers).toHaveLength(3)
    expect(transfers.every((t) => t.fromId === D && t.amountCents === 10000)).toBe(true)
  })

  it('轉帳金額全為正整數分', () => {
    const nets = computeNets(
      [expense([[A, 10001]], [[A, 3334], [B, 3334], [C, 3333]])],
      [A, B, C],
    )
    for (const t of minTransfers(nets)) {
      expect(Number.isSafeInteger(t.amountCents)).toBe(true)
      expect(t.amountCents).toBeGreaterThan(0)
    }
  })
})
