# CareRota — Internal Admin UI Design System

**Version:** 1.0
**Status:** Authoritative reference
**Companion to:** CareRota Technical Specification v1.1

---

## 0. Scope — Read This First

> ### THIS DESIGN SYSTEM APPLIES TO EVERY PAGE OF THE INTERNAL ADMIN UI WITHOUT EXCEPTION
>
> Every screen, every panel, every modal, every state of every component in the CareRota admin portal must conform to this design system. This is not a guide for "key pages" or "the dashboard" — it is the mandatory standard for the **entire** internal application. If a page exists in the admin UI, this document governs how it looks and behaves. There are no pages exempt from this specification.

The CareRota admin portal currently uses unstyled or minimally-styled components — functional but visually basic. This document replaces that with a complete, professional design system. The design philosophy is drawn from best-in-class UK care sector software, whose central pitch is being intuitive enough that non-technical care staff adopt it without heavy training.

### 0.1 What "every page" means concretely

Every admin UI area below is in scope. As new pages are built in future sprints, they are **automatically** in scope — this design system is the default, not an opt-in.

| Sprint | Pages / areas — ALL in scope |
|---|---|
| 1 | Login, home picker, dashboard shell, sidebar navigation, home switcher, settings (general), Override Log |
| 2 | Staff directory, staff detail (all tabs), add-staff wizard, contracts editor, pay rates editor, documents, training certs, sponsorship, shift pattern library, premium pay calendar |
| 3 | Rota board, shift slot editor, shift assignment panel, rota period list, historical rota import, staff portal rota view |
| 4 | Auto-generator screen, leave inbox, leave approval screen (three-panel), sickness reporting, holiday year calendar, rebalance suggestions inbox, open-shifts lens |
| 5 | Kiosk pairing, kiosk admin, NFC badge issuance, geofence config, unresolved punches queue, photo review queue |
| 6 | Pay cycle config, pay run list, pay run review, payslip detail, payslip PDF preview, reference wage rates |
| 7 | CSV export screen, accountant invitation, accountant portal (all screens), accountant activity log, year-end summary |
| 8 | Beds management, residents directory, dependency assessment form, daily occupancy update, staffing matrix, staffing justification, compliance dashboard, owner consolidated dashboard, CareStream integration screens |
| 9 | Chat panel (all states), policy document upload, chat history |
| **All** | **Every modal, every empty state, every loading state, every error state, every confirmation dialog, every toast, every form, every table — across all of the above** |

> **No page ships without conforming.** A page is not "done" until it conforms to this design system. Sprint definitions of done are amended: visual conformance is a release gate for every page in every sprint, including pages **already built** before this design system was adopted. Previously-built pages must be retrofitted.

---

## 1. Design Philosophy

CareRota is used by care home managers, deputies, HR staff and owners — experts in care, not in software. Many are not confident with technology. The design must be calm, obvious, and forgiving. The benchmark: software a busy registered manager can pick up between handovers and use correctly without training.

### 1.1 The five principles

- **Calm, not busy** — Generous whitespace, one clear primary action per screen, muted background, colour reserved for meaning. A care manager opening the rota board at 7am should feel oriented within two seconds.
- **Obvious, not clever** — Standard patterns over novel ones. A button looks like a button. Navigation is always in the same place. If a user has to wonder "can I click that?", the design has failed.
- **Forgiving, not punishing** — Destructive actions are confirmed. Mistakes are reversible where possible. Errors explain what to do next, never just what went wrong. Empty states guide toward the first action.
- **Warm, not clinical** — Friendly rounded corners, soft shadows, approachable typography, a warm accent colour. This is care software — humane, not enterprise tax software. Warmth never compromises clarity.
- **Consistent, not surprising** — The same component looks and behaves identically everywhere. Once a user learns a pattern, it works everywhere. This is what makes the product learnable without training.

### 1.2 What we are explicitly avoiding

- Dense enterprise dashboards with twenty widgets competing for attention
- Tiny text and tight spacing to "fit more in" — care staff often work on older monitors and tablets
- Jargon, abbreviations, and codes where plain words would do
- Modal-on-modal stacks and deeply nested navigation
- Aggressive reds and alarm styling except for genuine errors and genuine compliance breaches
- Novel interaction patterns that require the user to learn something new
- Generic, characterless "admin template" aesthetics

