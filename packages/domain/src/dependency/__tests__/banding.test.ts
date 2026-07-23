import { describe, it, expect } from 'vitest'
import { computeDependencyBand, type AssessmentScores } from '../banding'

function s(overrides: Partial<AssessmentScores> = {}): AssessmentScores {
  return {
    mobility_score: 0,
    continence_score: 0,
    cognition_score: 0,
    behaviour_score: 0,
    clinical_complexity_score: 0,
    ...overrides,
  }
}

describe('computeDependencyBand', () => {
  it('all zeros → low', () => {
    expect(computeDependencyBand(s())).toBe('low')
  })

  it('any score = 1 → medium', () => {
    expect(computeDependencyBand(s({ mobility_score: 1 }))).toBe('medium')
    expect(computeDependencyBand(s({ cognition_score: 1 }))).toBe('medium')
    expect(computeDependencyBand(s({ behaviour_score: 1 }))).toBe('medium')
  })

  it('mobility = 3 → high', () => {
    expect(computeDependencyBand(s({ mobility_score: 3 }))).toBe('high')
  })

  it('continence = 3 → high', () => {
    expect(computeDependencyBand(s({ continence_score: 3 }))).toBe('high')
  })

  it('cognition = 3 (advanced dementia) → high', () => {
    expect(computeDependencyBand(s({ cognition_score: 3 }))).toBe('high')
  })

  it('clinical_complexity = 3 (end-of-life) → one_to_one', () => {
    expect(computeDependencyBand(s({ clinical_complexity_score: 3 }))).toBe('one_to_one')
  })

  it('behaviour = 3 (high-risk) → one_to_one', () => {
    expect(computeDependencyBand(s({ behaviour_score: 3 }))).toBe('one_to_one')
  })

  it('one_to_one overrides high — clinical_complexity=3 + mobility=3 → one_to_one', () => {
    expect(computeDependencyBand(s({ clinical_complexity_score: 3, mobility_score: 3 }))).toBe('one_to_one')
  })

  it('AT-3: hoist required (2) + moderate dementia (2) → high? No — high requires score=3', () => {
    // Scores of 2 are elevated but not max — result is medium
    expect(computeDependencyBand(s({ mobility_score: 2, cognition_score: 2 }))).toBe('medium')
  })

  it('mixed high-dimension scores: continence=2, behaviour=2, clinical=2 → medium', () => {
    expect(computeDependencyBand(s({ continence_score: 2, behaviour_score: 2, clinical_complexity_score: 2 }))).toBe('medium')
  })
})
