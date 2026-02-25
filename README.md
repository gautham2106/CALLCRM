# CallCRM — Admission Management System

A complete CRM system for college admission cells, built with Next.js 15, Supabase, and Tailwind CSS.

## Features

### Admin Portal
- **Analytics Dashboard** — Funnel charts, counsellor performance, source analysis, daily activity, stale lead alerts
- **Lead Management** — Full lead table with search, filter by stage/counsellor/priority, CSV export
- **CSV Import** — Drag-and-drop upload, column mapping, duplicate detection, preview before import
- **Assignment System** — Single/bulk assign, auto-distribute equally among counsellors, reassign with reason
- **Counsellor Management** — Add counsellors, view performance stats, activate/deactivate
- **Super Fields** — Custom field builder (text, number, phone, dropdown, date, checkbox, textarea)
- **Lead Sources** — Manage lead source list (Google Ad, Instagram, Walk-in, etc.)
- **Settings** — College profile management

### Counsellor Portal
- **Personal Dashboard** — Today's follow-ups, not-called leads, personal stats
- **My Leads** — Card view with filters (all / today's follow-ups / not called)
- **Lead Detail** — 3-tab view: Lead Info + Super Fields, Call Diary, Assignment History
- **Call Logging** — Log call result, update lead stage, add notes, set follow-up date
- **Notifications** — Real-time bell notifications for new lead assignments

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, TypeScript) |
| UI | Tailwind CSS + Radix UI primitives |
| Backend/DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Charts | Recharts |
| CSV | PapaParse |
| Hosting | Vercel |

## Database Schema

- `users` — Admin and counsellor accounts
- `colleges` — College profiles
- `leads` — All lead records with stage tracking
- `call_diary` — Immutable call history logs
- `lead_assignment_history` — Full assignment audit trail
- `custom_field_definitions` — Super field definitions
- `custom_field_values` — Super field values per lead
- `notifications` — Real-time notification store
- `lead_sources` — Configurable lead source list

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Database Migration

In your Supabase project, go to **SQL Editor** and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Create the First Admin User

In your Supabase project:
1. Go to **Authentication** → **Users** → **Add User**
2. Create a user with email/password
3. In **SQL Editor**, run:

```sql
INSERT INTO users (auth_id, name, email, role, college_id, is_active)
VALUES (
  'auth-user-id-from-step-1',
  'Admin Name',
  'admin@college.edu',
  'admin',
  '00000000-0000-0000-0000-000000000001',
  true
);
```

### 5. Install Dependencies and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

## Lead Stages

```
New Enquiry → Contacted → Visit Scheduled → Visit Done
→ Application Started → Enrolled → Cold Lead / Wrong Lead
```

## Call Stages

- Call Picked / Interested / Not Interested / Call Not Picked / Call Later

## Architecture

```
src/
├── app/
│   ├── admin/           # Admin pages (dashboard, leads, assignment, etc.)
│   ├── counsellor/      # Counsellor pages (dashboard, my leads, notifications)
│   └── auth/            # Login page
├── components/
│   ├── admin/           # Admin-specific components
│   ├── counsellor/      # Counsellor-specific components
│   ├── layout/          # Sidebars, TopBar
│   ├── shared/          # Shared components (LeadDetailClient)
│   └── ui/              # Base UI components (Button, Card, Input, etc.)
├── lib/
│   ├── supabase/        # Supabase client (browser + server)
│   ├── auth.ts          # Auth helpers
│   └── utils.ts         # Utilities and constants
├── middleware.ts         # Route protection
└── types/
    └── database.ts      # TypeScript types
```

## Deployment

Deploy to Vercel with one click or via CLI:

```bash
npx vercel --prod
```

Add the environment variables in Vercel project settings.
