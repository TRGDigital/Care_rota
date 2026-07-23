# Sprint 5 — Time and Attendance

**Duration:** Weeks 9–10
**Spec sections:** 6.3 (shift_clockings, shifts_actual, shifts_payable), 6.4 (T&A hardware), 11 (full T&A section), 15.3 (UK GDPR for clock-in photos)
**Depends on:** Sprint 4

## Goal

Capture actual hours worked across three channels (iPad kiosk, mobile app, NFC badge) and reconcile against planned shifts to produce the `shifts_payable` records that Sprint 6's payroll engine will consume. By the end of this sprint, the home replaces its existing T&A vendor entirely.

## What we're building

### 1. Kiosk PWA — the iPad app

A Next.js route under `apps/kiosk/` (or a separate sub-route of the web app) optimised for an iPad in Guided Access mode.

#### Pairing flow

- Admin generates a pairing token in Settings → Kiosks
- iPad opens the PWA, enters the pairing token, becomes registered as a `kiosks` row
- Token expires after 1 hour for security

#### Punch flow — PIN mode

- Idle screen shows the home name, time, and a "Tap to clock in/out" CTA
- Tap → shows a grid of staff photos (or a search-by-employee-number screen if there are >30 staff)
- Staff taps their photo → PIN entry pad
- Staff enters 4–6 digit PIN
- Camera captures a still photo at the moment of entry
- API receives: staff_id, PIN, photo blob, timestamp, kiosk_id
- API validates PIN, writes `shift_clockings` row with `capture_method = kiosk_pin`
- Confirmation screen for 3 seconds: "You're clocked in/out, [Name]. Have a good shift."

#### Offline mode

- Service worker caches the punch flow and a list of staff photos + PIN hashes
- When offline, punches are queued in IndexedDB
- On reconnect, the queue flushes to the API
- The kiosk shows a small "Offline — syncing" indicator
- 24-hour tolerance: punches older than 24 hours can still sync but are flagged for manager review

#### Photo handling

Per Section 15.3 of the spec:

- Photo is JPEG, downscaled to 640×480, stored in S3
- Per UK GDPR, the photo is lawful under Article 6 with **consent at hire** (no biometric matching in v1)
- Retention: 90 days, then auto-deleted unless flagged for dispute
- v2 will add facial recognition with Article 9 explicit consent + DPIA

### 2. NFC badge support

#### Hardware

- USB or Bluetooth NFC reader plugged into the iPad
- Web NFC API for badge reads (works on Android; for iOS the kiosk needs a USB OTG NFC reader, treated as a HID device that types the badge UID)

#### Badge issuance

- Admin in Settings → Staff → individual record → Issue NFC badge
- Scan the badge on the kiosk in admin mode → captures the UID
- Writes a `nfc_badges` row with `staff_id`, `nfc_uid`, `issued_at`
- Lost badges: admin deactivates, issues a new one

#### Punch flow — NFC mode

- Staff taps badge on the kiosk reader
- Reader sends the UID, kiosk looks up the badge → resolves to staff_id
- Photo capture happens automatically (no PIN entry)
- Writes `shift_clockings` row with `capture_method = kiosk_nfc`
- One-second confirmation: "Clocked in, [Name]"

NFC is the preferred mode during shift handovers when 10 staff need to clock through in 2 minutes.

### 3. Mobile app — geofenced clock-in

#### App scope

The staff mobile app (React Native + Expo) gains its clock-in screen.

- Home screen: shows the staff member's current shift status (rostered, clocked in, clocked out)
- "Clock In" button — only enabled when:
  - Staff has a published shift starting within the next 60 minutes (configurable), OR
  - Manager has granted "out of hours clock-in" permission on the staff record
- Tap → app checks GPS
- If inside the home's `geofence` (default 100m radius), photo capture, then writes `shift_clockings` row with `capture_method = mobile_geofenced`
- If outside geofence, message: "You need to be at the home to clock in. Distance to home: 1.2 km."

