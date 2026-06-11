import { supabase } from './supabase'
import { generateInviteCode } from './inviteCode'
import type { Expense, ExpensePayer, ExpenseSplit, Member, Trip } from './database.types'

export type ExpenseDetail = Expense & {
  expense_splits: ExpenseSplit[]
  expense_payers: ExpensePayer[]
}

/** 統一把 Supabase 錯誤轉成使用者看得懂的中文訊息 */
function fail(message: string, error: unknown): never {
  console.error(message, error)
  throw new Error(message)
}

// ---------- 行程 ----------

export async function createTrip(
  name: string,
  baseCurrency: string,
  nickname: string,
): Promise<{ trip: Trip; member: Member }> {
  // 邀請碼撞到 unique 約束時換一組重試
  let trip: Trip | null = null
  for (let attempt = 0; attempt < 5 && !trip; attempt++) {
    const { data, error } = await supabase
      .from('trips')
      .insert({ name, base_currency: baseCurrency, invite_code: generateInviteCode() })
      .select()
      .single()
    if (!error) {
      trip = data
    } else if (error.code !== '23505') {
      fail('建立行程失敗,請檢查網路後再試一次', error)
    }
  }
  if (!trip) fail('建立行程失敗,請再試一次', null)

  const member = await addMember(trip.id, nickname)
  return { trip, member }
}

/**
 * 刪除整個行程(連同所有帳目與成員,無法復原)。
 * 注意順序:expenses.payer_id / expense_splits.member_id 等 FK 沒有 cascade,
 * 直接刪 trips 會被擋,必須先刪支出(cascade 帶走明細)再刪成員、最後刪行程。
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const { error: expError } = await supabase.from('expenses').delete().eq('trip_id', tripId)
  if (expError) fail('刪除行程失敗(帳目清除錯誤),請再試一次', expError)

  const { error: memberError } = await supabase.from('members').delete().eq('trip_id', tripId)
  if (memberError) fail('刪除行程失敗(成員清除錯誤),請再試一次', memberError)

  const { error: tripError } = await supabase.from('trips').delete().eq('id', tripId)
  if (tripError) fail('刪除行程失敗,請檢查網路後再試一次', tripError)
}

export async function fetchTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select().eq('id', tripId).maybeSingle()
  if (error) fail('讀取行程失敗,請檢查網路後再試一次', error)
  return data
}

/** 依邀請碼查行程(用 eq + single,不撈全表) */
export async function findTripByInviteCode(code: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select()
    .eq('invite_code', code)
    .maybeSingle()
  if (error) fail('查詢邀請碼失敗,請檢查網路後再試一次', error)
  return data
}

// ---------- 成員 ----------

export async function fetchMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select()
    .eq('trip_id', tripId)
    .order('created_at')
  if (error) fail('讀取成員失敗,請檢查網路後再試一次', error)
  return data
}

/**
 * 用暱稱加入行程:暱稱已存在時視為「我就是這個成員」直接綁定
 * (換手機重新加入時不會被 unique 約束擋下)
 */
export async function addMember(tripId: string, nickname: string): Promise<Member> {
  const { data: existing, error: findError } = await supabase
    .from('members')
    .select()
    .eq('trip_id', tripId)
    .eq('nickname', nickname)
    .maybeSingle()
  if (findError) fail('查詢成員失敗,請檢查網路後再試一次', findError)
  if (existing) return existing

  const { data, error } = await supabase
    .from('members')
    .insert({ trip_id: tripId, nickname })
    .select()
    .single()
  if (error) fail('加入行程失敗,請檢查網路後再試一次', error)
  return data
}

// ---------- 支出 ----------

export interface ExpenseInput {
  trip_id: string
  kind: 'expense' | 'settlement'
  title: string
  amount_cents: number
  currency: string
  fx_rate: number
  category: string
  spent_at: string
  note: string | null
}

export interface SplitInput {
  member_id: string
  share_cents: number
}

export interface PayerInput {
  member_id: string
  paid_cents: number
}

export async function fetchExpenses(tripId: string): Promise<ExpenseDetail[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_splits(*), expense_payers(*)')
    .eq('trip_id', tripId)
    .order('spent_at', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<ExpenseDetail[]>()
  if (error) fail('讀取支出失敗,請檢查網路後再試一次', error)
  return data
}

export async function createExpense(
  input: ExpenseInput,
  payers: PayerInput[],
  splits: SplitInput[],
): Promise<void> {
  const { data: expense, error } = await supabase.from('expenses').insert(input).select().single()
  if (error) fail('記帳失敗,請檢查網路後再試一次', error)

  const { error: payerError } = await supabase
    .from('expense_payers')
    .insert(payers.map((p) => ({ ...p, expense_id: expense.id })))
  const { error: splitError } = payerError
    ? { error: null }
    : await supabase
        .from('expense_splits')
        .insert(splits.map((s) => ({ ...s, expense_id: expense.id })))
  if (payerError || splitError) {
    // 明細寫入失敗時把孤兒支出清掉(cascade 帶走已寫入的明細)
    await supabase.from('expenses').delete().eq('id', expense.id)
    fail('記帳失敗(明細寫入錯誤),請再試一次', payerError ?? splitError)
  }
}

export async function updateExpense(
  expenseId: string,
  input: Omit<ExpenseInput, 'trip_id' | 'kind'>,
  payers: PayerInput[],
  splits: SplitInput[],
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
  if (error) fail('更新支出失敗,請檢查網路後再試一次', error)

  for (const table of ['expense_payers', 'expense_splits'] as const) {
    const { error: delError } = await supabase.from(table).delete().eq('expense_id', expenseId)
    if (delError) fail('更新明細失敗,請再試一次', delError)
  }

  const { error: payerError } = await supabase
    .from('expense_payers')
    .insert(payers.map((p) => ({ ...p, expense_id: expenseId })))
  if (payerError) fail('更新付款明細失敗,請再試一次', payerError)

  const { error: splitError } = await supabase
    .from('expense_splits')
    .insert(splits.map((s) => ({ ...s, expense_id: expenseId })))
  if (splitError) fail('更新分攤明細失敗,請再試一次', splitError)
}

export async function deleteExpense(expenseId: string): Promise<void> {
  // expense_splits 由 on delete cascade 一併刪除
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) fail('刪除失敗,請檢查網路後再試一次', error)
}