---

## 2. Design Tokens

All values below are the single source of truth. Implemented once as CSS custom properties and Tailwind theme extensions, referenced everywhere. No component defines its own colours, spacing, or radii.

> **Note on the accent colour:** the coral accent below is a considered starting point for "warm, approachable care software", but it is a choice. Review the hex values with a designer before locking them. Because everything is tokenised, changing the accent is a one-line change referenced everywhere.

### 2.1 Colour palette

#### 2.1.1 Brand colours

| Token | Hex | Usage |
|---|---|---|
| `--color-brand-primary` | `#1F4E79` | Primary brand blue. Headings, active nav, primary text emphasis, the logo lockup. |
| `--color-brand-primary-hover` | `#163A5A` | Hover state for primary-blue interactive elements. |
| `--color-brand-primary-light` | `#E8F0F8` | Tints — active nav background, selected rows, info banners. |
| `--color-accent` | `#F0654A` | Warm coral. THE primary action colour — primary buttons, key CTAs, focus highlights, the active wizard step. |
| `--color-accent-hover` | `#D44E35` | Hover state for accent buttons. |
| `--color-accent-light` | `#FDEAE6` | Accent tint — subtle highlight backgrounds, the "new" pill, hover on accent-bordered cards. |

#### 2.1.2 Neutrals

| Token | Hex | Usage |
|---|---|---|
| `--color-ink` | `#1A2330` | Primary text. Near-black, slightly warm. Body copy, table data, labels. |
| `--color-ink-muted` | `#5B6675` | Secondary text. Captions, helper text, timestamps. |
| `--color-ink-subtle` | `#8A95A3` | Tertiary text. Disabled labels, very low-emphasis metadata. |
| `--color-surface` | `#FFFFFF` | Card backgrounds, modal backgrounds, the content surface. |
| `--color-canvas` | `#F6F8FA` | The app background behind cards. A soft cool grey — never pure white. |
| `--color-border` | `#E2E7EC` | Default border for cards, inputs, table cell dividers. |
| `--color-border-strong` | `#CBD3DC` | Emphasised borders — table header underline, input focus-adjacent. |
| `--color-overlay` | `rgba(26,35,48,0.45)` | Modal backdrop scrim. |

#### 2.1.3 Semantic colours

Used **only** to convey state. Never decorative. Each has a base (text/icon/border) and a light (background fill) variant.

| Token group | Base / Light | Meaning and usage |
|---|---|---|
| `--color-success-*` | `#2E7D52` / `#E6F4EC` | Positive, complete, valid. Confirmed shifts, valid training certs, approved leave, savings figures. |
| `--color-warning-*` | `#B8860B` / `#FDF4E0` | Attention needed, not yet critical. Training expiring within 30 days, soft-warn rule fired, pending items. |
| `--color-danger-*` | `#C0392B` / `#FCEAE8` | Error, breach, critical. Expired hard-gate training, WTR breach, no-show, NMW floor breach, failed validation. |
| `--color-info-*` | `#1F6FB2` / `#E5F1F9` | Neutral information. Tips, in-progress states, informational banners. |
| `--color-pending-*` | `#7A5BA8` / `#F0EAF7` | Awaiting a decision. Pending leave requests, in-review pay runs, proposed rebalance suggestions. |

> **Colour discipline:** semantic colour is reserved for meaning. A button is not green because green is nice — it is the accent coral because it is the primary action. Status badges use semantic colour because the colour IS the information. If colour is being used decoratively, it is being used wrong.

### 2.2 Typography

One typeface family across the entire application: **Inter** — open-source, highly legible at all sizes, excellent number rendering (critical for a payroll product), friendly-but-professional. Load weights 400, 500, 600, 700 only.