#### GPS accuracy guard

- Refuses the punch if GPS accuracy is worse than 50m
- Refuses if location services are off
- Doesn't refuse on a slightly older fix (up to 30 seconds) — phones in pockets take time to get a fresh fix

#### Use cases

- Activities staff who start outside (e.g. picking up residents for a trip)
- Lone-worker scenarios for v2 community care
- Managers walking the floor who don't want to walk back to the kiosk

### 4. Anti-buddy-punching controls (v1)

Per Section 11.2 of the spec:

- Photo on every punch
- PIN attempts rate-limited: 3 failures → staff record locked, manager clears
- Geofence-only mobile clock-in (no remote)
- Anomaly detection: a clock-in more than 15 minutes outside the rota start window raises a low-friction confirmation ("Looks like you're clocking in early — that's fine, just confirming")

The clock-in photos appear in a daily review queue:

- Settings → Compliance → Photo Review
- Manager spot-reviews 5 random photos per day
- Flag suspicious photos → triggers an investigation workflow
- This is a 5-minute daily task that catches buddy-punching without ML

### 5. The reconciliation worker

Runs every 5 minutes and on every "shift end + grace window" trigger.

For each shift in any published period:

1. Find all `shift_clockings` events for this `shift_id`
2. Pair clock-in events with clock-out events (FIFO; allow multiple in/out pairs for mid-shift break)
3. Compute `actual_start_utc`, `actual_end_utc`, `actual_worked_minutes`, `actual_break_minutes`
4. Determine reconciliation state per Section 11.3:

| State | Trigger |
|---|---|
| `matched` | In within 15 min of planned start, out within 15 min of planned end |
| `over_planned` | Worked longer than planned by more than 15 min |
| `under_planned` | Worked shorter than planned by more than 15 min |
| `no_show` | No clock-in event for a published shift, grace window passed (default 30 min past planned start) |
| `no_clock_out` | Clock-in present, no clock-out, shift end + 90 min has passed |
| `manual_override` | Manager has set values manually |

5. Write or update the `shifts_actual` row
6. Write or update the `shifts_payable` row using the **pay-actual** rule:

| Reconciliation state | `shifts_payable.paid_minutes_<x>` |
|---|---|
| `matched` | Actual minutes per category (weekday / weekend / etc.) |
| `over_planned` | Actual minutes |
| `under_planned` | Actual minutes |
| `no_show` | Zero |
| `no_clock_out` | Held — null until resolved |
| `manual_override` | Manager-entered values |

The `source_rule` column records which path produced the values: `auto_actual`, `manager_override`, `pay_zero_no_show`.

#### No-show alerting

When `no_show` is detected, the worker:

- Updates `shifts_actual` and `shifts_payable` (zero pay)
- Raises a rebalance suggestion to fill the gap (logic built in Sprint 4)
- Sends an urgent push to the registered manager and deputy
- Optionally SMS the no-show staff member: "We didn't see you clock in at [time]. Are you OK? Please contact the home."

#### No-clock-out alerting

When `no_clock_out` is detected, the worker:

- Holds the `shifts_payable` row (no auto-pay)
- Sends a push to the manager and the staff member
- Surfaces it in the manager's "Unresolved punches" queue
- Manager resolves by entering the actual clock-out time, with a mandatory reason

### 6. Manager: resolve unresolved punches

A new screen: Today view → Unresolved punches.

For each unresolved record (no_show, no_clock_out, or shifts with mid-shift anomalies):

- Show the shift details, planned times, and what we know about actuals
- Show the photos captured for any partial events
- Manager picks an action:
  - "Pay actual as recorded"
  - "Set clock-out manually" (date+time input)
  - "Pay zero — no-show"
  - "Pay planned" (with manager override — requires registered manager role, justification, audit)

### 7. Sleep-in and waking nights

Per Section 11.5 of the spec.

#### Sleep-in shifts

