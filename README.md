# CallCRM — College Admission Management System

A full-stack CRM built for college admission cells. Manage leads, counsellors, and teams across the entire admission funnel — from first enquiry to enrolled student.

Built with **Next.js 16**, **Supabase**, and **Tailwind CSS**.

---

## Table of Contents

- [Features](#features)
  - [Admin Portal](#admin-portal)
  - [Team Leader Portal](#team-leader-portal)
  - [Counsellor Portal](#counsellor-portal)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Lead & Call Stages](#lead--call-stages)
- [Roles & Permissions](#roles--permissions)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Push Notifications](#push-notifications)
- [Cron Jobs](#cron-jobs)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Features

### Admin Portal

#### Analytics Dashboard (`/admin`)

- **KPI Cards** — Total leads, enrolled count, in-progress, cold/wrong leads, unassigned count, today's follow-ups, stale leads, today's visits, calls made today
- **Funnel Chart** — Stage-by-stage lead count across the full admission pipeline
- **Counsellor Performance Table** — Per-counsellor: assigned, called, not called, interested, not interested, enrolled, conversion %, follow-ups today, missed follow-ups, visits overdue, no-show; sortable by any column; all numbers link to the filtered leads page
- **Source Intelligence** — Lead source table: total, enrolled, conversion rate, month-over-month trend; tap any row to expand a 20-lead preview panel with a "View all N leads →" deep-link to the filtered leads page
- **Interest Intelligence** — School-wise and counsellor-wise interest analytics (see [Interest Intelligence](#interest-intelligence) below)
- **Team Performance Funnel** — Per team-leader: counsellors, total leads, called, not-called, interested, not interested, enrolled, stale, today's follow-ups
- **Stale Lead Alerts** — Leads untouched for 3+ days flagged on the dashboard
- All analytics computed via SQL aggregate RPCs — no full-table JS scans

---

#### Lead Management (`/admin/leads`)

- Server-side paginated lead table — never loads the full dataset in the browser
- **Search** — Name, phone, email, city full-text search with 400 ms debounce; PostgREST operators stripped from input
- **Filters** — Lead stage, call stage, counsellor (or "Unassigned"), source (including "Unknown / No Source"), course, school; all filters are deep-linkable via URL params (e.g. `?source=<id>`, `?stage=Enrolled`, `?callStage=Not+Interested`)
- **Tabs** — All / Unassigned / Visit Follow-up (overdue visits) / Missed Follow-ups
- **Bulk actions** — Select individual rows or all matching leads across pages; bulk assign, reassign, change stage, or delete
- **Select all matching** — When filtered, "Select all {N} matching leads" fetches every ID for the active filter set (not just the current page) and applies bulk actions to the entire result
- **Auto-Distribute** — Spreads unassigned leads equally across all active counsellors in one click
- **CSV Export** — Exports all leads matching the current filters as a `.csv` file including all custom field columns (admin only)
- **Add Lead** — Inline dialog with duplicate phone detection per college
- **Lead Detail** (`/admin/leads/[id]`) — Full lead profile (see [Lead Detail](#lead-detail) below)

---

#### Lead Detail

Both admin and counsellor views share the same `LeadDetailClient` component. Behaviour differs by role.

##### Header

| Element | Description |
|---|---|
| **Call button** | `tel:{phone}` link — triggers native phone dialler on mobile, system phone client on desktop |
| **WhatsApp button** | Opens `https://wa.me/91{phone}` in a new tab. Country code `91` is prepended automatically; any non-digit characters are stripped from the number first. An optional pre-filled message can be appended as a URL-encoded query param |
| **Lead name** | Large heading with role-based editability |
| **Stage badges** | Lead stage + call stage — colour-coded pills |
| **Visit badge** | Purple pill with calendar icon when a visit date is scheduled |
| **Meta strip** | Phone · City · School · Course interest · Source · Assigned counsellor · Follow-up date (orange if today or overdue) |

##### Tab 1 — Lead Info

- **Basic fields**: Name, phone, email, city, school name, course interest, source — admins can edit all fields; counsellors can edit all except name, phone, and source
- **Status & follow-up**: Lead stage, visit date, follow-up date, notes — editable by both roles
- **Super Fields**: Every active custom field defined for the college is rendered here with the appropriate input (see [Super Fields](#super-fields--custom-fields))
- **Save Changes** button — saves lead fields and all custom field values in one request; checks for duplicate phone before saving (admin only)

##### Tab 2 — Call Diary

- Full chronological call log with the most recent entry at the top
- Each entry shows: call result, lead stage at that time, counsellor name, timestamp, notes, and the next follow-up date scheduled
- **Log a Call** button opens a modal to record: call result, updated lead stage, notes, and next follow-up date
- Saving the log creates an immutable row in `call_diary` and updates `current_call_stage` and `current_lead_stage` on the lead

##### Tab 3 — Assignment History

- Complete audit trail of every assignment and reassignment
- Each entry shows: previous owner → new owner, who made the change, timestamp, and reason (required on reassign)

---

#### CSV Import (`/admin/leads/import`)

- Drag-and-drop or file-picker upload
- Column mapping UI — map spreadsheet columns to CRM fields
- Duplicate phone detection before import
- Preview of the first N rows before committing
- Background import with progress feedback; push notification sent to admin on completion

---

#### Assignment System (`/admin/assignment`)

- Assign unassigned leads to a counsellor one-by-one or in bulk
- **Auto-distribute** — Spreads leads equally across all active counsellors
- Reassign with a mandatory reason (logged in assignment history)
- Real-time push notification sent to the counsellor on new assignment

---

#### Counsellor Management (`/admin/counsellors`)

- List all counsellors with full performance data
- Add new counsellor (creates Supabase Auth user + profile row in one step)
- Activate / deactivate counsellors
- Per-counsellor detail page (`/admin/counsellors/[id]`) with their full lead list and stats

**Desktop table — two focused tab views (neither tab is ever too wide to fit the screen):**

| Tab | Columns |
|---|---|
| **Performance** (default) | Counsellor · Status · Assigned · Called · Not Called · Interested · Not Interested · Enrolled · Conv% |
| **Action Items** | Counsellor · Status · F/U Today · Missed F/U · Visit O/D · No Show |

- **Action Items** tab shows a red badge with the total urgent count across all counsellors
- Every column header is clickable to sort (click again to reverse direction)
- Every number is a clickable link to the filtered leads page for that counsellor + metric
- Counsellor avatar turns red when they have outstanding action items

**Mobile card view:**

- Each counsellor shows as a card with Performance stats in a 2-row grid
- A red **"Needs attention"** strip appears at the bottom only when any urgent count (F/U Today, Missed F/U, Visit Overdue, No Show) is > 0
- Card border turns red when the counsellor has action items outstanding

---

#### Interest Intelligence

Accessible from the **Interest** tab on the admin analytics dashboard.

##### School-wise Interest Stats

Answers: *Which schools send students who are most likely to be interested?*

| Column | Description |
|---|---|
| School | School name |
| Total | All leads from this school |
| Interested | Leads where `current_call_stage = 'Interested'` |
| Not Interested | Leads where `current_call_stage = 'Not Interested'` |
| Interest Rate % | `interested / total × 100` |

- Best-rate school (min. 5 leads) highlighted in green; worst-rate in red
- Sortable by any column; paginated 10 rows at a time with a "See All" toggle
- Powered by `get_school_interest_stats` SQL RPC

##### Counsellor-wise Interest Analysis

Answers: *Which counsellors have an unusually high "Not Interested" rate — and may need coaching?*

| Column | Description |
|---|---|
| Counsellor | Name + "Review" badge if flagged |
| Called | Total leads the counsellor has called |
| Interested | Count of interested leads |
| Not Interested | Count of not-interested leads |
| NI Ratio % | `not_interested / total_called × 100` |

**Flagging logic:** A counsellor with 10+ calls is flagged when their NI ratio exceeds `avg NI ratio × 1.5`. The average ratio and flag threshold are shown at the bottom of the panel.

- Sortable by any column; paginated with a "See All" toggle
- Powered by `get_counsellor_interest_stats` SQL RPC

---

#### Super Fields / Custom Fields (`/admin/super-fields`)

Build custom fields for the lead profile without touching code.

**Supported field types:**

| Type | UI rendered on lead detail |
|---|---|
| Text | Single-line text input |
| Number | Numeric input |
| Phone | `tel` input |
| Email | `email` input |
| Dropdown | Select with configurable options |
| Date | Date picker |
| Checkbox | Toggle (stored as `'true'` / `'false'`) |
| Textarea | Multi-line text, 3 rows |

**Management (admin only):**

- Add a field — enter name, choose type, add dropdown options if applicable, mark as required
- Edit — update name, type, options, or required status at any time
- Show / hide — toggle `is_active` without deleting the field or its values
- Delete — permanent removal with confirmation dialog
- Display order — controlled by `display_order` integer; drag handle in the UI

**How values are stored:**

- Field definitions live in `custom_field_definitions` (per college)
- Values live in `custom_field_values` (per lead × per field, upserted on save)
- Composite unique key: `(lead_id, field_id)`
- All types stored as `TEXT`; checkbox uses `'true'` / `'false'`
- `updated_by` and `updated_at` tracked on every value row

**CSV Export integration:**

- Custom fields appear as additional columns in the exported CSV
- Columns ordered by `display_order`; only `is_active` fields are included

---

#### School Name & School Filtering

- `school_name` is a text field on every lead — captured at import or manual entry
- Shown in the lead detail header meta strip and in the lead table
- **School filter** in the admin leads table — dropdown populated from all unique school names in the college's leads
- Deep-linkable: `/admin/leads?school={school_name}`
- Feeds directly into the **School-wise Interest Stats** panel in Interest Intelligence

---

#### Team Leader Management (`/admin/team-leaders`)

- Create team leader accounts
- Assign counsellors to a team leader
- Team leaders are scoped to see only their own counsellors' leads and stats

---

#### Course Management (`/admin/courses`)

- Add and manage courses offered by the college
- Courses are selectable when adding or editing leads
- Filter leads by course in the leads table

---

#### Lead Sources (`/admin/sources`)

- Add / deactivate lead sources (e.g. Google Ad, Instagram, Walk-in, Reference)
- Source used to tag leads at creation; snapshot stored on the lead record so renaming a source later does not break historical data
- Source Intelligence analytics powered by these tags

---

#### Settings (`/admin/settings`)

- College profile — name, email, phone, address, logo

---

### Team Leader Portal

Team leaders share the admin layout but are scoped to their own team.

- **Dashboard** — Full counsellor performance table: Assigned, Called, Not Called, Interested, Not Interested, Enrolled, Conv%, Follow-ups Today, Missed F/U, Visit Overdue, No Show — all sortable, all numbers link to filtered leads
- **Leads** — All leads assigned to their counsellors; search, filter, export
- **Assignment** — Assign / reassign leads within their team
- **Counsellors** — Same two-tab table (Performance / Action Items) as the admin view; cannot create new users

**Counsellor stats — metric definitions:**

| Metric | Source |
|---|---|
| Assigned | Total active leads assigned to the counsellor |
| Called | Leads where a call stage has been logged |
| Not Called | Assigned − Called |
| Interested | Leads where `current_call_stage = 'Interested'` |
| Not Interested | Leads where `current_call_stage = 'Not Interested'` |
| Enrolled | Leads where `current_lead_stage = 'Enrolled'` |
| Conv% | Enrolled ÷ Assigned × 100 |
| Follow-ups Today | Active leads with `follow_up_date = today` |
| Missed F/U | Active leads with `follow_up_date < today` |
| Visit Overdue | Leads in `Visit Scheduled` with `visit_date < today` |
| No Show | Leads in `No Show` stage |

---

### Counsellor Portal

#### Dashboard (`/counsellor`)

- Today's follow-ups count and list
- Not-called leads count
- Personal stats: assigned, called, interested, enrolled

#### My Leads (`/counsellor/leads`)

- Card-based lead list (mobile-first)
- Tabs: **All** / **Follow-ups today** / **Not Called**
- Each card shows: name, phone, school, city, lead stage, call stage badge, follow-up date
- **Call button** (`tel:` link) and **WhatsApp button** (`wa.me` link) on every card for one-tap action

#### Lead Detail (`/counsellor/leads/[id]`)

Same three-tab layout as admin (Lead Info · Call Diary · Assignment History) with these differences:

- Cannot edit name, phone, or source
- Cannot reassign leads
- Can log calls and update all status/date fields

#### Call Logging

- Select call result (Call Picked / Interested / Not Interested / Call Not Picked / Call Later)
- Update lead stage
- Add notes
- Set follow-up date
- Submitting creates an immutable record in `call_diary` and updates the lead's current stages

#### Notifications (`/counsellor/notifications`)

- Real-time in-app bell icon with unread badge (Supabase Realtime)
- Full notification list page
- Push notifications via Web Push API (browser prompt on first visit)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| UI | Tailwind CSS + Radix UI primitives |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime (notifications) |
| Push | Web Push API (`web-push`) |
| CSV Parse | PapaParse |
| CSV/Excel | SheetJS (xlsx) |
| Date utils | date-fns |
| Hosting | Vercel |

---

## Database Schema

### `colleges`

College profile. All data is scoped to a `college_id`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| email, phone, address | TEXT | |
| logo_url | TEXT | |
| subscription_plan | TEXT | `free` default |
| is_active | BOOLEAN | |

### `users`

All user accounts — admins, team leaders, counsellors.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| auth_id | UUID | Links to Supabase Auth |
| name, email, phone | TEXT | |
| role | TEXT | `admin` / `team_leader` / `counsellor` |
| college_id | UUID FK → colleges | |
| team_leader_id | UUID FK → users | Counsellors assigned to a TL |
| is_active | BOOLEAN | |

### `leads`

Core entity. One row per enquiry.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| college_id | UUID FK | |
| name, phone, email, city | TEXT | |
| school_name | TEXT | School the student came from; feeds Interest Intelligence |
| course_interest | TEXT | Free-text interest note |
| course_id | UUID FK → courses | |
| source_id | UUID FK → lead_sources | |
| source_name | TEXT | Snapshot at creation time |
| current_lead_stage | TEXT | See Lead Stages below |
| current_call_stage | TEXT | See Call Stages below |
| assigned_to | UUID FK → users | |
| priority | TEXT | `Hot` / `Warm` / `Cold` |
| follow_up_date | DATE | |
| visit_date | DATE | |
| notes | TEXT | |
| is_active | BOOLEAN | Soft delete |

### `call_diary`

Immutable call log. Append-only.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | UUID FK | |
| college_id | UUID FK | |
| called_by | UUID FK → users | |
| call_stage | TEXT | Result of the call |
| lead_stage_at_time | TEXT | Snapshot of lead stage at call time |
| notes | TEXT | |
| follow_up_date | DATE | Next follow-up scheduled during this call |

### `lead_assignment_history`

Full audit trail of every assignment and reassignment.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | UUID FK | |
| assigned_from | UUID FK → users | Previous owner (null on first assignment) |
| assigned_to | UUID FK → users | New owner |
| assigned_by | UUID FK → users | Who made the change |
| reason | TEXT | Required on reassign |

### `custom_field_definitions`

Schema for Super Fields, defined per college.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| college_id | UUID FK | |
| field_name | TEXT | |
| field_type | TEXT | `text` / `number` / `phone` / `email` / `dropdown` / `date` / `checkbox` / `textarea` |
| dropdown_options | JSONB | Array of strings for dropdown fields |
| is_required | BOOLEAN | Enforced in the lead detail save path |
| display_order | INTEGER | Controls rendering order on lead detail |
| is_active | BOOLEAN | Soft hide/show without deletion |

### `custom_field_values`

Per-lead values for Super Fields.

| Column | Type | Notes |
|---|---|---|
| lead_id + field_id | UUID FKs | Composite unique key |
| value | TEXT | All types stored as text; checkbox = `'true'`/`'false'` |
| college_id | UUID FK | Denormalised for RLS |
| updated_by | UUID FK → users | |
| updated_at | TIMESTAMPTZ | |

### `courses`

Courses offered by the college.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| college_id | UUID FK | |
| course_name | TEXT | |

### `lead_sources`

Configurable source list per college.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| college_id | UUID FK | |
| source_name | TEXT | e.g. "Google Ad", "Walk-in" |

### `notifications`

In-app notification store.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| title, body | TEXT | |
| is_read | BOOLEAN | |
| lead_id | UUID FK | Optional deep-link target |

### `push_subscriptions`

Web Push API device subscriptions.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| endpoint | TEXT UNIQUE | Push endpoint URL |
| keys | JSONB | `auth` + `p256dh` keys |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `GET /api/admin/leads` | GET | Paginated, filtered lead list. Params: `page`, `limit`, `search`, `stage`, `callStage`, `counsellor`, `source`, `course`, `school`, `tab`, `export`, `ids_only` |
| `POST /api/admin/leads` | POST | Create a single lead with duplicate phone check |
| `PATCH /api/admin/leads` | PATCH | Bulk stage update for selected lead IDs |
| `DELETE /api/admin/leads` | DELETE | Bulk delete selected lead IDs |
| `POST /api/admin/assign` | POST | Single or bulk lead assignment / reassignment; sends push notification to assignee |
| `GET /api/admin/counsellors` | GET | List counsellors (scoped to TL if role = team_leader) |
| `POST /api/admin/counsellors` | POST | Create counsellor (Auth user + profile row) |
| `GET /api/admin/team-leaders` | GET | List team leaders for the college |
| `POST /api/admin/team-leaders` | POST | Create team leader account |
| `POST /api/admin/import-notify` | POST | Send push notification to admin after CSV import |
| `POST /api/push/subscribe` | POST | Register a Web Push device subscription |
| `POST /api/push/test` | POST | Send a test push notification |
| `GET /api/cron/reminders` | GET | Cron endpoint — sends follow-up/visit reminders to counsellors (protected by `CRON_SECRET`) |
| `ANY /api/supabase/[...path]` | ANY | Supabase proxy |

---

## Lead & Call Stages

### Lead Stages (ordered funnel)

```
New Enquiry → Contacted → Visit Scheduled → Visit Done
→ Application Started → Enrolled
                         ↘ Cold Lead / Wrong Lead
```

### Call Stages

| Stage | Meaning |
|---|---|
| Call Picked | Connected successfully |
| Interested | Student expressed interest |
| Not Interested | Student declined |
| Call Not Picked | No answer |
| Call Later | Asked to call back |

### Lead Priority

`Hot` / `Warm` / `Cold` — set by the counsellor, visible in the lead card and detail header.

---

## Roles & Permissions

| Capability | Admin | Team Leader | Counsellor |
|---|---|---|---|
| View all leads (college-wide) | ✅ | ✅ (own team) | ✅ (own leads) |
| Assign / reassign leads | ✅ | ✅ (own team) | ❌ |
| CSV import | ✅ | ❌ | ❌ |
| CSV export | ✅ | ✅ | ❌ |
| Add counsellors | ✅ | ❌ | ❌ |
| Add team leaders | ✅ | ❌ | ❌ |
| Manage courses | ✅ | ❌ | ❌ |
| Manage sources | ✅ | ❌ | ❌ |
| Manage super fields | ✅ | ❌ | ❌ |
| Log calls | ❌ | ❌ | ✅ |
| View analytics dashboard | ✅ | ✅ (own team) | ❌ |
| Edit college settings | ✅ | ❌ | ❌ |
| Edit lead name / phone / source | ✅ | ❌ | ❌ |

Route protection is enforced in `src/middleware.ts` (redirects by role) and in each server component via `requireAdmin()` / `requireAdminOrTeamLeader()` / `requireCounsellor()` helpers in `src/lib/auth.ts`.

---

## Setup & Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/callcrm.git
cd callcrm
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Run database migrations

In your Supabase project go to **SQL Editor** and run each file in `supabase/migrations/` in order:

```
001_initial_schema.sql
002_fix_users_rls.sql
003_add_visit_date.sql
20240301_push_subscriptions.sql
20240302_push_subscriptions_multidevice.sql
20240303_add_courses.sql
20240305_performance_fix.sql
20240310_cron_reminders.sql
20240311_add_school_name.sql
20240312_source_interest_stats.sql
20240313_team_leader_role.sql
20240314_team_performance.sql
20240315_counsellor_stats_not_interested.sql
20240316_source_stats_add_source_id.sql
```

### 4. Set environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see [Environment Variables](#environment-variables) below.

### 5. Create the first admin user

In Supabase → **Authentication** → **Users** → **Add User**, create a user with email and password.

Then in **SQL Editor**:

```sql
INSERT INTO users (auth_id, name, email, role, college_id, is_active)
VALUES (
  '<auth-user-id-from-step-above>',
  'Admin Name',
  'admin@college.edu',
  'admin',
  (SELECT id FROM colleges LIMIT 1),
  true
);
```

If no college row exists yet:

```sql
INSERT INTO colleges (id, name) VALUES (uuid_generate_v4(), 'My College');
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only, never exposed to browser) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ (push) | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | ✅ (push) | VAPID private key for Web Push |
| `VAPID_SUBJECT` | ✅ (push) | `mailto:your@email.com` — VAPID subject |
| `CRON_SECRET` | ✅ (cron) | Bearer token for `/api/cron/reminders` |

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

---

## Database Migrations

Run migrations in the order listed above. Each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).

If you need to re-run a migration that changes a function signature (return type), the file already includes a `DROP FUNCTION IF EXISTS` before recreating it.

---

## Push Notifications

CallCRM uses the **Web Push API** to send browser push notifications.

**Supported events:**
- New lead assigned to a counsellor
- Lead reassigned to a counsellor
- Daily follow-up / visit reminders (via cron)
- CSV import completion (admin)

**Setup:**
1. Generate VAPID keys (`npx web-push generate-vapid-keys`) and add to env
2. Counsellors subscribe from the notifications page (browser prompts for permission)
3. Subscriptions stored in `push_subscriptions` table (one row per device/browser)

---

## Cron Jobs

`GET /api/cron/reminders` runs 4× daily (configured in Supabase `pg_cron` or Vercel Cron). It:

1. Finds all active leads with `follow_up_date = today` or `visit_date = today`
2. Groups them by assigned counsellor
3. Sends each counsellor a push notification summarising their due items

**Authorization:** The request must include `Authorization: Bearer <CRON_SECRET>`.

To schedule in Supabase (requires `pg_net`):

```sql
select cron.schedule(
  'daily-reminders',
  '30 3,6,9,12 * * *',   -- 9am, 12pm, 3pm, 6pm IST
  $$
    select net.http_post(
      url := 'https://your-app.vercel.app/api/cron/reminders',
      headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
    )
  $$
);
```

Or use Vercel Cron in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "30 3,6,9,12 * * *" }
  ]
}
```

---

## Deployment

### Vercel (recommended)

```bash
npx vercel --prod
```

Add all environment variables in the Vercel project dashboard under **Settings → Environment Variables**.

### Other platforms

Any Node.js host that supports Next.js 16 App Router works. Ensure:
- `SUPABASE_SERVICE_ROLE_KEY` is set as a secret (never in client bundle)
- The cron endpoint is reachable and protected by `CRON_SECRET`

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Root redirect (→ login or dashboard by role)
│   ├── auth/
│   │   └── login/page.tsx            # Login page
│   ├── admin/
│   │   ├── page.tsx                  # Admin analytics dashboard
│   │   ├── leads/
│   │   │   ├── page.tsx              # Lead table
│   │   │   ├── [id]/page.tsx         # Lead detail
│   │   │   └── import/page.tsx       # CSV import
│   │   ├── assignment/page.tsx       # Bulk assignment
│   │   ├── counsellors/
│   │   │   ├── page.tsx              # Counsellor list + two-tab perf table
│   │   │   └── [id]/page.tsx         # Counsellor detail
│   │   ├── team-leaders/page.tsx     # Team leader management
│   │   ├── courses/page.tsx          # Course management
│   │   ├── sources/page.tsx          # Lead source management
│   │   ├── super-fields/page.tsx     # Custom field builder
│   │   └── settings/page.tsx         # College settings
│   ├── counsellor/
│   │   ├── page.tsx                  # Counsellor dashboard
│   │   ├── leads/
│   │   │   ├── page.tsx              # My leads (card view)
│   │   │   └── [id]/page.tsx         # Lead detail
│   │   └── notifications/page.tsx    # Notification list
│   └── api/
│       ├── admin/
│       │   ├── leads/route.ts        # CRUD + paginated query
│       │   ├── assign/route.ts       # Assignment engine
│       │   ├── counsellors/route.ts  # Counsellor CRUD
│       │   ├── team-leaders/route.ts # Team leader CRUD
│       │   └── import-notify/route.ts
│       ├── push/
│       │   ├── subscribe/route.ts    # Register push device
│       │   └── test/route.ts         # Test push
│       ├── cron/
│       │   └── reminders/route.ts    # Daily reminder cron
│       └── supabase/[...path]/route.ts
├── components/
│   ├── admin/
│   │   ├── AdminAnalyticsClient.tsx      # Dashboard: KPIs, funnel, source intel, interest intel, team perf
│   │   ├── AdminLeadsClient.tsx          # Lead table + filters + bulk actions
│   │   ├── AdminAssignmentClient.tsx     # Assignment UI
│   │   ├── CounsellorsClient.tsx         # Counsellor management + two-tab perf table
│   │   ├── AdminImportClient.tsx         # CSV import wizard
│   │   ├── AdminCoursesClient.tsx        # Course management
│   │   ├── AdminSourcesClient.tsx        # Source management
│   │   ├── AdminSuperFieldsClient.tsx    # Custom field builder
│   │   ├── AdminSettingsClient.tsx       # College settings
│   │   └── TeamLeaderDashboardClient.tsx # TL dashboard with counsellor stats table
│   ├── counsellor/
│   │   ├── CounsellorDashboardClient.tsx
│   │   ├── CounsellorLeadsClient.tsx     # Card list with Call + WhatsApp buttons
│   │   └── CounsellorNotificationsClient.tsx
│   ├── shared/
│   │   └── LeadDetailClient.tsx          # Used by both admin + counsellor detail pages
│   ├── layout/
│   │   ├── AdminSidebar.tsx
│   │   ├── CounsellorSidebar.tsx
│   │   └── TopBar.tsx
│   └── ui/                               # Base components (Button, Card, Dialog, Select …)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client (cookies)
│   │   └── admin.ts                  # Service role client (API routes)
│   ├── auth.ts                       # requireAdmin / requireCounsellor helpers
│   ├── webpush.ts                    # sendPush() wrapper
│   └── utils.ts                      # todayIST(), getWhatsAppLink(), getCallLink(), stage colours
├── middleware.ts                     # Route protection + role-based redirects
└── types/
    └── database.ts                   # TypeScript types for all DB tables

supabase/
└── migrations/                       # All SQL migrations in order
```

---

## Performance Notes

- Lead tables never fetch all rows — server-side pagination via `GET /api/admin/leads` with `range()`
- All dashboard analytics use SQL `GROUP BY` aggregate RPCs (`get_stage_counts`, `get_counsellor_stats`, `get_source_stats`, `get_school_interest_stats`, `get_counsellor_interest_stats`, `get_team_performance`) — no full-table JS aggregation
- Source Intelligence preview fetches 20 leads per source using a window function (`ROW_NUMBER() OVER PARTITION BY source`) in `get_source_recent_leads`
- Composite indexes on `(college_id, current_lead_stage)`, `(college_id, assigned_to)`, `(college_id, follow_up_date)`, `(college_id, updated_at)` cover all common filter patterns
- All times stored in UTC; IST conversion happens at display time via `todayIST()` and `toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })`
- WhatsApp and Call links are pure HTML anchors — zero JS overhead; country code normalisation happens in `getWhatsAppLink()` in `utils.ts`