| Token | Size / Line / Weight | Usage |
|---|---|---|
| `--text-display` | 32px / 40px / 700 | Page-level hero numbers only — the big figure on a dashboard tile. |
| `--text-h1` | 24px / 32px / 700 | Page titles. One per page. |
| `--text-h2` | 20px / 28px / 600 | Section headings within a page. |
| `--text-h3` | 16px / 24px / 600 | Card titles, sub-section headings. |
| `--text-body` | 14px / 22px / 400 | Default body text, table cells, form values. |
| `--text-body-medium` | 14px / 22px / 500 | Emphasised body — table row labels, key-value keys. |
| `--text-label` | 13px / 18px / 500 | Form field labels, button text, tab labels. |
| `--text-caption` | 12px / 16px / 400 | Helper text, timestamps, metadata, table column headers (uppercase, letter-spaced). |
| `--text-mono` | 13px / 20px / 500 | Monospace ("Roboto Mono") — only for IDs, reference numbers, NI numbers. |

**Numbers in tables, payslips, and dashboards use tabular figures (`font-variant-numeric: tabular-nums`)** so columns of money and hours align vertically. Mandatory on every numeric column.

### 2.3 Spacing scale

A strict 4px-based scale. Every margin, padding, and gap uses a token — no arbitrary pixel values anywhere.

| Token | Value | Typical usage |
|---|---|---|
| `--space-1` | 4px | Icon-to-text gaps, tight chip padding. |
| `--space-2` | 8px | Inside small components, label-to-input. |
| `--space-3` | 12px | Compact card padding, between form rows. |
| `--space-4` | 16px | Default gap between elements, standard card padding. |
| `--space-5` | 24px | Comfortable card padding, gap between cards. |
| `--space-6` | 32px | Section spacing within a page. |
| `--space-8` | 48px | Major section breaks, page top padding. |
| `--space-10` | 64px | Page-level vertical rhythm on spacious layouts. |

### 2.4 Radii, shadows, borders

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Inputs, badges, small buttons, chips. |
| `--radius-md` | 10px | Buttons, cards, dropdowns, modals. |
| `--radius-lg` | 16px | Large feature cards, dashboard tiles, the app shell content area. |
| `--radius-full` | 9999px | Pills, avatars, toggle tracks. |
| `--shadow-sm` | `0 1px 2px rgba(26,35,48,0.06)` | Resting cards, inputs. |
| `--shadow-md` | `0 4px 12px rgba(26,35,48,0.08)` | Hovered cards, dropdowns, popovers. |
| `--shadow-lg` | `0 12px 32px rgba(26,35,48,0.16)` | Modals, the chat panel, anything floating above the page. |
| `--border-width` | 1px | All borders. CareRota does not use thick borders. |

### 2.5 Motion

Quick, subtle, purposeful. Motion confirms an action or guides attention — it never decorates.

| Token | Value | Usage |
|---|---|---|
| `--motion-fast` | 120ms ease-out | Hover states, button presses, toggle flips. |
| `--motion-base` | 200ms ease-out | Dropdowns opening, tabs switching, panels sliding. |
| `--motion-slow` | 320ms ease-out | Modals appearing, the chat panel sliding in. |
| reduced motion | respect `prefers-reduced-motion` | When the OS requests reduced motion, transitions become instant. **Mandatory.** |

---

## 3. Layout System

Every page uses the same shell. The shell is built once and never re-implemented per page. Pages render only their content area.

### 3.1 The application shell

- **Left sidebar** (fixed, 256px) — primary navigation. Always visible on desktop; collapses to a 64px icon rail on smaller screens; an overlay drawer on tablet-portrait. Contains the logo, home switcher, navigation items, and a user menu pinned to the bottom.
- **Top bar** (fixed, 64px) — spans the content area right of the sidebar. Current page title, global search, contextual page actions on the right, the chat-panel toggle.
- **Content area** (scrolling) — everything below the top bar and right of the sidebar. Max-width 1280px, centred, `--space-8` top padding, `--space-6` horizontal padding. The only region a page implements.
- **Chat panel** (fixed overlay, 400px) — slides in from the right when toggled, `--shadow-lg`. Behaviour in the technical spec Section 12; styled per this system.

### 3.2 The sidebar in detail

