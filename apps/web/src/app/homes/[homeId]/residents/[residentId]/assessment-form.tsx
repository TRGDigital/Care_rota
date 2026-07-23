'use client'

import { useState, useTransition } from 'react'
import { recordAssessment } from '../actions'
import { computeDependencyBand, SCORE_LABELS, BAND_LABEL, type AssessmentScores } from '@carerota/domain'

type Props = { homeId: string; residentId: string }

const EMPTY: AssessmentScores = {
  mobility_score: 0, continence_score: 0, cognition_score: 0,
  behaviour_score: 0, clinical_complexity_score: 0,
}

export function AssessmentForm({ homeId, residentId }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [scores, setScores] = useState<AssessmentScores>(EMPTY)
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const band = computeDependencyBand(scores)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await recordAssessment(homeId, residentId, fd)
        setScores(EMPTY)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map(k => (
          <div key={k} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground capitalize">
              {k.replace(/_score$/, '').replace(/_/g, ' ')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {SCORE_LABELS[k].map((label, i) => (
                <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={k}
                    value={i}
                    checked={scores[k] === i}
                    onChange={() => setScores(prev => ({ ...prev, [k]: i }))}
                    className="sr-only"
                  />
                  <span className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    scores[k] === i
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden fields for server action */}
      {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map(k => (
        <input key={k} type="hidden" name={k} value={scores[k]} />
      ))}

      <div className="flex items-end gap-4 pt-2 border-t">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Assessment date</label>
          <input
            type="date"
            name="assessment_date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Calculated band: </span>
          <span className={`font-semibold ${bandTextColour(band)}`}>{BAND_LABEL[band]}</span>
        </div>

        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save assessment'}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function bandTextColour(b: string) {
  return { low: 'text-green-700', medium: 'text-yellow-700', high: 'text-orange-700', one_to_one: 'text-red-700' }[b] ?? ''
}
