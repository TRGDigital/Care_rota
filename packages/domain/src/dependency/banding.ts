export type DependencyBand = 'low' | 'medium' | 'high' | 'one_to_one'

export type AssessmentScores = {
  mobility_score: number           // 0 Independent → 3 Fully dependent
  continence_score: number         // 0 Continent    → 3 Doubly incontinent
  cognition_score: number          // 0 Oriented     → 3 Advanced dementia
  behaviour_score: number          // 0 Settled      → 3 High-risk
  clinical_complexity_score: number // 0 Stable      → 3 End-of-life / one-to-one
}

/**
 * Deterministic roll-up of five 0–3 assessment scores into an overall band.
 *
 * Rules (applied in order — first match wins):
 *   one_to_one : clinical_complexity = 3  OR  behaviour = 3
 *   high       : any score = 3  (mobility, continence, cognition)
 *   medium     : any score ≥ 1
 *   low        : all scores = 0
 */
export function computeDependencyBand(scores: AssessmentScores): DependencyBand {
  const { mobility_score, continence_score, cognition_score, behaviour_score, clinical_complexity_score } = scores

  if (clinical_complexity_score === 3 || behaviour_score === 3) return 'one_to_one'
  if (mobility_score === 3 || continence_score === 3 || cognition_score === 3) return 'high'

  const anyElevated =
    mobility_score > 0 || continence_score > 0 || cognition_score > 0 ||
    behaviour_score > 0 || clinical_complexity_score > 0

  return anyElevated ? 'medium' : 'low'
}

export const SCORE_LABELS: Record<keyof AssessmentScores, readonly string[]> = {
  mobility_score:            ['Independent', 'Needs assistance', 'Hoist required', 'Fully dependent'],
  continence_score:          ['Continent', 'Occasional incontinence', 'Urinary incontinent', 'Doubly incontinent'],
  cognition_score:           ['Oriented', 'Mild confusion', 'Moderate dementia', 'Advanced dementia'],
  behaviour_score:           ['Settled', 'Occasional agitation', 'Frequent agitation', 'High-risk'],
  clinical_complexity_score: ['Stable', 'Some clinical needs', 'Complex', 'End-of-life / one-to-one'],
}

export const BAND_LABEL: Record<DependencyBand, string> = {
  low:        'Low',
  medium:     'Medium',
  high:       'High',
  one_to_one: 'One-to-one',
}