- Logo lockup at the top, `--space-5` padding.
- Home switcher directly below — a button showing the current home name with a chevron, opening a dropdown of the user's homes. If the user has only one home, it is a static label, not a button.
- Navigation items as a vertical list: 20px icon (single icon set), `--text-label` label, `--space-3` vertical padding, `--radius-md`. Active item has `--color-brand-primary-light` background with `--color-brand-primary` text and icon. Inactive hover gives `--color-canvas`.
- Navigation groups separated by a thin `--color-border` divider with a `--text-caption` uppercase group label (e.g. "ROTA", "PAYROLL", "COMPLIANCE").
- User menu pinned to the bottom — avatar, name, role; opens profile / settings / sign out.

### 3.3 Page structure — every page follows this

1. **Page header** — H1 title, optional one-line description in `--color-ink-muted`, primary page actions aligned right. `--space-6` bottom margin.
2. **Optional filter/toolbar row** — search, filters, view toggles.
3. **Page body** — cards, tables, forms, or a combination. Cards separated by `--space-5`.
4. No page renders content edge-to-edge. Everything sits within the max-width content column.

### 3.4 Responsive behaviour

| Breakpoint | Width | Shell behaviour |
|---|---|---|
| Desktop | 1280px+ | Full sidebar (256px), full top bar, content at max-width 1280px. |
| Laptop | 1024–1279px | Full sidebar, content fills available width. |
| Tablet landscape | 768–1023px | Sidebar collapses to 64px icon rail; labels on hover as tooltips. |
| Tablet portrait | 600–767px | Sidebar becomes an overlay drawer triggered by a hamburger. |
| Mobile | below 600px | Drawer sidebar; tables become stacked cards; admin UI remains usable but the staff mobile app is the primary small-screen experience. |

> **Tablet matters.** Registered managers frequently use the admin UI on a tablet while walking the floor. Tablet-landscape and tablet-portrait layouts are a primary use case and must be tested on every page.

---

## 4. Core Component Library

Built once in `packages/ui`, used everywhere. No page builds its own version of any of these. Every component implements hover, focus-visible, active, and disabled states, and every interactive component is fully keyboard operable.

### 4.1 Buttons

| Variant | Appearance | Usage |
|---|---|---|
| Primary | Solid `--color-accent`, white text, `--radius-md`, `--shadow-sm`. Hover → `--color-accent-hover`. | The single most important action on a screen or dialog. Only one visible per context. |
| Secondary | White background, `--color-border` border, `--color-ink` text. Hover → `--color-canvas`. | Secondary actions — Cancel, Back, alternative paths. |
| Tertiary / ghost | No background, no border, `--color-brand-primary` text. Hover → `--color-brand-primary-light`. | Low-emphasis actions, actions within tables and cards. |
| Destructive | Solid `--color-danger`, white text. | Irreversible destructive actions. Always paired with a confirmation dialog. |
| Icon button | Square, icon only, ghost styling. Must have an `aria-label`. | Compact actions in toolbars and table rows. |

Sizes: small (28px), medium (36px, default), large (44px, for primary CTAs on empty states and wizards). All buttons show a spinner replacing their label when loading, and are disabled while loading.

### 4.2 Form controls

- **Text input** — white background, `--color-border` border, `--radius-sm`, `--space-3` padding, `--text-body`. Focus: `--color-accent` border + 3px `--color-accent-light` ring. Error: `--color-danger` border. Always paired with a `--text-label` above and optional `--text-caption` helper/error below.
- **Select / dropdown** — same shell as text input with a chevron. Opens a `--shadow-md` popover, `--radius-md`. Selected option marked with a check. Keyboard navigable.
- **Date picker** — text input with a calendar icon, opens a calendar popover. Critical for leave requests, rota periods, contract dates.
- **Checkbox and radio** — 18px, `--radius-sm` for checkbox, `--radius-full` for radio. Checked uses `--color-accent`. Minimum 24px hit target.
- **Toggle switch** — `--radius-full` track. Off: `--color-border-strong`. On: `--color-accent`. For settings and on/off states, never for actions needing confirmation.
- **Textarea** — as text input, min 3 rows, vertically resizable.
- **Field validation** — inline, below the field, `--color-danger` with a small icon. Fires on blur and on submit, **never** on every keystroke. First invalid field is scrolled into view and focused on a failed submit.

### 4.3 Status badges and pills

