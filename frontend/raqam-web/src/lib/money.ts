const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats an amount for display, always with two decimals: "Rs 1,234.50". */
export function formatPkr(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(amount) ? pkr.format(amount) : ''
}

/**
 * At most 12 digits before the point: with 2 decimals that is 14 significant digits, which
 * a JSON number (a double) holds exactly. The database allows more (D030); the server stays
 * the authority, this only keeps what the browser sends exact.
 */
const AMOUNT_PATTERN = /^-?\d{1,12}(\.\d{1,2})?$/

/**
 * Parses what the user typed into an amount, or null when it is not a valid amount: no more
 * than 2 decimals, never rounded (D030). Thousands commas are allowed. Negatives are
 * accepted only where a caller asks for them; no field does now (an opening balance was the
 * one, until D049).
 */
export function parseAmount(text: string, options: { allowNegative?: boolean } = {}): number | null {
  const cleaned = text.trim().replace(/,/g, '')
  if (!AMOUNT_PATTERN.test(cleaned)) {
    return null
  }
  if (cleaned.startsWith('-') && !options.allowNegative) {
    return null
  }
  return Number(cleaned)
}

/**
 * Adds amounts that each have at most 2 decimals. Done in whole paise (integers), because
 * adding the decimals directly drifts: 0.1 + 0.2 is 0.30000000000000004. Used only to total
 * balances the server already computed.
 */
export function sumMoney(values: number[]): number {
  return values.reduce((paise, value) => paise + Math.round(value * 100), 0) / 100
}