A shift whose `shift_pattern_template.length_type = sleep_in`. Payroll uses the flat rate (`rate_sleep_in_flat_pence`) for the whole sleep period.

#### Disturbed work during sleep-in

Staff has a one-tap action on the kiosk: "Disturbed — start". Captures the time. When they finish, another tap: "Disturbed — end".

These create `shift_clockings` rows with `event_type` values `disturbed_start` and `disturbed_end`. The reconciliation worker sums disturbed minutes and writes them to a new field on `shifts_payable`: `paid_minutes_disturbed_during_sleep_in`. Payroll in Sprint 6 pays these at the staff's standard hourly rate on top of the flat.

### 8. Existing T&A migration import

A one-off CSV import in Settings → T&A → Migration. The home uploads the export from their previous T&A vendor; the system maps columns and writes historical `shift_clockings` rows for prior-period reporting. Flagged with `capture_method = imported_legacy`.

This is **not** an ongoing integration — once the home is on CareRota's T&A, the old vendor is decommissioned. The pricing slide includes the saving.

## Acceptance tests

1. Pair an iPad as a kiosk; staff member taps their photo, enters correct PIN — photo is captured, `shift_clockings` row is written with `capture_method = kiosk_pin`.
2. Same staff member taps NFC badge — clock-in completes in under 1 second; no PIN required; `capture_method = kiosk_nfc`.
3. Staff member tries to clock in from mobile app while at home (outside geofence) — refused with distance message.
4. Staff member clocks in from mobile app while at the home — succeeds; `capture_method = mobile_geofenced`.
5. Staff member enters wrong PIN 3 times — staff record locked; admin clears; locked-out staff visible on a manager queue.
6. Kiosk loses internet, captures a punch offline, regains internet — punch syncs; appears in the system within 30 seconds.
7. A shift with planned 07:00–19:00; staff clocks in at 06:58, clocks out at 19:15 — reconciliation state = matched; `shifts_payable.paid_minutes_weekday` reflects actual minutes (around 12h 17m minus the configured break).
8. A shift with planned 07:00–19:00; staff clocks in at 07:05, clocks out at 18:30 — reconciliation state = under_planned; `shifts_payable` reflects actual minutes.
9. A shift with planned 07:00–19:00; no clock-in by 07:30 — reconciliation state = no_show; manager receives urgent push; `shifts_payable.paid_minutes` are all zero.
10. A shift with planned 07:00–19:00; clock-in at 07:02 but no clock-out by 20:30 — reconciliation state = no_clock_out; appears in Unresolved Punches queue; manager resolves manually with audit row written.
11. Sleep-in shift with two "Disturbed" pairs of 30 min each — `shifts_payable.paid_minutes_sleep_in` = flat-rate marker; `paid_minutes_disturbed_during_sleep_in` = 60.
12. Manager overrides a no-show to "pay planned" — override is recorded in `rule_overrides`; `shifts_payable.source_rule = manager_override`.
13. Import a legacy T&A CSV with 1000 historical clock events — all rows are written with `capture_method = imported_legacy`; visible in the staff member's shift history.

## Out of scope

- Facial recognition matching (v2)
- Agency staff clock-in (v2)
- Time-off-in-lieu accrual (v2)
- Payroll calculation against the captured data (Sprint 6)

## Definition of done

- All three capture modes (kiosk PIN, kiosk NFC, mobile geofenced) work end-to-end
- Reconciliation worker produces correct `shifts_actual` and `shifts_payable` rows for all 6 states
- Unresolved Punches queue lets managers resolve no_show and no_clock_out cases with audit
- Sleep-in flat-rate + disturbed top-up flow works
- Legacy T&A import succeeds for at least one real prior-vendor export
- All 13 acceptance tests pass
- Sprint demo: 5 staff clock in on the kiosk (mix of PIN and NFC) within 60 seconds; one staff clocks in from mobile; one no-show is detected and replaced via the cover flow from Sprint 4; the manager resolves one no-clock-out manually