A single `Badge` component with semantic variants, used identically everywhere. `--radius-full`, `--text-caption`, `--space-1` vertical / `--space-2` horizontal padding, a coloured dot or icon plus a label.

| Variant | Token group | Example labels |
|---|---|---|
| Success | `--color-success-*` | Published, Valid, Approved, Clocked in, Matched |
| Warning | `--color-warning-*` | Expiring soon, Pending review, Soft warning |
| Danger | `--color-danger-*` | Expired, Breach, No-show, Blocked, Below floor |
| Info | `--color-info-*` | Draft, In progress, Imported |
| Pending | `--color-pending-*` | Pending, In review, Proposed, Awaiting approval |
| Neutral | `--color-ink-muted` on `--color-canvas` | Inactive, Archived, Not started |

### 4.4 Cards

The fundamental content container. White `--color-surface`, `--radius-lg`, `--shadow-sm`, `--color-border` border, `--space-5` padding. May have a header (title in `--text-h3`, optional action aligned right, `--color-border` bottom divider), a body, and an optional footer. Cards never nest more than one level deep.

### 4.5 Tables

One `Table` component, used everywhere — staff lists, pay runs, shifts, audit logs.

- Column headers: `--text-caption`, uppercase, letter-spaced, `--color-ink-muted`, `--color-border-strong` bottom border.
- Rows: `--text-body`, `--space-3` vertical cell padding, thin `--color-border` divider between rows. Row hover → `--color-canvas`.
- Numeric columns right-aligned, tabular figures. Money and hours columns always.
- Row actions: ghost icon buttons revealed on row hover, or an always-visible overflow menu on touch devices.
- Selectable rows: leading checkbox column; a selection toolbar appears above the table when any row is selected.
- Sortable columns show a sort chevron in the header.
- Paginate at 25 rows by default with a page-size selector. Server-side pagination for large datasets.
- On tablet-portrait and below, each row collapses into a stacked card showing the same data as label/value pairs.

### 4.6 Modals and dialogs

- **Standard modal** — centred, `--color-surface`, `--radius-md`, `--shadow-lg`, max-width 560px (720px for complex content). `--color-overlay` scrim. Header with title and close button, scrollable body, footer with actions (primary right, secondary left of it). Closes on Escape, on scrim click (unless it contains unsaved input), and on the close button.
- **Confirmation dialog** — compact modal, max-width 440px. Used for every destructive or irreversible action. Title posed as the question, a one-line consequence description, Cancel secondary + Confirm (destructive variant if destructive).
- **Side sheet** — slides in from the right, 480px, `--shadow-lg`. For detail views and editors that benefit from keeping the underlying page visible — the shift assignment panel, a staff quick-view.
- **The Override Modal** — a specific, critical modal defined in technical spec Section 4. Styled per this system: warning-toned header, the blocked rule clearly stated, the reason-category select, the justification textarea with character counter, the MFA re-entry field, a clearly destructive-adjacent confirm. It must feel deliberate and slightly weighty — it is an exceptional action.

### 4.7 Empty states

Every list, table, and data area has a designed empty state — never a blank space. It contains a simple illustration or icon, a `--text-h3` line stating what would normally be here, a `--text-body` line explaining how to populate it, and a primary button for the first action where one exists.

Examples: an empty staff directory says "No staff yet — add your first team member to start building rotas" with an "Add staff" button. An empty leave inbox says "No pending requests — you are all caught up" with a calm checkmark illustration and no button.

### 4.8 Loading states

- **Skeleton loaders** — for initial page and card loads. Grey `--color-canvas` blocks at the shape of the eventual content, with a subtle shimmer. Never a centred spinner on a blank page.
- **Inline spinners** — for in-place updates: a button mid-action, a table re-sorting, a filter applying.
- **Progressive loading** — where data arrives in parts, render each part as it lands rather than blocking the whole page.

### 4.9 Toasts and notifications

Bottom-right, `--color-surface`, `--radius-md`, `--shadow-lg`, `--space-4` padding, a leading semantic icon, a message, an optional action link. Auto-dismiss after 5 seconds for success/info; persist until dismissed for errors. Stack vertically, maximum 3 visible. Used to confirm completed actions ("Rota published", "Pay run approved") — never for critical errors needing a decision (those are dialogs).

