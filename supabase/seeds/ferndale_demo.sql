-- ============================================================
-- Ferndale Nursing Home — Demo seed
-- Covers Week 3 April (03–09 Apr 2026) and Week 3 May (01–07 May 2026)
-- Apply: supabase db execute --file supabase/seeds/ferndale_demo.sql
-- ============================================================

-- Helper: insert one shift_slot + one assigned shift in a single call.
CREATE OR REPLACE FUNCTION _seed_shift(
  p_home  uuid,
  p_rota  uuid,
  p_date  date,
  p_tpl   uuid,
  p_role  text,
  p_staff uuid,
  p_start timestamptz,
  p_end   timestamptz,
  p_paid  numeric,
  p_bh    boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_slot uuid;
BEGIN
  INSERT INTO shift_slots (
    tenant_id, home_id, rota_period_id, date,
    shift_pattern_template_id, role_code, headcount_required
  ) VALUES (
    p_home, p_home, p_rota, p_date, p_tpl, p_role, 1
  ) RETURNING id INTO v_slot;

  INSERT INTO shifts (
    tenant_id, home_id, shift_slot_id, staff_id, state,
    planned_start_utc, planned_end_utc,
    planned_break_minutes, planned_paid_hours, is_bank_holiday
  ) VALUES (
    p_home, p_home, v_slot, p_staff, 'assigned',
    p_start, p_end, 0, p_paid, p_bh
  );
END;
$$;

DO $$
DECLARE
  -- Org / home / user
  v_org  uuid;
  v_home uuid;
  v_usr  uuid;

  -- Shift pattern templates
  t_ld uuid;  -- Long Day      07:00–20:15  12.50h
  t_am uuid;  -- Morning       07:00–14:15   6.75h
  t_pm uuid;  -- Afternoon     14:00–20:15   6.25h
  t_nt uuid;  -- Night         20:15–08:15  12.00h
  t_ev uuid;  -- Evening 2h    17:00–19:00   2.00h
  t_of uuid;  -- Office Hours  09:00–17:00   7.50h
  t_sl uuid;  -- Senior Long   09:00–20:15  10.50h
  t_sm uuid;  -- Senior Morn   09:00–14:15   5.25h
  t_ac uuid;  -- Activities    08:00–15:00   7.00h
  t_ah uuid;  -- Activ Half    08:00–13:00   5.00h
  t_dm uuid;  -- Domestic      08:00–14:15   6.25h
  t_ch uuid;  -- Chef          07:00–16:00   8.50h
  t_ck uuid;  -- Cook          07:00–15:00   7.50h
  t_ad uuid;  -- Admin Morn    09:00–14:00   5.00h

  -- Staff — Registered Nurses
  s_mannick       uuid;
  s_d_mannick     uuid;
  s_ramkhelawon   uuid;
  s_varghese      uuid;
  s_sony          uuid;
  s_paul          uuid;
  s_mahadeo       uuid;

  -- Staff — Senior Care Assistants
  s_peter         uuid;
  s_jacob         uuid;
  s_pradeep       uuid;
  s_janardhanan   uuid;
  s_panchal       uuid;
  s_sanel         uuid;
  s_johnson       uuid;
  s_pallat        uuid;

  -- Staff — Care Assistants
  s_jammeh        uuid;
  s_antony        uuid;
  s_james         uuid;
  s_ruvetsa       uuid;
  s_bwenene       uuid;
  s_woodcock      uuid;

  -- Staff — Other
  s_murray        uuid;
  s_arbery        uuid;
  s_ellett        uuid;
  s_razdan        uuid;
  s_gomes         uuid;
  s_sophie        uuid;
  s_bancal        uuid;
  s_hettiar       uuid;
  s_smith         uuid;

  -- Rota periods
  r_apr uuid;
  r_may uuid;

  -- Training topics
  tt_fire  uuid;
  tt_mh    uuid;
  tt_fa    uuid;
  tt_food  uuid;
  tt_meds  uuid;
  tt_mh2   uuid;
  tt_dem   uuid;

BEGIN
  -- ================================================================
  -- 1. ORGANISATION & HOME
  -- ================================================================
  INSERT INTO organisations (name)
  VALUES ('Ferndale Nursing Home Ltd')
  RETURNING id INTO v_org;

  INSERT INTO homes (
    organisation_id, name, address,
    registration_type, bed_capacity, time_zone,
    holiday_allocation_unit, holiday_year_start_month, bank_holiday_region
  ) VALUES (
    v_org,
    'Ferndale Nursing Home',
    '1 Ferndale Road, Streatham, London, SW16 1AA',
    'nursing', 42, 'Europe/London', 'hours', 4, 'eng_wales'
  ) RETURNING id INTO v_home;

  -- ================================================================
  -- 2. ADMIN USER  (len@crosswayscarehome.co.uk)
  -- ================================================================
  SELECT id INTO v_usr
  FROM auth.users
  WHERE email = 'len@crosswayscarehome.co.uk'
  LIMIT 1;

  IF v_usr IS NOT NULL THEN
    INSERT INTO users (id, tenant_id, organisation_id, email, name, status)
    VALUES (v_usr, v_org, v_org, 'len@crosswayscarehome.co.uk', 'Len Burgess', 'active')
    ON CONFLICT (id) DO UPDATE
      SET tenant_id = v_org, organisation_id = v_org,
          name = 'Len Burgess', status = 'active';

    INSERT INTO user_home_roles
      (tenant_id, organisation_id, user_id, home_id, role_code)
    VALUES
      (v_org, v_org, v_usr, v_home, 'registered_manager');
  ELSE
    RAISE NOTICE 'len@crosswayscarehome.co.uk not found in auth.users — skipping role grant';
  END IF;

  -- ================================================================
  -- 3. SHIFT PATTERN TEMPLATES
  -- ================================================================
  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Long Day',      '07:00', '20:15', 45, 12.50, 'long_day_12h') RETURNING id INTO t_ld;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Morning',       '07:00', '14:15', 30,  6.75, 'short_half_6h') RETURNING id INTO t_am;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Afternoon',     '14:00', '20:15',  0,  6.25, 'short_half_6h') RETURNING id INTO t_pm;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Night',         '20:15', '08:15',  0, 12.00, 'long_day_12h') RETURNING id INTO t_nt;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Evening (2h)',  '17:00', '19:00',  0,  2.00, 'custom') RETURNING id INTO t_ev;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Office Hours',  '09:00', '17:00', 30,  7.50, 'custom') RETURNING id INTO t_of;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Senior Long',   '09:00', '20:15', 45, 10.50, 'custom') RETURNING id INTO t_sl;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Senior Morning','09:00', '14:15',  0,  5.25, 'custom') RETURNING id INTO t_sm;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Activities',    '08:00', '15:00',  0,  7.00, 'custom') RETURNING id INTO t_ac;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Activities Half','08:00','13:00',  0,  5.00, 'custom') RETURNING id INTO t_ah;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Domestic',      '08:00', '14:15',  0,  6.25, 'custom') RETURNING id INTO t_dm;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Chef Shift',    '07:00', '16:00', 30,  8.50, 'custom') RETURNING id INTO t_ch;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Cook Shift',    '07:00', '15:00', 30,  7.50, 'custom') RETURNING id INTO t_ck;

  INSERT INTO shift_pattern_templates
    (tenant_id, home_id, name, start_time_local, end_time_local, break_minutes, paid_hours_decimal, length_type)
  VALUES (v_home, v_home, 'Admin Morning', '09:00', '14:00',  0,  5.00, 'custom') RETURNING id INTO t_ad;

  -- ================================================================
  -- 4. STAFF
  -- ================================================================
  -- Registered Nurses
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'I.',     'Mannick',        'active',   '2020-01-15') RETURNING id INTO s_mannick;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'D.',     'Mannick',        'active',   '2015-06-01') RETURNING id INTO s_d_mannick;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'J.D.',   'Ramkhelawon',    'active',   '2018-03-10') RETURNING id INTO s_ramkhelawon;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'B.R.',   'Varghese',       'active',   '2019-07-01') RETURNING id INTO s_varghese;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'M.',     'Sony',           'active',   '2021-02-01') RETURNING id INTO s_sony;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'B.',     'Paul',           'active',   '2020-09-01') RETURNING id INTO s_paul;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'Mahadeo','.',              'active',   '2022-05-01') RETURNING id INTO s_mahadeo;

  -- Senior Care Assistants
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'J.',     'Peter',          'active',   '2017-04-03') RETURNING id INTO s_peter;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'S.',     'Jacob',          'active',   '2018-11-12') RETURNING id INTO s_jacob;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'S.',     'Pradeep',        'active',   '2019-08-05') RETURNING id INTO s_pradeep;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'P.',     'Janardhanan',    'active',   '2020-02-17') RETURNING id INTO s_janardhanan;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'A.',     'Panchal',        'active',   '2021-06-14') RETURNING id INTO s_panchal;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'S.',     'Anel',           'active',   '2023-01-09') RETURNING id INTO s_sanel;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'B.',     'Johnson',        'active',   '2020-04-01') RETURNING id INTO s_johnson;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'N.',     'Pallat',         'active',   '2026-02-16') RETURNING id INTO s_pallat;

  -- Care Assistants
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'B.',     'Jammeh',         'active',   '2022-08-08') RETURNING id INTO s_jammeh;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'E.',     'Antony',         'on_leave', '2019-05-20') RETURNING id INTO s_antony;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'T.',     'James',          'active',   '2020-11-02') RETURNING id INTO s_james;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'A.',     'Ruvetsa',        'active',   '2021-09-13') RETURNING id INTO s_ruvetsa;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'H.',     'Bwenene',        'active',   '2022-03-07') RETURNING id INTO s_bwenene;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'G.',     'Woodcock',       'active',   '2023-06-19') RETURNING id INTO s_woodcock;

  -- Other
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'J.',     'Murray',         'active',   '2018-09-03') RETURNING id INTO s_murray;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'A.',     'Arbery',         'active',   '2020-07-06') RETURNING id INTO s_arbery;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'A.',     'Ellett',         'active',   '2019-03-11') RETURNING id INTO s_ellett;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'V.',     'Razdan',         'active',   '2021-11-22') RETURNING id INTO s_razdan;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'P.',     'Gomes',          'active',   '2022-06-13') RETURNING id INTO s_gomes;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'L.',     'Sophie',         'active',   '2017-08-21') RETURNING id INTO s_sophie;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'C.',     'Bancal',         'active',   '2019-02-04') RETURNING id INTO s_bancal;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'K.',     'Hettiarchchige', 'active',   '2023-09-25') RETURNING id INTO s_hettiar;
  INSERT INTO staff (tenant_id, home_id, first_name, last_name, status, date_started)
  VALUES (v_home, v_home, 'Aaron',  'Smith',          'active',   '2022-01-10') RETURNING id INTO s_smith;

  -- ================================================================
  -- 5. CONTRACTS  (contracted_hours_per_week, holiday_entitlement_value in hours)
  -- ================================================================
  INSERT INTO staff_contracts (tenant_id, home_id, staff_id, contract_type, contracted_hours_per_week, shift_pattern_preference, holiday_entitlement_value, effective_from)
  VALUES
    (v_home, v_home, s_mannick,     'full_time', 37.5, 'day_only',   224.0, '2020-01-15'),
    (v_home, v_home, s_d_mannick,   'full_time', 37.5, 'day_only',   224.0, '2015-06-01'),
    (v_home, v_home, s_ramkhelawon, 'full_time', 37.5, 'day_only',   224.0, '2018-03-10'),
    (v_home, v_home, s_varghese,    'full_time', 37.5, 'day_only',   224.0, '2019-07-01'),
    (v_home, v_home, s_sony,        'full_time', 37.5, 'day_only',   224.0, '2021-02-01'),
    (v_home, v_home, s_paul,        'full_time', 37.5, 'night_only', 224.0, '2020-09-01'),
    (v_home, v_home, s_mahadeo,     'bank',       0.0, 'any',          0.0, '2022-05-01'),
    (v_home, v_home, s_peter,       'full_time', 37.5, 'day_only',   224.0, '2017-04-03'),
    (v_home, v_home, s_jacob,       'full_time', 37.5, 'day_only',   224.0, '2018-11-12'),
    (v_home, v_home, s_pradeep,     'full_time', 37.5, 'any',        224.0, '2019-08-05'),
    (v_home, v_home, s_janardhanan, 'full_time', 37.5, 'any',        224.0, '2020-02-17'),
    (v_home, v_home, s_panchal,     'full_time', 37.5, 'any',        224.0, '2021-06-14'),
    (v_home, v_home, s_sanel,       'part_time', 20.0, 'any',        120.0, '2023-01-09'),
    (v_home, v_home, s_johnson,     'full_time', 37.5, 'night_only', 224.0, '2020-04-01'),
    (v_home, v_home, s_pallat,      'part_time', 24.0, 'any',        144.0, '2026-02-16'),
    (v_home, v_home, s_jammeh,      'part_time', 24.0, 'day_only',   144.0, '2022-08-08'),
    (v_home, v_home, s_antony,      'full_time', 37.5, 'day_only',   224.0, '2019-05-20'),
    (v_home, v_home, s_james,       'part_time', 24.0, 'day_only',   144.0, '2020-11-02'),
    (v_home, v_home, s_ruvetsa,     'full_time', 37.5, 'night_only', 224.0, '2021-09-13'),
    (v_home, v_home, s_bwenene,     'part_time', 24.0, 'night_only', 144.0, '2022-03-07'),
    (v_home, v_home, s_woodcock,    'part_time', 20.0, 'night_only', 120.0, '2023-06-19'),
    (v_home, v_home, s_murray,      'full_time', 37.5, 'day_only',   224.0, '2018-09-03'),
    (v_home, v_home, s_arbery,      'part_time', 20.0, 'day_only',   120.0, '2020-07-06'),
    (v_home, v_home, s_ellett,      'part_time', 24.0, 'day_only',   144.0, '2019-03-11'),
    (v_home, v_home, s_razdan,      'part_time', 16.0, 'day_only',    96.0, '2021-11-22'),
    (v_home, v_home, s_gomes,       'part_time', 24.0, 'day_only',   144.0, '2022-06-13'),
    (v_home, v_home, s_sophie,      'full_time', 37.5, 'day_only',   224.0, '2017-08-21'),
    (v_home, v_home, s_bancal,      'part_time', 20.0, 'day_only',   120.0, '2019-02-04'),
    (v_home, v_home, s_hettiar,     'part_time', 16.0, 'day_only',    96.0, '2023-09-25'),
    (v_home, v_home, s_smith,       'part_time', 10.0, 'day_only',    60.0, '2022-01-10');

  -- ================================================================
  -- 6. PAY RATES  (pence/hour, effective April 2026)
  -- ================================================================
  INSERT INTO staff_pay_rates
    (tenant_id, home_id, staff_id, role_code,
     rate_weekday_pence, rate_weekend_pence, rate_night_pence,
     rate_overtime_pence, rate_training_pence, effective_from)
  VALUES
    -- Registered Nurses £16/hr weekday, £17.50 weekend, £18.50 night
    (v_home, v_home, s_mannick,     'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    (v_home, v_home, s_d_mannick,   'manager',          2000, 2000, 2000, 3000, 2000, '2026-04-01'),
    (v_home, v_home, s_ramkhelawon, 'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    (v_home, v_home, s_varghese,    'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    (v_home, v_home, s_sony,        'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    (v_home, v_home, s_paul,        'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    (v_home, v_home, s_mahadeo,     'registered_nurse', 1600, 1750, 1850, 2400, 1600, '2026-04-01'),
    -- Senior Carers £13.50/hr weekday, £14.50 weekend, £15.50 night
    (v_home, v_home, s_peter,       'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_jacob,       'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_pradeep,     'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_janardhanan, 'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_panchal,     'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_sanel,       'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_johnson,     'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    (v_home, v_home, s_pallat,      'senior_carer', 1350, 1450, 1550, 2025, 1350, '2026-04-01'),
    -- Care Assistants NMW £12.21/hr, £13/hr weekend, £13.50 night
    (v_home, v_home, s_jammeh,   'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_antony,   'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_james,    'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_ruvetsa,  'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_bwenene,  'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_woodcock, 'care_assistant', 1221, 1300, 1350, 1832, 1221, '2026-04-01'),
    -- Other staff
    (v_home, v_home, s_murray,   'activities', 1221, 1300, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_arbery,   'admin',      1250, 1250, 1250, 1875, 1250, '2026-04-01'),
    (v_home, v_home, s_ellett,   'chef',       1400, 1500, 1500, 2100, 1400, '2026-04-01'),
    (v_home, v_home, s_razdan,   'cook',       1221, 1300, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_gomes,    'cook',       1221, 1300, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_sophie,   'domestic',   1221, 1221, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_bancal,   'laundry',    1221, 1221, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_hettiar,  'laundry',    1221, 1221, 1221, 1832, 1221, '2026-04-01'),
    (v_home, v_home, s_smith,    'domestic',   1221, 1221, 1221, 1832, 1221, '2026-04-01');

  -- ================================================================
  -- 7. LEAVE REQUESTS  (status=approved; value in hours)
  -- ================================================================
  -- J. Peter — 4 weeks A/L (whole of April roster period: 3–30 Apr)
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_peter, 'annual', '2026-04-03', '2026-04-30', 150.0, 'approved', '2026-03-01 09:00:00Z');

  -- T. James — 4 weeks A/L same period
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_james, 'annual', '2026-04-03', '2026-04-30', 96.0, 'approved', '2026-03-01 09:00:00Z');

  -- E. Antony — Maternity (Jan–Apr 2026)
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_antony, 'maternity', '2026-01-05', '2026-04-30', 562.5, 'approved', '2025-12-01 10:00:00Z');

  -- A. Ruvetsa — A/L Week 1 of May cycle (17–23 Apr)
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_ruvetsa, 'annual', '2026-04-17', '2026-04-23', 37.5, 'approved', '2026-04-01 09:00:00Z');

  -- J.D. Ramkhelawon — A/L Fri 1 May
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_ramkhelawon, 'annual', '2026-05-01', '2026-05-01', 6.75, 'approved', '2026-04-15 09:00:00Z');

  -- J. Murray — A/L Sat 2 May
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_murray, 'annual', '2026-05-02', '2026-05-02', 7.0, 'approved', '2026-04-15 09:00:00Z');

  -- C. Bancal — A/L Tue–Thu of Week 3 Apr
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_bancal, 'annual', '2026-04-07', '2026-04-09', 15.0, 'approved', '2026-03-15 09:00:00Z');

  -- A. Arbery — A/L Fri + Mon of Week 3 Apr (Good Friday & Easter Monday)
  INSERT INTO leave_requests
    (tenant_id, home_id, staff_id, type, start_date, end_date, value_requested, status, decided_at)
  VALUES
    (v_home, v_home, s_arbery, 'annual', '2026-04-03', '2026-04-06', 10.0, 'approved', '2026-03-10 09:00:00Z');

  -- ================================================================
  -- 8. ROTA PERIODS
  -- All timestamps UTC; Apr/May 2026 = BST (local − 1h)
  -- Bank holidays: Good Friday 3 Apr, Easter Mon 6 Apr, Early May Mon 4 May
  -- ================================================================
  INSERT INTO rota_periods (tenant_id, home_id, period_start_date, period_end_date, status)
  VALUES (v_home, v_home, '2026-04-03', '2026-04-09', 'published')
  RETURNING id INTO r_apr;

  INSERT INTO rota_periods (tenant_id, home_id, period_start_date, period_end_date, status)
  VALUES (v_home, v_home, '2026-05-01', '2026-05-07', 'published')
  RETURNING id INTO r_may;

  -- ================================================================
  -- 9. SHIFTS — WEEK 3 APRIL  (BST: local = UTC+1)
  --
  -- shift_slot date  = calendar date the shift starts (local)
  -- planned_start/end = UTC timestamps
  -- Bank holiday flag: GF=03 Apr, EM=06 Apr
  -- ================================================================

  -- I. Mannick (PCM / Nurse in Charge)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_of, 'registered_nurse', s_mannick,
    '2026-04-03T08:00:00Z', '2026-04-03T16:00:00Z', 7.50, true);   -- GF 09:00–17:00
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_sl, 'registered_nurse', s_mannick,
    '2026-04-07T08:00:00Z', '2026-04-07T19:15:00Z', 10.50, false);  -- Tue 09:00–20:15
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_sm, 'registered_nurse', s_mannick,
    '2026-04-08T08:00:00Z', '2026-04-08T13:15:00Z', 5.25, false);   -- Wed 09:00–14:15
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_am, 'registered_nurse', s_mannick,
    '2026-04-09T06:00:00Z', '2026-04-09T13:15:00Z', 6.75, false);   -- Thu 07:00–14:15

  -- J.D. Ramkhelawon
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_am, 'registered_nurse', s_ramkhelawon,
    '2026-04-03T06:00:00Z', '2026-04-03T13:15:00Z', 6.75, true);    -- GF
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_am, 'registered_nurse', s_ramkhelawon,
    '2026-04-07T06:00:00Z', '2026-04-07T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ld, 'registered_nurse', s_ramkhelawon,
    '2026-04-08T06:00:00Z', '2026-04-08T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ld, 'registered_nurse', s_ramkhelawon,
    '2026-04-09T06:00:00Z', '2026-04-09T19:15:00Z', 12.50, false);

  -- B.R. Varghese  ("7-6" Sat ≈ 07:00–18:00; use ld template, actual paid=10.25h)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ld, 'registered_nurse', s_varghese,
    '2026-04-04T06:00:00Z', '2026-04-04T17:00:00Z', 10.25, false);  -- Sat 07:00–18:00
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ld, 'registered_nurse', s_varghese,
    '2026-04-05T06:00:00Z', '2026-04-05T19:15:00Z', 12.50, false);  -- Sun
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ld, 'registered_nurse', s_varghese,
    '2026-04-06T06:00:00Z', '2026-04-06T19:15:00Z', 12.50, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_am, 'registered_nurse', s_varghese,
    '2026-04-07T06:00:00Z', '2026-04-07T13:15:00Z', 6.75, false);

  -- M. Sony
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_am, 'registered_nurse', s_sony,
    '2026-04-03T06:00:00Z', '2026-04-03T13:15:00Z', 6.75, true);    -- GF
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ld, 'registered_nurse', s_sony,
    '2026-04-04T06:00:00Z', '2026-04-04T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ld, 'registered_nurse', s_sony,
    '2026-04-05T06:00:00Z', '2026-04-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ld, 'registered_nurse', s_sony,
    '2026-04-06T06:00:00Z', '2026-04-06T19:15:00Z', 12.50, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ld, 'registered_nurse', s_sony,
    '2026-04-08T06:00:00Z', '2026-04-08T19:15:00Z', 12.50, false);

  -- S. Jacob (Senior Carer)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ld, 'senior_carer', s_jacob,
    '2026-04-03T06:00:00Z', '2026-04-03T19:15:00Z', 12.50, true);   -- GF
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ld, 'senior_carer', s_jacob,
    '2026-04-05T06:00:00Z', '2026-04-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ld, 'senior_carer', s_jacob,
    '2026-04-06T06:00:00Z', '2026-04-06T19:15:00Z', 12.50, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ld, 'senior_carer', s_jacob,
    '2026-04-07T06:00:00Z', '2026-04-07T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ld, 'senior_carer', s_jacob,
    '2026-04-08T06:00:00Z', '2026-04-08T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ld, 'senior_carer', s_jacob,
    '2026-04-09T06:00:00Z', '2026-04-09T19:15:00Z', 12.50, false);

  -- B. Jammeh (Care Assistant)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ld, 'care_assistant', s_jammeh,
    '2026-04-03T06:00:00Z', '2026-04-03T19:15:00Z', 12.50, true);   -- GF
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ld, 'care_assistant', s_jammeh,
    '2026-04-06T06:00:00Z', '2026-04-06T19:15:00Z', 12.50, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ld, 'care_assistant', s_jammeh,
    '2026-04-08T06:00:00Z', '2026-04-08T19:15:00Z', 12.50, false);

  -- S. Pradeep (Senior Carer)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_pm, 'senior_carer', s_pradeep,
    '2026-04-03T13:00:00Z', '2026-04-03T19:15:00Z', 6.25, true);    -- GF 14:00–20:15
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ld, 'senior_carer', s_pradeep,
    '2026-04-04T06:00:00Z', '2026-04-04T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ld, 'senior_carer', s_pradeep,
    '2026-04-05T06:00:00Z', '2026-04-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_pm, 'senior_carer', s_pradeep,
    '2026-04-07T13:00:00Z', '2026-04-07T19:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_pm, 'senior_carer', s_pradeep,
    '2026-04-08T13:00:00Z', '2026-04-08T19:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ld, 'senior_carer', s_pradeep,
    '2026-04-09T06:00:00Z', '2026-04-09T19:15:00Z', 12.50, false);

  -- P. Janardhanan (Senior Carer)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_pm, 'senior_carer', s_janardhanan,
    '2026-04-03T13:00:00Z', '2026-04-03T19:15:00Z', 6.25, true);    -- GF
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ld, 'senior_carer', s_janardhanan,
    '2026-04-04T06:00:00Z', '2026-04-04T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ld, 'senior_carer', s_janardhanan,
    '2026-04-05T06:00:00Z', '2026-04-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ld, 'senior_carer', s_janardhanan,
    '2026-04-07T06:00:00Z', '2026-04-07T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ld, 'senior_carer', s_janardhanan,
    '2026-04-08T06:00:00Z', '2026-04-08T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_am, 'senior_carer', s_janardhanan,
    '2026-04-09T06:00:00Z', '2026-04-09T09:00:00Z', 3.00, false);   -- Thu 07:00–10:00 partial

  -- A. Panchal (Senior Carer)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ld, 'senior_carer', s_panchal,
    '2026-04-06T06:00:00Z', '2026-04-06T19:15:00Z', 12.50, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ld, 'senior_carer', s_panchal,
    '2026-04-07T06:00:00Z', '2026-04-07T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ld, 'senior_carer', s_panchal,
    '2026-04-09T06:00:00Z', '2026-04-09T19:15:00Z', 12.50, false);

  -- S. Anel (Senior Carer) — Friday only visible in this week
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ld, 'senior_carer', s_sanel,
    '2026-04-03T06:00:00Z', '2026-04-03T19:15:00Z', 12.50, true);   -- GF

  -- ── Night staff — April ─────────────────────────────────────────

  -- B. Paul (S/N nights): off Fri, Sat–Thu nights
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_nt, 'registered_nurse', s_paul,
    '2026-04-04T19:15:00Z', '2026-04-05T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_nt, 'registered_nurse', s_paul,
    '2026-04-05T19:15:00Z', '2026-04-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_nt, 'registered_nurse', s_paul,
    '2026-04-06T19:15:00Z', '2026-04-07T07:15:00Z', 12.00, true);   -- EM night
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_nt, 'registered_nurse', s_paul,
    '2026-04-07T19:15:00Z', '2026-04-08T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_nt, 'registered_nurse', s_paul,
    '2026-04-08T19:15:00Z', '2026-04-09T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_nt, 'registered_nurse', s_paul,
    '2026-04-09T19:15:00Z', '2026-04-10T07:15:00Z', 12.00, false);

  -- Mahadeo (bank S/N): 1 night (Mon)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_nt, 'registered_nurse', s_mahadeo,
    '2026-04-06T19:15:00Z', '2026-04-07T07:15:00Z', 12.00, true);   -- EM

  -- B. Johnson (Senior Carer nights): Fri–Wed (6 nights)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_nt, 'senior_carer', s_johnson,
    '2026-04-03T19:15:00Z', '2026-04-04T07:15:00Z', 12.00, true);   -- GF night
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_nt, 'senior_carer', s_johnson,
    '2026-04-04T19:15:00Z', '2026-04-05T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_nt, 'senior_carer', s_johnson,
    '2026-04-05T19:15:00Z', '2026-04-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_nt, 'senior_carer', s_johnson,
    '2026-04-06T19:15:00Z', '2026-04-07T07:15:00Z', 12.00, true);   -- EM
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_nt, 'senior_carer', s_johnson,
    '2026-04-07T19:15:00Z', '2026-04-08T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_nt, 'senior_carer', s_johnson,
    '2026-04-08T19:15:00Z', '2026-04-09T07:15:00Z', 12.00, false);

  -- A. Ruvetsa (C/A nights): Fri–Mon (4 nights)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_nt, 'care_assistant', s_ruvetsa,
    '2026-04-03T19:15:00Z', '2026-04-04T07:15:00Z', 12.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_nt, 'care_assistant', s_ruvetsa,
    '2026-04-04T19:15:00Z', '2026-04-05T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_nt, 'care_assistant', s_ruvetsa,
    '2026-04-05T19:15:00Z', '2026-04-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_nt, 'care_assistant', s_ruvetsa,
    '2026-04-06T19:15:00Z', '2026-04-07T07:15:00Z', 12.00, true);

  -- H. Bwenene (C/A nights): Sat–Mon (3 nights)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_nt, 'care_assistant', s_bwenene,
    '2026-04-04T19:15:00Z', '2026-04-05T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_nt, 'care_assistant', s_bwenene,
    '2026-04-05T19:15:00Z', '2026-04-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_nt, 'care_assistant', s_bwenene,
    '2026-04-06T19:15:00Z', '2026-04-07T07:15:00Z', 12.00, true);

  -- G. Woodcock (C/A nights): Fri–Sat (2 nights)
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_nt, 'care_assistant', s_woodcock,
    '2026-04-03T19:15:00Z', '2026-04-04T07:15:00Z', 12.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_nt, 'care_assistant', s_woodcock,
    '2026-04-04T19:15:00Z', '2026-04-05T07:15:00Z', 12.00, false);

  -- ── Other staff — April ──────────────────────────────────────────

  -- J. Murray (Activities) — 6 shifts, Sun off
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ac, 'activities', s_murray,
    '2026-04-03T07:00:00Z', '2026-04-03T14:00:00Z', 7.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ah, 'activities', s_murray,
    '2026-04-04T07:00:00Z', '2026-04-04T12:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ac, 'activities', s_murray,
    '2026-04-06T07:00:00Z', '2026-04-06T14:00:00Z', 7.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ac, 'activities', s_murray,
    '2026-04-07T07:00:00Z', '2026-04-07T14:00:00Z', 7.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ac, 'activities', s_murray,
    '2026-04-08T07:00:00Z', '2026-04-08T14:00:00Z', 7.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ac, 'activities', s_murray,
    '2026-04-09T07:00:00Z', '2026-04-09T14:00:00Z', 7.00, false);

  -- A. Arbery (Admin) — on A/L Fri & Mon; works Tue–Thu
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ad, 'admin', s_arbery,
    '2026-04-07T07:30:00Z', '2026-04-07T13:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ad, 'admin', s_arbery,
    '2026-04-08T08:00:00Z', '2026-04-08T13:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ad, 'admin', s_arbery,
    '2026-04-09T08:00:00Z', '2026-04-09T12:00:00Z', 4.00, false);

  -- A. Ellett (Chef) — Fri, Sat, Sun
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ch, 'chef', s_ellett,
    '2026-04-03T06:00:00Z', '2026-04-03T15:00:00Z', 8.50, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_ch, 'chef', s_ellett,
    '2026-04-04T06:00:00Z', '2026-04-04T15:00:00Z', 8.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-05', t_ch, 'chef', s_ellett,
    '2026-04-05T06:00:00Z', '2026-04-05T15:00:00Z', 8.50, false);

  -- P. Gomes (Cook) — Mon–Thu
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ck, 'cook', s_gomes,
    '2026-04-06T06:00:00Z', '2026-04-06T14:00:00Z', 7.50, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ck, 'cook', s_gomes,
    '2026-04-07T06:00:00Z', '2026-04-07T14:00:00Z', 7.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ck, 'cook', s_gomes,
    '2026-04-08T06:00:00Z', '2026-04-08T14:00:00Z', 7.50, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ck, 'cook', s_gomes,
    '2026-04-09T06:00:00Z', '2026-04-09T14:00:00Z', 7.50, false);

  -- L. Sophie (Cleaner) — 6 days, Sun off
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_dm, 'domestic', s_sophie,
    '2026-04-03T07:00:00Z', '2026-04-03T13:15:00Z', 6.25, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_dm, 'domestic', s_sophie,
    '2026-04-04T07:00:00Z', '2026-04-04T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_dm, 'domestic', s_sophie,
    '2026-04-06T07:00:00Z', '2026-04-06T13:15:00Z', 6.25, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_dm, 'domestic', s_sophie,
    '2026-04-07T07:00:00Z', '2026-04-07T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_dm, 'domestic', s_sophie,
    '2026-04-08T07:00:00Z', '2026-04-08T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_dm, 'domestic', s_sophie,
    '2026-04-09T07:00:00Z', '2026-04-09T13:15:00Z', 6.25, false);

  -- C. Bancal (Laundry) — Fri & Mon; Tue–Thu on A/L
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_ah, 'laundry', s_bancal,
    '2026-04-03T07:00:00Z', '2026-04-03T12:00:00Z', 5.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ah, 'laundry', s_bancal,
    '2026-04-06T07:00:00Z', '2026-04-06T12:00:00Z', 5.00, true);

  -- K. Hettiarchchige (Laundry) — Fri & Sat
  PERFORM _seed_shift(v_home, r_apr, '2026-04-03', t_dm, 'laundry', s_hettiar,
    '2026-04-03T07:00:00Z', '2026-04-03T13:15:00Z', 6.25, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-04', t_dm, 'laundry', s_hettiar,
    '2026-04-04T07:00:00Z', '2026-04-04T13:15:00Z', 6.25, false);

  -- Aaron Smith (Wash-up / Evening) — Mon–Thu 17:00–19:00
  PERFORM _seed_shift(v_home, r_apr, '2026-04-06', t_ev, 'domestic', s_smith,
    '2026-04-06T16:00:00Z', '2026-04-06T18:00:00Z', 2.00, true);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-07', t_ev, 'domestic', s_smith,
    '2026-04-07T16:00:00Z', '2026-04-07T18:00:00Z', 2.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-08', t_ev, 'domestic', s_smith,
    '2026-04-08T16:00:00Z', '2026-04-08T18:00:00Z', 2.00, false);
  PERFORM _seed_shift(v_home, r_apr, '2026-04-09', t_ev, 'domestic', s_smith,
    '2026-04-09T16:00:00Z', '2026-04-09T18:00:00Z', 2.00, false);

  -- ================================================================
  -- 10. SHIFTS — WEEK 3 MAY  (BST: local = UTC+1)
  -- Bank holiday: Early May = Mon 04 May
  -- ================================================================

  -- I. Mannick — Fri–Mon mornings (07:00–14:15)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_am, 'registered_nurse', s_mannick,
    '2026-05-01T06:00:00Z', '2026-05-01T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_am, 'registered_nurse', s_mannick,
    '2026-05-02T06:00:00Z', '2026-05-02T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_am, 'registered_nurse', s_mannick,
    '2026-05-03T06:00:00Z', '2026-05-03T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_am, 'registered_nurse', s_mannick,
    '2026-05-04T06:00:00Z', '2026-05-04T13:15:00Z', 6.75, true);    -- Early May BH

  -- J.D. Ramkhelawon — on A/L Fri; works Tue–Thu
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_am, 'registered_nurse', s_ramkhelawon,
    '2026-05-05T06:00:00Z', '2026-05-05T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ld, 'registered_nurse', s_ramkhelawon,
    '2026-05-06T06:00:00Z', '2026-05-06T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'registered_nurse', s_ramkhelawon,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- B.R. Varghese — Fri morning, Sun & Mon BH long day
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_am, 'registered_nurse', s_varghese,
    '2026-05-01T06:00:00Z', '2026-05-01T13:15:00Z', 6.75, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'registered_nurse', s_varghese,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ld, 'registered_nurse', s_varghese,
    '2026-05-04T06:00:00Z', '2026-05-04T19:15:00Z', 12.50, true);

  -- M. Sony — Fri, Sat, Sun, Tue long days
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ld, 'registered_nurse', s_sony,
    '2026-05-01T06:00:00Z', '2026-05-01T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ld, 'registered_nurse', s_sony,
    '2026-05-02T06:00:00Z', '2026-05-02T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'registered_nurse', s_sony,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ld, 'registered_nurse', s_sony,
    '2026-05-05T06:00:00Z', '2026-05-05T19:15:00Z', 12.50, false);

  -- J. Peter — all 7 days (returned from A/L)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ld, 'senior_carer', s_peter,
    '2026-05-01T06:00:00Z', '2026-05-01T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ld, 'senior_carer', s_peter,
    '2026-05-02T06:00:00Z', '2026-05-02T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'senior_carer', s_peter,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ld, 'senior_carer', s_peter,
    '2026-05-04T06:00:00Z', '2026-05-04T19:15:00Z', 12.50, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_pm, 'senior_carer', s_peter,
    '2026-05-05T13:00:00Z', '2026-05-05T19:15:00Z', 6.25, false);   -- Tue 14:00–20:15
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ld, 'senior_carer', s_peter,
    '2026-05-06T06:00:00Z', '2026-05-06T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'senior_carer', s_peter,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- S. Jacob
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ld, 'senior_carer', s_jacob,
    '2026-05-01T06:00:00Z', '2026-05-01T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ld, 'senior_carer', s_jacob,
    '2026-05-04T06:00:00Z', '2026-05-04T19:15:00Z', 12.50, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ld, 'senior_carer', s_jacob,
    '2026-05-05T06:00:00Z', '2026-05-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ld, 'senior_carer', s_jacob,
    '2026-05-06T06:00:00Z', '2026-05-06T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'senior_carer', s_jacob,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- B. Jammeh
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ld, 'care_assistant', s_jammeh,
    '2026-05-04T06:00:00Z', '2026-05-04T19:15:00Z', 12.50, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ld, 'care_assistant', s_jammeh,
    '2026-05-06T06:00:00Z', '2026-05-06T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'care_assistant', s_jammeh,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- E. Antony — returned from maternity; Fri–Sun only
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ld, 'care_assistant', s_antony,
    '2026-05-01T06:00:00Z', '2026-05-01T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ld, 'care_assistant', s_antony,
    '2026-05-02T06:00:00Z', '2026-05-02T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'care_assistant', s_antony,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);

  -- S. Pradeep
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ld, 'senior_carer', s_pradeep,
    '2026-05-04T06:00:00Z', '2026-05-04T19:15:00Z', 12.50, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ld, 'senior_carer', s_pradeep,
    '2026-05-06T06:00:00Z', '2026-05-06T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'senior_carer', s_pradeep,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- N. Pallat (new starter, P/T)
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ld, 'senior_carer', s_pallat,
    '2026-05-02T06:00:00Z', '2026-05-02T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'senior_carer', s_pallat,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ld, 'senior_carer', s_pallat,
    '2026-05-05T06:00:00Z', '2026-05-05T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ld, 'senior_carer', s_pallat,
    '2026-05-07T06:00:00Z', '2026-05-07T19:15:00Z', 12.50, false);

  -- A. Panchal
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_pm, 'senior_carer', s_panchal,
    '2026-05-01T13:00:00Z', '2026-05-01T19:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ld, 'senior_carer', s_panchal,
    '2026-05-02T06:00:00Z', '2026-05-02T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ld, 'senior_carer', s_panchal,
    '2026-05-03T06:00:00Z', '2026-05-03T19:15:00Z', 12.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ld, 'senior_carer', s_panchal,
    '2026-05-05T06:00:00Z', '2026-05-05T19:15:00Z', 12.50, false);

  -- ── Night staff — May ───────────────────────────────────────────

  -- B. Paul: off Fri, Sat–Thu nights
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_nt, 'registered_nurse', s_paul,
    '2026-05-02T19:15:00Z', '2026-05-03T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_nt, 'registered_nurse', s_paul,
    '2026-05-03T19:15:00Z', '2026-05-04T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_nt, 'registered_nurse', s_paul,
    '2026-05-04T19:15:00Z', '2026-05-05T07:15:00Z', 12.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_nt, 'registered_nurse', s_paul,
    '2026-05-05T19:15:00Z', '2026-05-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_nt, 'registered_nurse', s_paul,
    '2026-05-06T19:15:00Z', '2026-05-07T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_nt, 'registered_nurse', s_paul,
    '2026-05-07T19:15:00Z', '2026-05-08T07:15:00Z', 12.00, false);

  -- Mahadeo: Mon night
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_nt, 'registered_nurse', s_mahadeo,
    '2026-05-04T19:15:00Z', '2026-05-05T07:15:00Z', 12.00, true);

  -- B. Johnson: Fri–Wed (6 nights)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_nt, 'senior_carer', s_johnson,
    '2026-05-01T19:15:00Z', '2026-05-02T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_nt, 'senior_carer', s_johnson,
    '2026-05-02T19:15:00Z', '2026-05-03T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_nt, 'senior_carer', s_johnson,
    '2026-05-03T19:15:00Z', '2026-05-04T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_nt, 'senior_carer', s_johnson,
    '2026-05-04T19:15:00Z', '2026-05-05T07:15:00Z', 12.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_nt, 'senior_carer', s_johnson,
    '2026-05-05T19:15:00Z', '2026-05-06T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_nt, 'senior_carer', s_johnson,
    '2026-05-06T19:15:00Z', '2026-05-07T07:15:00Z', 12.00, false);

  -- A. Ruvetsa: Fri–Mon (4 nights)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_nt, 'care_assistant', s_ruvetsa,
    '2026-05-01T19:15:00Z', '2026-05-02T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_nt, 'care_assistant', s_ruvetsa,
    '2026-05-02T19:15:00Z', '2026-05-03T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_nt, 'care_assistant', s_ruvetsa,
    '2026-05-03T19:15:00Z', '2026-05-04T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_nt, 'care_assistant', s_ruvetsa,
    '2026-05-04T19:15:00Z', '2026-05-05T07:15:00Z', 12.00, true);

  -- H. Bwenene: Sat–Mon (3 nights)
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_nt, 'care_assistant', s_bwenene,
    '2026-05-02T19:15:00Z', '2026-05-03T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_nt, 'care_assistant', s_bwenene,
    '2026-05-03T19:15:00Z', '2026-05-04T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_nt, 'care_assistant', s_bwenene,
    '2026-05-04T19:15:00Z', '2026-05-05T07:15:00Z', 12.00, true);

  -- G. Woodcock: Fri–Sat (2 nights)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_nt, 'care_assistant', s_woodcock,
    '2026-05-01T19:15:00Z', '2026-05-02T07:15:00Z', 12.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_nt, 'care_assistant', s_woodcock,
    '2026-05-02T19:15:00Z', '2026-05-03T07:15:00Z', 12.00, false);

  -- ── Other staff — May ───────────────────────────────────────────

  -- J. Murray (A/L Sat, off Sun)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ac, 'activities', s_murray,
    '2026-05-01T07:00:00Z', '2026-05-01T14:00:00Z', 7.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ac, 'activities', s_murray,
    '2026-05-04T07:00:00Z', '2026-05-04T14:00:00Z', 7.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ac, 'activities', s_murray,
    '2026-05-05T07:00:00Z', '2026-05-05T14:00:00Z', 7.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ac, 'activities', s_murray,
    '2026-05-06T07:00:00Z', '2026-05-06T14:00:00Z', 7.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ac, 'activities', s_murray,
    '2026-05-07T07:00:00Z', '2026-05-07T14:00:00Z', 7.00, false);

  -- A. Arbery
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ad, 'admin', s_arbery,
    '2026-05-01T08:00:00Z', '2026-05-01T14:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ad, 'admin', s_arbery,
    '2026-05-04T08:00:00Z', '2026-05-04T14:00:00Z', 5.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ad, 'admin', s_arbery,
    '2026-05-05T08:00:00Z', '2026-05-05T12:00:00Z', 4.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ad, 'admin', s_arbery,
    '2026-05-06T08:00:00Z', '2026-05-06T13:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ad, 'admin', s_arbery,
    '2026-05-07T08:00:00Z', '2026-05-07T12:00:00Z', 4.00, false);

  -- A. Ellett (Chef) — Fri, Sat, Sun
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ch, 'chef', s_ellett,
    '2026-05-01T06:00:00Z', '2026-05-01T15:00:00Z', 8.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_ch, 'chef', s_ellett,
    '2026-05-02T06:00:00Z', '2026-05-02T15:00:00Z', 8.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-03', t_ch, 'chef', s_ellett,
    '2026-05-03T06:00:00Z', '2026-05-03T15:00:00Z', 8.50, false);

  -- P. Gomes (Cook) — Mon–Thu
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ck, 'cook', s_gomes,
    '2026-05-04T06:00:00Z', '2026-05-04T14:00:00Z', 7.50, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ck, 'cook', s_gomes,
    '2026-05-05T06:00:00Z', '2026-05-05T14:00:00Z', 7.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ck, 'cook', s_gomes,
    '2026-05-06T06:00:00Z', '2026-05-06T14:00:00Z', 7.50, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ck, 'cook', s_gomes,
    '2026-05-07T06:00:00Z', '2026-05-07T14:00:00Z', 7.50, false);

  -- L. Sophie (Cleaner)
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_dm, 'domestic', s_sophie,
    '2026-05-01T07:00:00Z', '2026-05-01T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-02', t_dm, 'domestic', s_sophie,
    '2026-05-02T07:00:00Z', '2026-05-02T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_dm, 'domestic', s_sophie,
    '2026-05-04T07:00:00Z', '2026-05-04T13:15:00Z', 6.25, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_dm, 'domestic', s_sophie,
    '2026-05-05T07:00:00Z', '2026-05-05T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_dm, 'domestic', s_sophie,
    '2026-05-06T07:00:00Z', '2026-05-06T13:15:00Z', 6.25, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_dm, 'domestic', s_sophie,
    '2026-05-07T07:00:00Z', '2026-05-07T13:15:00Z', 6.25, false);

  -- C. Bancal (Laundry) — Fri + Mon–Thu
  PERFORM _seed_shift(v_home, r_may, '2026-05-01', t_ah, 'laundry', s_bancal,
    '2026-05-01T07:00:00Z', '2026-05-01T12:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ah, 'laundry', s_bancal,
    '2026-05-04T07:00:00Z', '2026-05-04T12:00:00Z', 5.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ah, 'laundry', s_bancal,
    '2026-05-05T07:00:00Z', '2026-05-05T12:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ah, 'laundry', s_bancal,
    '2026-05-06T07:00:00Z', '2026-05-06T12:00:00Z', 5.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ah, 'laundry', s_bancal,
    '2026-05-07T07:00:00Z', '2026-05-07T12:00:00Z', 5.00, false);

  -- Aaron Smith — Mon–Thu evenings
  PERFORM _seed_shift(v_home, r_may, '2026-05-04', t_ev, 'domestic', s_smith,
    '2026-05-04T16:00:00Z', '2026-05-04T18:00:00Z', 2.00, true);
  PERFORM _seed_shift(v_home, r_may, '2026-05-05', t_ev, 'domestic', s_smith,
    '2026-05-05T16:00:00Z', '2026-05-05T18:00:00Z', 2.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-06', t_ev, 'domestic', s_smith,
    '2026-05-06T16:00:00Z', '2026-05-06T18:00:00Z', 2.00, false);
  PERFORM _seed_shift(v_home, r_may, '2026-05-07', t_ev, 'domestic', s_smith,
    '2026-05-07T16:00:00Z', '2026-05-07T18:00:00Z', 2.00, false);

  -- ================================================================
  -- 11. BED OCCUPANCY SNAPSHOT  (for owner dashboard + cost guard)
  -- ================================================================
  INSERT INTO bed_occupancy_snapshots
    (tenant_id, home_id, snapshot_at, occupied_beds, vacant_beds,
     expected_admissions_next_7_days, expected_discharges_next_7_days)
  VALUES
    (v_home, v_home, '2026-05-13T08:00:00Z', 37, 5, 2, 1);

  -- ================================================================
  -- 12. RESIDENTS + DEPENDENCY ASSESSMENTS
  -- Insert 37 residents then assess each using row_number from the table.
  -- ================================================================
  INSERT INTO residents
    (tenant_id, home_id, first_name, last_name_initial, room_number,
     admission_date, source)
  SELECT
    v_home, v_home,
    'Resident ' || n,
    chr(64 + ((n - 1) % 26 + 1)),
    n::text,
    '2026-05-01'::date - (n * 30)::int,
    'carerota_native'
  FROM generate_series(1, 37) AS n;

  INSERT INTO dependency_assessments
    (tenant_id, home_id, resident_id, assessment_date,
     mobility_score, continence_score, cognition_score,
     behaviour_score, clinical_complexity_score, overall_band)
  SELECT
    v_home, v_home,
    r.id,
    '2026-05-01',
    CASE rn % 3 WHEN 0 THEN 4 WHEN 1 THEN 2 ELSE 1 END,
    CASE rn % 3 WHEN 0 THEN 4 WHEN 1 THEN 3 ELSE 1 END,
    CASE rn % 3 WHEN 0 THEN 4 WHEN 1 THEN 2 ELSE 1 END,
    CASE rn % 3 WHEN 0 THEN 3 WHEN 1 THEN 2 ELSE 1 END,
    CASE rn % 3 WHEN 0 THEN 4 WHEN 1 THEN 2 ELSE 1 END,
    CASE
      WHEN rn <= 12 THEN 'high'
      WHEN rn <= 27 THEN 'medium'
      ELSE 'low'
    END
  FROM (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM residents
    WHERE home_id = v_home
  ) r;

  -- ================================================================
  -- 13. STAFFING MATRIX  (for cost guard: min headcount per shift block)
  -- ================================================================
  INSERT INTO staffing_matrices
    (tenant_id, home_id, name, shift_block,
     low_dep_threshold, medium_dep_threshold, high_dep_threshold, one_to_one_factor,
     min_carers, min_senior_carers, min_nurses, min_ancillary)
  VALUES
    (v_home, v_home, 'Morning Matrix',   'morning',   8, 15, 25, 1.00, 3, 1, 1, 0),
    (v_home, v_home, 'Afternoon Matrix', 'afternoon', 8, 15, 25, 1.00, 3, 1, 1, 0),
    (v_home, v_home, 'Night Matrix',     'night',     8, 15, 25, 1.00, 2, 1, 1, 0);

  -- ================================================================
  -- 14. TRAINING TOPICS
  -- ================================================================
  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'fire_safety',     'Fire Safety & Evacuation',      12, 'hard', '{}')
  RETURNING id INTO tt_fire;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'mental_health',   'Mental Health Awareness',        12, 'hard', '{}')
  RETURNING id INTO tt_mh;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'first_aid',       'First Aid at Work',              36, 'hard', '{}')
  RETURNING id INTO tt_fa;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'food_hygiene',    'Food Hygiene Level 2',           36, 'hard', '{}')
  RETURNING id INTO tt_food;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'medication',      'Medication Administration',      12, 'hard', '{}')
  RETURNING id INTO tt_meds;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'manual_handling', 'Moving & Handling',              12, 'hard', '{}')
  RETURNING id INTO tt_mh2;

  INSERT INTO training_topics
    (tenant_id, home_id, code, name, renewal_interval_months, enforcement_mode, applies_to_role_codes)
  VALUES (v_home, v_home, 'dementia',        'Dementia Awareness',             24, 'soft', '{}')
  RETURNING id INTO tt_dem;

  -- ================================================================
  -- 15. TRAINING CERTS  (mix of valid / expiring / expired / missing)
  -- ================================================================
  INSERT INTO staff_training_certs
    (tenant_id, home_id, staff_id, training_topic_id, issue_date, expiry_date, source)
  VALUES
    -- Nurses — mostly valid fire safety
    (v_home, v_home, s_mannick,     tt_fire, '2025-03-01', '2026-03-01', 'manual'), -- expired
    (v_home, v_home, s_mannick,     tt_mh,   '2025-06-01', '2026-06-01', 'manual'), -- expiring soon
    (v_home, v_home, s_mannick,     tt_fa,   '2024-01-10', '2027-01-10', 'manual'), -- valid
    (v_home, v_home, s_mannick,     tt_meds, '2025-09-01', '2026-09-01', 'manual'), -- valid
    (v_home, v_home, s_ramkhelawon, tt_fire, '2025-08-01', '2026-08-01', 'manual'), -- valid
    (v_home, v_home, s_ramkhelawon, tt_mh,   '2025-08-01', '2026-08-01', 'manual'), -- valid
    (v_home, v_home, s_ramkhelawon, tt_fa,   '2023-11-01', '2026-11-01', 'manual'), -- valid
    (v_home, v_home, s_varghese,    tt_fire, '2025-02-01', '2026-02-01', 'manual'), -- expired
    (v_home, v_home, s_varghese,    tt_mh,   '2025-10-01', '2026-10-01', 'manual'), -- valid
    (v_home, v_home, s_sony,        tt_fire, '2025-07-01', '2026-07-01', 'manual'), -- valid
    (v_home, v_home, s_sony,        tt_meds, '2025-07-01', '2026-07-01', 'manual'), -- valid
    (v_home, v_home, s_paul,        tt_fire, '2025-05-01', '2026-05-20', 'manual'), -- expiring ~1 wk
    (v_home, v_home, s_paul,        tt_mh,   '2025-05-01', '2026-05-20', 'manual'), -- expiring ~1 wk
    -- Senior Carers
    (v_home, v_home, s_peter,       tt_fire, '2025-09-01', '2026-09-01', 'manual'),
    (v_home, v_home, s_peter,       tt_mh,   '2025-09-01', '2026-09-01', 'manual'),
    (v_home, v_home, s_peter,       tt_mh2,  '2025-09-01', '2026-09-01', 'manual'),
    (v_home, v_home, s_jacob,       tt_fire, '2025-01-01', '2026-01-01', 'manual'), -- expired
    (v_home, v_home, s_jacob,       tt_mh2,  '2025-04-01', '2026-04-01', 'manual'), -- expired
    (v_home, v_home, s_pradeep,     tt_fire, '2025-11-01', '2026-11-01', 'manual'),
    (v_home, v_home, s_pradeep,     tt_meds, '2025-11-01', '2026-11-01', 'manual'),
    (v_home, v_home, s_janardhanan, tt_fire, '2025-06-15', '2026-06-15', 'manual'), -- expiring ~1 mo
    (v_home, v_home, s_panchal,     tt_fire, '2025-10-01', '2026-10-01', 'manual'),
    (v_home, v_home, s_johnson,     tt_fire, '2025-08-01', '2026-08-01', 'manual'),
    (v_home, v_home, s_johnson,     tt_mh,   '2025-08-01', '2026-08-01', 'manual'),
    -- Care Assistants
    (v_home, v_home, s_jammeh,      tt_fire, '2025-10-01', '2026-10-01', 'manual'),
    (v_home, v_home, s_antony,      tt_fire, '2024-12-01', '2025-12-01', 'manual'), -- expired (on mat leave)
    (v_home, v_home, s_ruvetsa,     tt_fire, '2025-09-01', '2026-09-01', 'manual'),
    (v_home, v_home, s_ruvetsa,     tt_mh2,  '2025-09-01', '2026-09-01', 'manual'),
    (v_home, v_home, s_bwenene,     tt_fire, '2025-05-01', '2026-06-01', 'manual'), -- expiring ~3 wk
    (v_home, v_home, s_woodcock,    tt_fire, '2025-07-01', '2026-07-01', 'manual');
    -- s_james, s_sanel, s_pallat: no fire cert → "missing" in heatmap

  RAISE NOTICE 'Ferndale demo seed complete. home_id = %', v_home;
END;
$$;

DROP FUNCTION IF EXISTS _seed_shift(uuid,uuid,date,uuid,text,uuid,timestamptz,timestamptz,numeric,boolean);
