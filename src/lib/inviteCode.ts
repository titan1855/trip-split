// 6 碼大寫英數邀請碼;排除易混淆字元(0/O、1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateInviteCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase()
}