### 4.10 Tabs, breadcrumbs, pagination

- **Tabs** — within detail pages (the staff record, the pay run review). Underline style — active tab has a `--color-accent` underline and `--color-ink` text; inactive tabs are `--color-ink-muted`. Arrow-key navigable.
- **Breadcrumbs** — for nested navigation (Staff > Jane Doe > Contracts). `--text-caption`, `--color-ink-muted`, chevron separators; last item `--color-ink` and non-clickable.
- **Pagination** — below tables. Page numbers, previous/next, a page-size selector, a "showing X–Y of Z" count.

---

## 5. Page-Level Patterns

Certain page types recur. Each has a defined pattern so every page of a given type feels identical.

### 5.1 List page pattern

Used by: staff directory, pay run list, rota period list, residents directory, audit log, override log, every other list.

- Page header with title, count, and a primary "Add / Create" action
- A toolbar card: search on the left, filters in the middle, view options on the right
- The table (or card grid) as the page body
- Pagination below
- A designed empty state for no items, and a distinct "no results" state for when filters exclude everything

### 5.2 Detail page pattern

Used by: staff record, pay run review, resident detail, rota period detail.

- Breadcrumb back to the parent list
- Page header with the entity name, key status badges, and primary actions
- A summary card or strip showing the most important facts at a glance
- Tabs for sub-sections where the entity is rich
- Each tab's content follows the card-based body pattern

### 5.3 Form and wizard pattern

Used by: add-staff wizard, contract editor, leave request, dependency assessment, settings screens.

- Single-step forms sit in a card with a clear title, grouped fields with `--space-4` between rows, a footer with primary submit and secondary cancel
- Multi-step wizards show a step indicator at the top — numbered steps, active step in `--color-accent`, completed steps with a check, future steps muted
- Wizards keep Back and Next/Finish in a consistent footer; progress is preserved if the user navigates away
- Validation per Section 4.2 — on blur and on submit, first error focused, never per-keystroke

### 5.4 Dashboard pattern

Used by: the home dashboard, the owner consolidated dashboard, the compliance dashboard.

- A grid of metric tiles at the top — each tile a card with a `--text-caption` label, a `--text-display` figure, a trend indicator, an optional sparkline
- Tiles are calm — no more than 6–8 visible, generous spacing, semantic colour only on the trend indicator
- Below the tiles, larger cards for charts, lists of items needing attention, quick links
- Every tile and chart clicks through to the detailed view it summarises

### 5.5 The rota board — a special case

The most complex screen in the app and the most-used. It still uses the design tokens and components, but it is a bespoke layout: a time/role grid with draggable shift cards. The grid follows the spacing scale, shift cards are small cards with semantic status colouring, the assignment panel is a side sheet. Drag interactions use `--motion-fast`. The board must remain calm despite its density — achieved through restrained colour, clear typography, and generous cell padding.

---

## 6. Accessibility

Accessibility is a requirement on every page, not an enhancement.

### 6.1 Mandatory standards

- **WCAG 2.2 Level AA** across the entire admin UI
- All text meets 4.5:1 contrast against its background; large text and UI components meet 3:1. The token palette is designed to pass — do not introduce off-token colours that fail
- Every interactive element is reachable and operable by keyboard alone, in a logical tab order
- Visible focus indicator on every focusable element — a 3px `--color-accent-light` ring. **Never remove focus outlines**
- Every form field has a programmatically associated label; errors are announced to assistive technology
- Every icon-only button has an `aria-label`; every image has alt text or is marked decorative
- Status is never conveyed by colour alone — badges have an icon or text, charts have labels and patterns
- Modals trap focus, return focus on close, are announced, and close on Escape
- `prefers-reduced-motion` is respected — transitions become instant
- Minimum touch target of 44×44px on touch devices
- The app is usable at 200% browser zoom without loss of content or function

### 6.2 Testing

Automated accessibility checks (axe-core) run in CI on every page — a release gate. A page with accessibility violations does not ship. Manual keyboard-only and screen-reader passes are part of each sprint's definition of done.

