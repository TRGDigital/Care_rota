// Minimal CSV builder — handles quoting and CRLF line endings (RFC 4180)
export function buildCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines: string[] = [headers.map(quoteCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(v => quoteCell(v === null ? '' : String(v))).join(','))
  }
  return lines.join('\r\n')
}

function quoteCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function penceToGbp(pence: number): string {
  return (pence / 100).toFixed(2)
}

export function penceToPenceStr(pence: number): string {
  return String(pence)
}

export function hoursStr(minutes: number): string {
  return (minutes / 60).toFixed(2)
}
