const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 'YYYY-MM-DD' → '6月11日 週四' */
export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${m}月${d}日 週${WEEKDAYS[date.getDay()]}`
}

/** 今天的 'YYYY-MM-DD'(本地時區) */
export function todayStr(): string {
  return new Date().toLocaleDateString('sv')
}
