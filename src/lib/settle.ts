// 結算演算法(SPEC 3.3):淨額計算 + 最少轉帳貪婪法
// 全程以整數「分」運算;多幣別支出依每筆 fx_rate 快照換算成主幣別

/** 結算只需要的支出欄位(ExpenseDetail 可直接傳入) */
export interface SettleExpense {
  amount_cents: number
  fx_rate: number
  expense_payers: { member_id: string; paid_cents: number }[]
  expense_splits: { member_id: string; share_cents: number }[]
}

export interface MemberNet {
  memberId: string
  /** 他付出的總額(主幣別分) */
  paidCents: number
  /** 他應分攤的總額(主幣別分) */
  owedCents: number
  /** 淨額 = paid − owed;正=該收回,負=該付 */
  netCents: number
}

export interface Transfer {
  fromId: string
  toId: string
  amountCents: number
}

/**
 * 把一筆支出的明細列換算成主幣別,並保證換算後加總等於 targetCents
 * (floor + 最大餘數法分配差額,避免付款側與分攤側因各自四捨五入而差 1 分)
 */
export function convertRows(
  rows: { member_id: string; cents: number }[],
  rate: number,
  targetCents: number,
): { member_id: string; cents: number }[] {
  if (rate === 1) return rows
  const raw = rows.map((r) => r.cents * rate)
  const result = raw.map((v) => Math.floor(v))
  let diff = targetCents - result.reduce((a, b) => a + b, 0)
  // 依小數部分大到小補 1 分(diff 為負時從小數部分最小者扣回)
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (diff > 0 ? b.frac - a.frac : a.frac - b.frac))
  let k = 0
  while (diff !== 0 && rows.length > 0) {
    const idx = order[k % order.length].i
    result[idx] += diff > 0 ? 1 : -1
    diff += diff > 0 ? -1 : 1
    k++
  }
  return rows.map((r, i) => ({ member_id: r.member_id, cents: result[i] }))
}

/** 計算每位成員淨額(含 settlement 還款記錄,數學上與一般支出相同) */
export function computeNets(expenses: SettleExpense[], memberIds: string[]): MemberNet[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()

  for (const e of expenses) {
    const target = Math.round(e.amount_cents * e.fx_rate)
    const payers = convertRows(
      e.expense_payers.map((p) => ({ member_id: p.member_id, cents: p.paid_cents })),
      e.fx_rate,
      target,
    )
    const splits = convertRows(
      e.expense_splits.map((s) => ({ member_id: s.member_id, cents: s.share_cents })),
      e.fx_rate,
      target,
    )
    for (const p of payers) paid.set(p.member_id, (paid.get(p.member_id) ?? 0) + p.cents)
    for (const s of splits) owed.set(s.member_id, (owed.get(s.member_id) ?? 0) + s.cents)
  }

  return memberIds.map((memberId) => {
    const paidCents = paid.get(memberId) ?? 0
    const owedCents = owed.get(memberId) ?? 0
    return { memberId, paidCents, owedCents, netCents: paidCents - owedCents }
  })
}

/**
 * 最少轉帳貪婪法:每次取最大債務人與最大債權人配對,
 * 轉帳金額 = min(|債務|, 債權),歸零者移出,重複到結清。
 * 同額時以 nets 的順序(成員加入順序)決定,結果具確定性。
 */
export function minTransfers(nets: MemberNet[]): Transfer[] {
  const creditors = nets
    .filter((n) => n.netCents > 0)
    .map((n) => ({ id: n.memberId, amount: n.netCents }))
  const debtors = nets
    .filter((n) => n.netCents < 0)
    .map((n) => ({ id: n.memberId, amount: -n.netCents }))

  const transfers: Transfer[] = []
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.amount, debtor.amount)
    transfers.push({ fromId: debtor.id, toId: creditor.id, amountCents: amount })
    creditor.amount -= amount
    debtor.amount -= amount
    if (creditor.amount === 0) creditors.shift()
    if (debtor.amount === 0) debtors.splice(debtors.indexOf(debtor), 1)
  }
  return transfers
}
