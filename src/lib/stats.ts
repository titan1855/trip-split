// 統計(SPEC 3.2):純前端計算,全部換算成主幣別;還款(settlement)不計入統計
import { convertRows } from './settle'

export interface StatsExpense {
  kind: string
  amount_cents: number
  fx_rate: number
  category: string | null
  expense_splits: { member_id: string; share_cents: number }[]
}

export interface StatsResult {
  /** 總支出(主幣別分) */
  totalCents: number
  /** 各分類加總,金額大到小排序 */
  byCategory: { category: string; cents: number }[]
  /** 每人分攤額,依 memberIds 順序 */
  byMember: { memberId: string; cents: number }[]
}

export function computeStats(expenses: StatsExpense[], memberIds: string[]): StatsResult {
  const real = expenses.filter((e) => e.kind === 'expense')
  let totalCents = 0
  const catMap = new Map<string, number>()
  const memMap = new Map<string, number>()

  for (const e of real) {
    const target = Math.round(e.amount_cents * e.fx_rate)
    totalCents += target
    const category = e.category ?? '其他'
    catMap.set(category, (catMap.get(category) ?? 0) + target)

    // 每人分攤額換算邏輯與結算一致,保證分類加總 = 每人加總 = 總支出
    const splits = convertRows(
      e.expense_splits.map((s) => ({ member_id: s.member_id, cents: s.share_cents })),
      e.fx_rate,
      target,
    )
    for (const s of splits) memMap.set(s.member_id, (memMap.get(s.member_id) ?? 0) + s.cents)
  }

  return {
    totalCents,
    byCategory: [...catMap.entries()]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents),
    byMember: memberIds.map((memberId) => ({ memberId, cents: memMap.get(memberId) ?? 0 })),
  }
}
