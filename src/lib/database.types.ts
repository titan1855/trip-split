// 對應 SPEC.md 第 4 節的 Supabase schema
// 注意:必須用 type 別名而非 interface,supabase-js 的泛型約束才吃得到(interface 無隱含 index signature)
export type ExpenseKind = 'expense' | 'settlement'

export type ExpenseCategory = '餐飲' | '交通' | '住宿' | '門票' | '購物' | '其他'

export type Trip = {
  id: string
  name: string
  invite_code: string
  base_currency: string
  created_at: string
}

export type Member = {
  id: string
  trip_id: string
  nickname: string
  created_at: string
}

export type Expense = {
  id: string
  trip_id: string
  kind: ExpenseKind
  title: string
  /** 以「分」為單位的整數,禁止用浮點數算錢 */
  amount_cents: number
  currency: string
  /** 對主幣別匯率(每筆快照) */
  fx_rate: number
  /** 已退役:付款人改存 expense_payers,僅為相容保留 */
  payer_id: string | null
  category: string
  spent_at: string
  note: string | null
  created_at: string
  updated_at: string
}

export type ExpenseSplit = {
  id: string
  expense_id: string
  member_id: string
  /** 此成員應分攤金額(分) */
  share_cents: number
}

export type ExpensePayer = {
  id: string
  expense_id: string
  member_id: string
  /** 此成員付款金額(分) */
  paid_cents: number
}

export type TripFxRate = {
  trip_id: string
  currency: string
  rate: number
}

/** supabase-js v2 的 Database 泛型結構 */
export type Database = {
  public: {
    Tables: {
      trips: {
        Row: Trip
        Insert: Omit<Trip, 'id' | 'created_at'> & Partial<Pick<Trip, 'id' | 'base_currency'>>
        Update: Partial<Omit<Trip, 'id'>>
        Relationships: []
      }
      members: {
        Row: Member
        Insert: Omit<Member, 'id' | 'created_at'> & Partial<Pick<Member, 'id'>>
        Update: Partial<Omit<Member, 'id'>>
        Relationships: []
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'payer_id'> &
          Partial<
            Pick<Expense, 'id' | 'kind' | 'currency' | 'fx_rate' | 'category' | 'spent_at' | 'note' | 'payer_id'>
          >
        Update: Partial<Omit<Expense, 'id'>>
        Relationships: []
      }
      expense_splits: {
        Row: ExpenseSplit
        Insert: Omit<ExpenseSplit, 'id'> & Partial<Pick<ExpenseSplit, 'id'>>
        Update: Partial<Omit<ExpenseSplit, 'id'>>
        Relationships: []
      }
      expense_payers: {
        Row: ExpensePayer
        Insert: Omit<ExpensePayer, 'id'> & Partial<Pick<ExpensePayer, 'id'>>
        Update: Partial<Omit<ExpensePayer, 'id'>>
        Relationships: []
      }
      trip_fx_rates: {
        Row: TripFxRate
        Insert: TripFxRate
        Update: Partial<TripFxRate>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
