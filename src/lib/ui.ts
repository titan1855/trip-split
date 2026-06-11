// 共用樣式(深色模式跟隨系統 prefers-color-scheme,用 Tailwind dark: 變體)

export const inputCls =
  'w-full min-h-11 rounded-xl border border-teal-200 bg-white px-4 text-base text-stone-900 focus:border-teal-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100'

export const labelCls = 'mb-1 block text-sm font-medium text-teal-900 dark:text-teal-200'

export const btnPrimary =
  'min-h-12 w-full rounded-xl bg-teal-600 font-semibold text-white active:bg-teal-700 disabled:opacity-50'

export const errorBox =
  'rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:bg-orange-950 dark:text-orange-300'

export const chipCls = (active: boolean) =>
  `min-h-11 rounded-full px-4 text-sm ${
    active
      ? 'bg-teal-600 font-semibold text-white'
      : 'bg-white text-stone-600 shadow-sm dark:bg-stone-800 dark:text-stone-300'
  }`

export const sectionTitle = 'mb-2 text-sm font-semibold text-teal-800 dark:text-teal-300'
