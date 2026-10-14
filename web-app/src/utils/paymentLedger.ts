export interface WebPaymentRecord {
  id: string
  amount: number
  dateTime: string
  note?: string
}

export interface WebInvoiceItem {
  id?: string
  name?: string
  itemName?: string
  quantity: number
  price: number
  total: number
}

const START_TAG = '<!--PAYMENT_LOG_START-->'
const END_TAG = '<!--PAYMENT_LOG_END-->'

export function parsePaymentRecords(
  rawRemarks?: string | null,
  fallbackPaidAmount: number = 0,
  fallbackDate?: string | null
): WebPaymentRecord[] {
  if (rawRemarks && rawRemarks.includes(START_TAG) && rawRemarks.includes(END_TAG)) {
    try {
      const jsonStr = rawRemarks.split(START_TAG)[1].split(END_TAG)[0].trim()
      if (jsonStr) {
        const list = JSON.parse(jsonStr)
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            amount: Number(item.amount || 0),
            dateTime: item.date_time || item.dateTime || new Date().toLocaleString(),
            note: item.note || 'Payment Received',
          }))
        }
      }
    } catch (e) {
      console.error('Error parsing payment records from remarks:', e)
    }
  }
  if (fallbackPaidAmount > 0) {
    const dateStr = fallbackDate ? fallbackDate.slice(0, 16).replace('T', ' ') : new Date().toISOString().slice(0, 10)
    return [
      {
        id: crypto.randomUUID(),
        amount: fallbackPaidAmount,
        dateTime: dateStr,
        note: 'Payment Received',
      },
    ]
  }
  return []
}

export function extractCleanClinicalRemarks(rawRemarks?: string | null): string {
  if (!rawRemarks) return ''
  if (!rawRemarks.includes(START_TAG)) return rawRemarks.trim()
  const before = rawRemarks.split(START_TAG)[0].trim()
  const after = rawRemarks.includes(END_TAG) ? rawRemarks.split(END_TAG)[1].trim() : ''
  return [before, after].filter(Boolean).join('\n').trim()
}

export function buildCombinedRemarks(cleanRemarks: string, paymentRecords: WebPaymentRecord[]): string {
  const trimmed = cleanRemarks.trim()
  if (!paymentRecords || paymentRecords.length === 0) return trimmed
  const recordsToSerialize = paymentRecords.map((r) => ({
    id: r.id,
    amount: r.amount,
    date_time: r.dateTime,
    note: r.note || 'Payment Received',
  }))
  const recordsJson = JSON.stringify(recordsToSerialize)
  const logBlock = `${START_TAG}\n${recordsJson}\n${END_TAG}`
  return trimmed ? `${trimmed}\n\n${logBlock}` : logBlock
}
