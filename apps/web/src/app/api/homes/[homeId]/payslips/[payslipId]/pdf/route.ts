import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { renderToBuffer } from '@react-pdf/renderer'
import { PayslipPdf } from '@/components/payslip-pdf'

type RouteParams = { params: Promise<{ homeId: string; payslipId: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { homeId, payslipId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Load payslip + lines
  const { data: payslip } = await supabase
    .from('payslips')
    .select('*')
    .eq('id', payslipId)
    .eq('home_id', homeId)
    .single()
  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lines } = await supabase
    .from('payslip_lines')
    .select('*')
    .eq('payslip_id', payslipId)
    .order('line_type')

  const { data: staffMember } = await supabase
    .from('staff')
    .select('first_name, last_name, ni_number')
    .eq('id', payslip.staff_id)
    .single()

  const { data: home } = await supabase
    .from('homes')
    .select('name, address')
    .eq('id', homeId)
    .single()

  const { data: run } = await supabase
    .from('pay_runs')
    .select('pay_periods!inner(period_start_date, period_end_date, pay_day)')
    .eq('id', payslip.pay_run_id)
    .single()

  const period = run?.pay_periods as { period_start_date: string; period_end_date: string; pay_day: string } | null

  const buffer = await renderToBuffer(
    PayslipPdf({
      payslip,
      lines: lines ?? [],
      staffName: `${staffMember?.first_name} ${staffMember?.last_name}`,
      niNumber: staffMember?.ni_number ?? '',
      homeName: home?.name ?? '',
      homeAddress: home?.address ?? '',
      periodStart: period?.period_start_date ?? '',
      periodEnd: period?.period_end_date ?? '',
      payDay: period?.pay_day ?? '',
    })
  )

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${payslipId}.pdf"`,
    },
  })
}