---

## 7. Implementation Approach

### 7.1 Where the design system lives

The entire design system is implemented in `packages/ui` and consumed by `apps/web`. Nothing is implemented per-page or per-sprint in isolation.

- **Tokens** — defined as CSS custom properties in a single tokens file, mirrored into the Tailwind theme config so they are available as utility classes. One source of truth.
- **Components** — each core component from Section 4 is a typed React component in `packages/ui` with its variants, states, and stories. Built on the existing shadcn/ui base where one exists, restyled to these tokens.
- **Patterns** — the page patterns from Section 5 are provided as layout components and templates so a new page starts from the right structure.
- **Documentation** — every component has a stories file demonstrating all variants and states.

### 7.2 Build sequence

Implement as a dedicated workstream, in this order:

1. **Tokens first** — colours, type, spacing, radii, shadows, motion. Nothing else can be built correctly until these exist.
2. **The application shell** — sidebar, top bar, content area, responsive behaviour. Every page depends on it.
3. **Core components** — buttons, forms, badges, cards, tables, modals, empty/loading states, toasts. Section 4 in full.
4. **Page patterns** — list, detail, form/wizard, dashboard templates. Section 5.
5. **Retrofit existing pages** — every page already built is brought into conformance.
6. **All subsequent sprints** build on the system from the start.

### 7.3 Retrofit of already-built pages

> **Existing pages are not exempt.** Pages built in Sprint 1 and any sprints completed before this design system is adopted must be retrofitted to full conformance. This is a defined task, not optional polish. The login, home picker, dashboard shell, settings, and Override Log from Sprint 1 — and everything from any subsequent completed sprint — all get reworked to this specification. Budget a dedicated retrofit pass.

### 7.4 Definition of done — amended for every sprint

Every sprint's definition of done is amended to include these visual-conformance gates, applied to every page that sprint touches or creates:

- Every page uses the application shell — no bespoke layouts outside the rota board
- Every colour, spacing value, radius, and font size comes from a token — no arbitrary values
- Every component used is from `packages/ui` — no one-off re-implementations
- Every list has a designed empty state and a no-results state
- Every data area has a skeleton loading state
- Every form validates per the standard pattern
- Every destructive action has a confirmation dialog
- axe-core passes with zero violations
- The page is verified at desktop, tablet-landscape, and tablet-portrait widths
- Keyboard-only navigation works for every interaction on the page

---

## 8. Quick Reference

### 8.1 The non-negotiables

- This design system applies to **every page** of the internal admin UI — no exceptions, including pages already built
- All visual values come from tokens — no arbitrary colours, spacing, or sizes anywhere
- All components come from `packages/ui` — no per-page re-implementations
- One primary action per screen or dialog, in the accent coral
- Semantic colour conveys meaning only — never decoration
- Every list has an empty state; every data area has a loading state; every destructive action has a confirmation
- WCAG 2.2 AA is a release gate, checked automatically in CI
- Tablet layouts are a primary use case, tested on every page

### 8.2 Token cheat sheet

| Need | Use |
|---|---|
| Primary action | `--color-accent` (coral) |
| Brand / headings / active nav | `--color-brand-primary` (blue) |
| Page background | `--color-canvas` |
| Card / surface | `--color-surface` (white) |
| Body text | `--color-ink` |
| Helper / secondary text | `--color-ink-muted` |
| Default gap / card padding | `--space-4` / `--space-5` |
| Card radius | `--radius-lg` |
| Button / input radius | `--radius-md` / `--radius-sm` |
| Resting card shadow | `--shadow-sm` |
| Modal shadow | `--shadow-lg` |
| Body font size | 14px / 22px line height |
| Hover transition | `--motion-fast` (120ms) |

### 8.3 Relationship to the technical specification

This document governs **how** the admin UI looks and behaves. The CareRota Technical Specification v1.1 governs **what** each page does and what data it shows. Where the technical spec describes a screen (the leave approval three-panel layout, the pay run review, the chat panel), this design system describes how that screen is styled and constructed. The two are read together. Where the technical spec's sprint definitions of done and this document's visual-conformance gates both apply, **both** must be satisfied for a page to ship.
