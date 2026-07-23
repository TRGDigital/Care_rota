'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function startPayRun(formData: FormData) {
  const homeId = formData.get('homeId') as string
  const payPeriodId = formData.get('payPeriodId') as string

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'}/api/homes/${homeId}/pay-runs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payPeriodId }),
    }
  )
  const data = await res.json() as { runId: string }
  redirect(`/homes/${homeId}/pay-runs/${data.runId}`)
}
