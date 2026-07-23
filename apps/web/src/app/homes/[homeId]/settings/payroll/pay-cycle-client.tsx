'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@carerota/ui'
import { savePayCycle, type PayDayRuleType } from './actions'

type PayCycle = {
  id: string
  frequency: string
  pay_day_rule: string
  period_start_offset_days: number
}

const FREQUENCIES = [
  { value: 'weekly',       label: 'Weekly' },
  { value: 'bi_weekly',    label: 'Bi-weekly (every 2 weeks)' },
  { value: 'four_weekly',  label: 'Four-weekly' },
  { value: 'monthly',      label: 'Monthly' },
]

const PAY_DAY_RULES = [
  { value: 'last_day_of_month', label: 'Last calendar day of month' },
  { value: 'last_friday',       label: 'Last Friday of month' },
  { value: 'last_thursday',     label: 'Last Thursday of month' },
  { value: 'fixed_day',         label: 'Fixed day of month (e.g. 25th)' },
  { value: 'offset',            label: 'Offset from period end (working days)' },
]

function parseRule(ruleJson: string): { type: PayDayRuleType; param?: string } {
  try {
    const r = JSON.parse(ruleJson)
    return { type: r.type, param: r.day ?? r.working_days }
  } catch {
    return { type: 'last_day_of_month' }
  }
}

export function PayCycleClient({ homeId, existingCycle }: { homeId: string; existingCycle: PayCycle | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const existing = existingCycle
    ? { ...existingCycle, ...parseRule(existingCycle.pay_day_rule) }
    : null

  const [frequency, setFrequency] = useState<string>(existing?.frequency ?? 'monthly')
  const [ruleType, setRuleType] = useState<PayDayRuleType>(existing?.type ?? 'last_day_of_month')
  const [ruleParam, setRuleParam] = useState(existing?.param ?? '')
  const [offsetDays, setOffsetDays] = useState(existing?.period_start_offset_days ?? 0)

  function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await savePayCycle({
        homeId,
        frequency: frequency as 'weekly' | 'bi_weekly' | 'four_weekly' | 'monthly',
        payDayRule: ruleType,
        payDayRuleParam: ruleParam,
        periodStartOffsetDays: offsetDays,
      })
      if (result.error) { setError(result.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  const needsParam = ruleType === 'fixed_day' || ruleType === 'offset'

  return (
    <div className="max-w-md mt-6 space-y-5">
      <div className="space-y-1">
        <label className="text-sm font-medium">Frequency</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm"
          value={frequency}
          onChange={e => setFrequency(e.target.value)}
        >
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Pay day rule</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm"
          value={ruleType}
          onChange={e => setRuleType(e.target.value as PayDayRuleType)}
        >
          {PAY_DAY_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {needsParam && (
        <div className="space-y-1">
          <label className="text-sm font-medium">
            {ruleType === 'fixed_day' ? 'Day of month (1–31)' : 'Working days after period end'}
          </label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2 text-sm"
            value={ruleParam}
            onChange={e => setRuleParam(e.target.value)}
            min={1}
            max={ruleType === 'fixed_day' ? 31 : 20}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium">Period start offset (days after previous period end)</label>
        <input
          type="number"
          className="w-full border rounded px-3 py-2 text-sm"
          value={offsetDays}
          onChange={e => setOffsetDays(parseInt(e.target.value) || 0)}
          min={0}
          max={7}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pay cycle saved.</p>}

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving…' : existingCycle ? 'Update pay cycle' : 'Create pay cycle'}
      </Button>
    </div>
  )
}
