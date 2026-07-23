import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#111' },
  header:     { marginBottom: 16 },
  homeName:   { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle:   { fontSize: 9, color: '#666' },
  section:    { marginTop: 14 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#888', letterSpacing: 0.5, marginBottom: 4 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomColor: '#eee', borderBottomWidth: 0.5 },
  bold:       { fontFamily: 'Helvetica-Bold' },
  mono:       { fontFamily: 'Courier', fontSize: 9 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 4 },
  netPay:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#15803d' },
  footer:     { marginTop: 20, fontSize: 8, color: '#888' },
  col1:       { flex: 2 },
  col2:       { flex: 1, textAlign: 'right' },
  col3:       { width: 40, textAlign: 'right' },
  col4:       { width: 40, textAlign: 'right' },
  col5:       { width: 60, textAlign: 'right' },
})

type PayslipLine = {
  line_type: string
  description: string
  hours: number | null
  rate_pence: number | null
  multiplier: number
  amount_pence: number
  source_shift_ids: string[]
}

type Payslip = {
  gross_total_pence: number
  net_pay_pence: number
  paye_tax_pence: number
  ni_employee_pence: number
  pension_employee_pence: number
  student_loan_pence: number
  statutory_payments_pence: number
  tax_code: string | null
  ni_category: string | null
}

type Props = {
  payslip: Payslip
  lines: PayslipLine[]
  staffName: string
  niNumber: string
  homeName: string
  homeAddress: string
  periodStart: string
  periodEnd: string
  payDay: string
}

const EARNINGS_TYPES = new Set([
  'basic_weekday', 'basic_weekend', 'bank_holiday', 'christmas', 'night',
  'overtime', 'training', 'holiday', 'sickness', 'sleep_in',
  'statutory_ssp', 'statutory_smp',
])

function fmt(p: number) { return `£${(Math.abs(p) / 100).toFixed(2)}` }
function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PayslipPdf({
  payslip, lines, staffName, niNumber, homeName, homeAddress,
  periodStart, periodEnd, payDay,
}: Props) {
  const earningsLines = lines.filter(l => EARNINGS_TYPES.has(l.line_type) && l.amount_pence > 0)
  const deductionLines = lines.filter(l => !EARNINGS_TYPES.has(l.line_type) && l.amount_pence < 0)

  const niLast4 = niNumber ? `****${niNumber.slice(-4)}` : '—'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.homeName}>{homeName}</Text>
          {homeAddress ? <Text style={styles.subtitle}>{homeAddress}</Text> : null}
        </View>

        {/* Staff + period info */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={styles.bold}>{staffName}</Text>
            <Text style={styles.subtitle}>NI: {niLast4}</Text>
            {payslip.tax_code && <Text style={styles.subtitle}>Tax code: {payslip.tax_code}</Text>}
            {payslip.ni_category && <Text style={styles.subtitle}>NI category: {payslip.ni_category}</Text>}
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.bold}>Pay period</Text>
            <Text style={styles.subtitle}>{fmtDate(periodStart)} – {fmtDate(periodEnd)}</Text>
            <Text style={styles.subtitle}>Pay day: {fmtDate(payDay)}</Text>
          </View>
        </View>

        {/* Earnings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          {earningsLines.map((l, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.col1}>
                <Text>{l.description}</Text>
                {l.source_shift_ids.length > 0 && (
                  <Text style={{ fontSize: 7, color: '#3b82f6' }}>
                    Shifts: {l.source_shift_ids.slice(0, 3).join(', ')}{l.source_shift_ids.length > 3 ? '…' : ''}
                  </Text>
                )}
              </View>
              <Text style={styles.col2}>{l.hours != null ? `${l.hours.toFixed(2)} hrs` : ''}</Text>
              <Text style={styles.col3}>{l.rate_pence ? fmt(l.rate_pence) : ''}</Text>
              <Text style={styles.col4}>{l.multiplier !== 1 ? `×${l.multiplier}` : ''}</Text>
              <Text style={[styles.col5, styles.mono]}>{fmt(l.amount_pence)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.col1, styles.bold]}>Gross pay</Text>
            <Text style={[styles.col5, styles.bold, styles.mono]}>{fmt(payslip.gross_total_pence)}</Text>
          </View>
        </View>

        {/* Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          {deductionLines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.col1}>{l.description}</Text>
              <Text style={[styles.col5, styles.mono, { color: '#dc2626' }]}>
                −{fmt(Math.abs(l.amount_pence))}
              </Text>
            </View>
          ))}
        </View>

        {/* Net pay */}
        <View style={[styles.totalRow, { marginTop: 10 }]}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>Net pay</Text>
          <Text style={[styles.netPay, styles.mono]}>{fmt(payslip.net_pay_pence)}</Text>
        </View>

        <View style={styles.footer}>
          <Text>If you have any questions about this payslip, please contact your manager or HR.</Text>
        </View>
      </Page>
    </Document>
  )
}
