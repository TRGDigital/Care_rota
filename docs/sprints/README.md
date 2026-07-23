# Sprint Briefs

This folder contains one brief per sprint. Each brief is a focused subset of the full technical specification (`../CareRota_Technical_Specification_v1_1.docx`). Read the brief first; refer to the full spec for anything ambiguous.

## How to use these briefs

When starting a sprint, paste the brief into a fresh Claude Code conversation along with `CLAUDE.md`. The brief tells Claude Code:

- What to build
- Which spec sections are authoritative
- The DB tables and migrations involved
- The acceptance tests for the sprint
- What is explicitly out of scope (handled in a later sprint)

Do not paste multiple sprint briefs at once. Finish one before starting the next, so the dependency chain stays clean.

## Sequencing

The order matters. Each sprint builds on the data and APIs of the previous ones. Do not reorder without first checking that the dependent data model is in place.

| # | Sprint | Weeks | Depends on |
|---|---|---|---|
| 0 | Pre-flight (DB schema + types) | Before sprint 1 | — |
| 1 | Foundations | 1–2 | 0 |
| 2 | Staff & contracts | 3–4 | 1 |
| 3 | Rota engine v1 | 5–6 | 2 |
| 4 | Rota engine v2 & leave | 7–8 | 3 |
| 5 | Time and attendance | 9–10 | 4 |
| 6 | Payroll engine — core | 11–12 | 5 |
| 7 | Payroll exports & accountant portal | 13–14 | 6 |
| 8 | Occupancy & compliance | 15–16 | 4, 7 |
| 9 | Conversational layer (chat) | 17–18 | All previous |

## Definition of done — per sprint

Every sprint must end with:

- All migrations applied and tested
- Unit tests passing on the domain logic introduced
- Integration tests passing with RLS enabled
- At least one E2E test covering the headline user flow of that sprint
- Audit and (where relevant) override paths exercised by a test
- A short demo script showing a manager completing the relevant flow end-to-end

## v1 launch — overall definition of done

See Section 17.2 of the full spec. Highlights:

- Two pilot homes running for one full pay period
- CSV import succeeded into pilots' accountant software
- Accountant portal in active use by both pilots' accountants
- NMW floor validation has fired in test and prevented an underpaid pay run
- A WTR breach has been blocked at publish time
- A WTR override has been recorded with full audit trail
- A training expiry has prevented a shift assignment
- A bank-holiday shift has been paid at the configured multiplier
- A training session has correctly produced a paid top-up for one attendee (outside their shift) and no top-up for another (during their shift)
- A holiday approval has used the one-click cover assignment
- The chat answers the 8 canonical questions correctly with citations
- Disaster recovery drill completed; restore in under 4-hour RTO
