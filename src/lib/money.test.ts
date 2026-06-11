import { describe, it, expect } from 'vitest'
import { parseAmountToCents, formatCents, splitEvenly } from './money'

describe('parseAmountToCents', () => {
  it('整數元轉成分', () => {
    expect(parseAmountToCents('100')).toBe(10000)
  })
  it('帶兩位小數', () => {
    expect(parseAmountToCents('99.95')).toBe(9995)
  })
  it('帶一位小數', () => {
    expect(parseAmountToCents('0.5')).toBe(50)
  })
  it('浮點誤差陷阱值也正確(不經過浮點乘法)', () => {
    expect(parseAmountToCents('19.99')).toBe(1999)
    expect(parseAmountToCents('0.07')).toBe(7)
  })
  it('不合法輸入回傳 null', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('1.234')).toBeNull()
    expect(parseAmountToCents('-5')).toBeNull()
    expect(parseAmountToCents('0')).toBeNull()
  })
})

describe('formatCents', () => {
  it('整數元', () => {
    expect(formatCents(10000)).toBe('100')
  })
  it('千分位', () => {
    expect(formatCents(125000)).toBe('1,250')
  })
  it('小數去尾零', () => {
    expect(formatCents(9950)).toBe('99.5')
    expect(formatCents(9995)).toBe('99.95')
    expect(formatCents(9905)).toBe('99.05')
  })
  it('負數', () => {
    expect(formatCents(-3350)).toBe('-33.5')
  })
})

describe('splitEvenly', () => {
  it('100 元 3 人平分 = 33.34 / 33.33 / 33.33,總和不變', () => {
    const shares = splitEvenly(10000, 3)
    expect(shares).toEqual([3334, 3333, 3333])
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10000)
  })
  it('整除時人人相同', () => {
    expect(splitEvenly(9000, 3)).toEqual([3000, 3000, 3000])
  })
  it('餘數分散給前面的人', () => {
    expect(splitEvenly(101, 4)).toEqual([26, 25, 25, 25])
    expect(splitEvenly(103, 4)).toEqual([26, 26, 26, 25])
  })
  it('1 人獨攤', () => {
    expect(splitEvenly(999, 1)).toEqual([999])
  })
})
