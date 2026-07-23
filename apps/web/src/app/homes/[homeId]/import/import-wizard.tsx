'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseImport, applyImport, type MatchedStaff } from './actions'
import { POSITIONS } from './positions'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
type Row = MatchedStaff & { include: boolean }

export function ImportWizard({ homeId }: { homeId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [weeks, setWeeks] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)

  async function analyse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError(null)
    const r = await parseImport(homeId, new FormData(e.currentTarget))
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setRows((r.staff ?? []).map(s => ({ ...s, include: true })))
    setWarnings(r.warnings ?? []); setWeeks(r.weeksParsed ?? 0); setStep('review')
  }

  async function apply() {
    setBusy(true); setError(null)
    const r = await applyImport(homeId, rows.filter(x => x.include))
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setResult({ created: r.created ?? 0, updated: r.updated ?? 0 }); setStep('done')
    router.refresh()
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  if (step === 'done' && result) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center max-w-lg">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 text-2xl">✓</div>
        <h2 className="text-lg font-bold">Import complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.created} staff created{result.updated ? `, ${result.updated} updated` : ''}. Roles, contracts, pay rates,
          fixed patterns and the standard week have been set up.
        </p>
        <div className="mt-5 flex gap-2 justify-center">
          <Link href={`/homes/${homeId}/staff`} className="btn-primary text-sm">View staff directory</Link>
          <Link href={`/homes/${homeId}/rota`} className="text-sm border rounded-md px-3 py-2 hover:bg-muted/40">Go to rota board</Link>
        </div>
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <form onSubmit={analyse} className="rounded-xl border bg-card p-6 max-w-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Upload a payroll spreadsheet</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload your monthly rota/payroll workbook (weekly sheets + a Payroll summary, .xlsx). We&rsquo;ll detect each
            person&rsquo;s role, contracted hours, fixed shift pattern and pay rate, then let you review before anything is saved.
          </p>
        </div>
        <input type="file" name="file" accept=".xlsx" required className="block w-full text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          {busy ? 'Analysing…' : 'Analyse spreadsheet'}
        </button>
      </form>
    )
  }

  // review
  const included = rows.filter(r => r.include).length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Detected <strong>{rows.length}</strong> staff across <strong>{weeks}</strong> weeks. Review, correct any positions, then apply.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setStep('upload')} className="text-sm border rounded-md px-3 py-1.5 hover:bg-muted/40">Back</button>
          <button onClick={apply} disabled={busy || included === 0} className="btn-primary text-sm disabled:opacity-50">
            {busy ? 'Applying…' : `Apply ${included} staff`}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Import</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Match</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Position</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Shift</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Contracted hrs</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Rate</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Fixed pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={r.key} className={r.include ? '' : 'opacity-40'}>
                  <td className="px-4 py-2"><input type="checkbox" checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} className="accent-accent" /></td>
                  <td className="px-4 py-2 font-medium">{r.firstName} {r.lastName}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.matchStaffId
                      ? <span className="text-amber-700">Update: {r.matchName}</span>
                      : <span className="text-green-700">New</span>}
                  </td>
                  <td className="px-4 py-2">
                    <select value={r.roleCode} onChange={e => setRow(i, { roleCode: e.target.value })} className="text-sm border rounded px-2 py-1 bg-background">
                      {POSITIONS.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select value={r.shift} onChange={e => setRow(i, { shift: e.target.value as 'day' | 'night' })} className="text-sm border rounded px-2 py-1 bg-background">
                      <option value="day">Day</option>
                      <option value="night">Night</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.contractedHours}h</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.ratePence != null ? `£${(r.ratePence / 100).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.fixed.length ? r.fixed.map(f => `${DOW[f.dow]} ${f.hours}h`).join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
