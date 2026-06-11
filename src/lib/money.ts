// 金額一律以整數「分」(cents) 運算與儲存,只在顯示層轉成元(CLAUDE.md 鐵則)

/** 把使用者輸入的元(字串)轉成分;格式不合法或非正數回傳 null。不經過浮點運算。 */
export function parseAmountToCents(input: string): number | null {
  const t = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [intPart, fracPart = ''] = t.split('.')
  const cents = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

/** 同 parseAmountToCents,但空字串與 0 視為合法的 0(自訂分攤「沒填就是 0」用) */
export function parseCentsAllowZero(input: string): number | null {
  const t = input.trim()
  if (t === '') return 0
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [intPart, fracPart = ''] = t.split('.')
  const cents = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
}

/** 分 → 元字串(千分位,小數最多兩位、去尾零) */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const yuan = Math.floor(abs / 100)
  const frac = abs % 100
  const fracStr =
    frac === 0 ? '' : frac % 10 === 0 ? `.${frac / 10}` : `.${String(frac).padStart(2, '0')}`
  return `${sign}${yuan.toLocaleString('zh-TW')}${fracStr}`
}

/** 分 → 含幣別的顯示字串 */
export function formatMoney(cents: number, currency: string): string {
  const prefix = currency === 'TWD' ? 'NT$' : `${currency} `
  return `${prefix}${formatCents(cents)}`
}

/** 平分:除不盡的餘數(分)由前面的人多攤 1 分,總和保證等於原金額 */
export function splitEvenly(totalCents: number, count: number): number[] {
  if (count <= 0 || !Number.isSafeInteger(totalCents)) {
    throw new Error('splitEvenly: 參數不合法')
  }
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base))
}
