import type { RoleCode } from '@carerota/types'

export type OverrideAuthorisation = {
  rolesPermitted: RoleCode[]
  coSignRequired: boolean
  ownerDigest?: boolean            // notify owner after override
  sevenDayRetrainPrompt?: boolean  // surface a reminder to book retraining
}

export const OVERRIDE_AUTHORISATION: Record<string, OverrideAuthorisation> = {
  // Working Time Regulations
  wtr_11hr_rest: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
  },
  wtr_48hr_weekly: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: false,
    ownerDigest: true,
  },
  wtr_night_shift_limit: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: false,
  },

  // Training expiry
  training_expired_safeguarding: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_fire_safety: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_manual_handling: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_infection_control: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_medication: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_dementia: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_first_aid: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },
  training_expired_dols: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: false,
    sevenDayRetrainPrompt: true,
  },

  // Right to Work / Sponsorship
  rtw_expired: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: true,
    ownerDigest: true,
  },
  sponsorship_hours_floor: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: true,
    ownerDigest: true,
  },
  sponsorship_visa_expiry: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: true,
    ownerDigest: true,
  },

  // Payroll
  nmw_floor_breach: {
    rolesPermitted: ['registered_manager'],
    coSignRequired: true,
    ownerDigest: true,
  },

  // Scheduling preferences
  pattern_preference_mismatch: {
    rolesPermitted: ['registered_manager', 'deputy_manager'],
    coSignRequired: false,
  },
}
