export interface WebPaymentRecord {
  id?: string
  amount: number
  dateTime: string
  note?: string
}

const START_TAG = '<!--PAYMENT_LOG_START-->'
const END_TAG = '<!--PAYMENT_LOG_END-->'

export function parsePaymentRecords(
  rawRemarks?: string | null,
  fallbackPaidAmount = 0,
  fallbackDate?: string | null
): WebPaymentRecord[] {
  if (rawRemarks && rawRemarks.includes(START_TAG) && rawRemarks.includes(END_TAG)) {
    try {
      const jsonStr = rawRemarks.split(START_TAG)[1].split(END_TAG)[0].trim()
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            id: item.id || undefined,
            amount: Number(item.amount || 0),
            dateTime: item.dateTime || item.date_time || 'Recorded',
            note: item.note || 'Payment Received',
          }))
        }
      }
    } catch (e) {
      console.error('Error parsing payment records from remarks:', e)
    }
  }

  if (fallbackPaidAmount > 0) {
    const dStr = fallbackDate ? fallbackDate.slice(0, 16).replace('T', ' ') : new Date().toISOString().slice(0, 10)
    return [
      {
        id: 'initial',
        amount: fallbackPaidAmount,
        dateTime: dStr,
        note: 'Payment Received',
      },
    ]
  }
  return []
}

export function extractCleanClinicalRemarks(rawRemarks?: string | null): string {
  if (!rawRemarks) return ''
  let text = rawRemarks

  // 1. Strip <!--PAYMENT_LOG_START--> ... <!--PAYMENT_LOG_END-->
  if (text.includes(START_TAG)) {
    const before = text.split(START_TAG)[0].trim()
    const after = text.includes(END_TAG) ? text.split(END_TAG)[1].trim() : ''
    text = [before, after].filter(Boolean).join('\n').trim()
  }

  // 2. Strip any other HTML comments <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, '').trim()

  // 3. Strip [[META:...]] tags
  text = text.replace(/\[\[META:[\s\S]*?\]\]/g, '').trim()

  // 4. Strip any generic [[...]] tags
  text = text.replace(/\[\[[\s\S]*?\]\]/g, '').trim()

  // 5. Strip [CLINIC_ID:...] bracket tags
  text = text.replace(/\[[A-Z0-9_]+:[^\]]*\]/gi, '').trim()

  // 6. Strip raw JSON arrays or objects
  text = text.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '').trim()
  text = text.replace(/\{\s*"[a-zA-Z0-9_]+"\s*:[\s\S]*?\}/g, '').trim()

  // 7. Clean up lines
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        Boolean(l) &&
        !l.startsWith('<!--') &&
        !l.endsWith('-->') &&
        !l.startsWith('[[') &&
        !l.startsWith('{"') &&
        !l.startsWith('[{"')
    )
    .join('\n')
    .trim()
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
