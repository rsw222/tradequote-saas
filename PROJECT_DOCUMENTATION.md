# TradeQuote SaaS Project Documentation

## Product Goal

TradeQuote is a SaaS app for Australian tradespeople to create faster, more accurate quotes from client details, job notes, photos, and voice recordings.

The long-term direction is a paid monthly platform where a tradie can:

- sign in and manage their business profile
- store clients, jobs, quotes, photos, and voice notes securely
- use AI/RAG to assist with quoting decisions
- generate quote documents
- track quote status from draft to accepted or rejected
- later assign follow-up work to an internal or external agent workflow

## Current Local App

Local development URL:

```text
http://127.0.0.1:4173/
```

This URL only works on the machine running the dev server.

## Current Stack

Frontend:

- Next.js 15
- React 19
- CSS in `app/globals.css`
- PWA assets in `public/`

Backend:

- Next.js API routes under `app/api/`
- Protected write routes using Supabase Auth bearer tokens
- Server-side LLM/RAG bridge route

Database and storage:

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Row Level Security
- Supabase JavaScript client

AI/RAG:

- Local trade guidance in `lib/knowledgeBase.js`
- AI bridge in `app/api/ai-assist/route.js`
- Hosted LLM support via environment variables:
  - `LLM_API_KEY` or `OPENAI_API_KEY`
  - optional `LLM_API_URL`
  - optional `LLM_MODEL`

## Environment Variables

Required local variables in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Optional for hosted AI:

```text
LLM_API_KEY=
OPENAI_API_KEY=
LLM_API_URL=
LLM_MODEL=
```

Optional for external Hermes agent assignment:

```text
HERMES_API_URL=
HERMES_WEBHOOK_URL=
HERMES_API_KEY=
HERMES_WEBHOOK_TOKEN=
```

Optional for Stripe billing:

```text
STRIPE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=
```

Optional for signed-in regression testing:

```text
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
```

Never place the Supabase service role key in browser code.

## Main App Flow

1. Business owner signs up or signs in.
2. User creates or selects a business.
3. User enters or selects a client.
4. User enters job details:
   - trade type
   - urgency
   - job description
   - photos
   - voice note or transcript
5. User creates quote line items.
6. User can ask the AI assistant for quoting guidance.
7. User saves the quote.
8. The app saves:
   - client
   - job
   - quote
   - quote items
   - job photos
   - voice note metadata/transcript
9. User can create follow-up tasks for a saved quote/job.
10. User can reopen saved quotes from quote history.
11. User can update quote status:
   - draft
   - sent
   - accepted
   - rejected
   - expired
12. User can export a print-ready quote/PDF.

## Current Database Tables

Expected Supabase tables:

```text
businesses
business_members
clients
jobs
quotes
quote_items
job_photos
job_voice_notes
agent_tasks
agent_activity_log
subscription_plans
business_subscriptions
usage_events
```

Core relationship:

```text
businesses.business_id
business_members.business_id
clients.business_id
jobs.business_id
quotes.business_id
job_photos.business_id
job_voice_notes.business_id
```

Jobs and quotes:

```text
jobs.client_id -> clients.client_id
quotes.job_id -> jobs.job_id
quotes.client_id -> clients.client_id
quote_items.quote_id -> quotes.quote_id
job_photos.job_id -> jobs.job_id
job_voice_notes.job_id -> jobs.job_id
agent_tasks.job_id -> jobs.job_id
agent_tasks.quote_id -> quotes.quote_id
agent_activity_log.agent_task_id -> agent_tasks.agent_task_id
```

## Storage Buckets

Required Supabase Storage buckets:

```text
job_photos
job_voice_notes
```

Current upload limits:

- maximum 8 photos per quote
- maximum 10 MB per photo
- accepted photo types: JPEG, PNG, WebP, HEIC, HEIF
- maximum 25 MB per voice note

Storage object paths are business-scoped:

```text
{business_id}/{job_id}/{file_name}
```

## API Routes

Protected routes:

```text
POST /api/clients/save
POST /api/quotes/save
POST /api/quotes/status
POST /api/media/job-photos
POST /api/media/job-voice
GET /api/agent-tasks
POST /api/agent-tasks
POST /api/agent-tasks/status
POST /api/hermes/assign
GET /api/billing/summary
POST /api/billing/checkout
POST /api/ai-assist
```

These routes require a signed-in Supabase user. The browser sends the Supabase access token in the `Authorization: Bearer <token>` header.

Important route behavior:

- `/api/clients/save` inserts or updates clients.
- `/api/quotes/save` saves client/job/quote/quote_items in one flow.
- `/api/quotes/status` updates quote workflow status.
- `/api/media/job-photos` uploads photos and stores metadata.
- `/api/media/job-voice` uploads voice notes or transcript-only notes.
- `/api/agent-tasks` loads and creates follow-up tasks.
- `/api/agent-tasks/status` updates task workflow status.
- `/api/hermes/assign` sends a task/job/quote payload to an external Hermes API or webhook when configured.
- `/api/billing/summary` loads plans, current subscription, and monthly usage.
- `/api/billing/checkout` starts Stripe Checkout when Stripe is configured.
- `/api/ai-assist` uses a hosted LLM when configured, otherwise returns local RAG fallback output.

## Security Implemented

Current app security features:

- Supabase Auth for sign in/sign up.
- RLS SQL script in `supabase_rls_setup.sql`.
- Business-member based access policies.
- Protected API routes for write operations.
- Basic per-user API rate limiting.
- File type and file size validation.
- Security headers in `next.config.mjs`:
  - Content Security Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - Permissions-Policy

Before launch:

- confirm RLS is enabled for all production tables
- confirm anon users cannot read business data
- confirm storage policies are business-scoped
- add audit logging for sensitive actions
- move production hosting away from a local development server

## Quote Features

Implemented:

- quote line items
- subtotal, GST, and total calculation
- saved quote history
- reopen saved quotes
- quote status workflow
- PDF/print export
- language labels for:
  - English
  - Mandarin
  - Malay
  - Italian
  - Hindi

Note: current multilingual support translates labels/headings. User-entered job text and quote items need hosted LLM translation later.

## AI/RAG Roadmap

Current:

- local trade guidance retrieval
- protected AI route
- optional hosted LLM call

Recommended next AI/RAG tables:

```text
knowledge_documents
knowledge_chunks
ai_runs
ai_feedback
```

Recommended AI capabilities:

- quote risk checks
- missing information detection
- trade-specific line item suggestions
- voice transcript summarisation
- customer-friendly quote wording
- multilingual quote translation
- later: photo-assisted approximate measurements
- later: 3D diagram generation from job data

For production RAG, use Supabase Postgres with `pgvector` or a dedicated vector database.

## Agent / Hermes Workflow Roadmap

Current internal task tables:

```text
agent_tasks
agent_activity_log
```

Current flow:

```text
Job created -> AI/Hermes reviews job -> task created -> assigned to user or role -> status tracked -> result logged back to job/quote
```

Implemented first tasks:

- confirm measurements
- prepare materials list
- follow up sent quote
- review quote risk
- translate quote
- prepare customer message

Task statuses:

```text
open
in_progress
blocked
done
cancelled
```

External Hermes bridge:

```text
Task created -> Send Hermes -> POST /api/hermes/assign -> external Hermes webhook/API -> activity logged
```

The app-side bridge exists now. To make it live, configure either:

```text
HERMES_API_URL
```

or:

```text
HERMES_WEBHOOK_URL
```

If Hermes requires authentication, also configure either:

```text
HERMES_API_KEY
```

or:

```text
HERMES_WEBHOOK_TOKEN
```

Keep all Hermes keys server-side only.

## SaaS Launch Roadmap

Phase 1: Working secure MVP

- finish RLS verification
- update documentation
- add regression tests
- test with a small group of tradespeople

Phase 2: SaaS foundation

- Stripe subscriptions
- plan limits
- account/billing page
- audit logs
- production hosting
- backups and monitoring

Current billing foundation:

- `subscription_plans`
- `business_subscriptions`
- `usage_events`
- app subscription panel
- protected billing summary API
- Stripe Checkout placeholder API
- backend entitlement checks
- monthly usage counting
- pilot onboarding progress strip
- mobile sticky quote action bar
- explicit mobile viewport/PWA safe-area support

Current default/free entitlement when a business has no active paid subscription:

```text
5 quotes/month
photos enabled
voice disabled
AI disabled
tasks disabled
team disabled
```

Usage events currently recorded:

```text
quote_created
quote_updated
photo_uploaded
voice_uploaded
ai_request
task_created
```

Stripe still needs:

- Stripe products and prices
- `stripe_price_id` values added to `subscription_plans`
- `STRIPE_SECRET_KEY` in `.env.local`
- Stripe webhook route for subscription updates

Phase 3: AI quoting assistant

- production RAG storage
- hosted LLM
- AI quote review
- voice and photo analysis workflow
- multilingual quote generation

Phase 4: Market testing

- pilot with 5 to 10 tradespeople
- measure time saved per quote
- measure quote acceptance rate
- collect feedback by trade type
- refine pricing and positioning

## Regression Testing

Current lightweight smoke test:

```powershell
npm.cmd run test:smoke
```

This checks:

- the home page loads
- removed routes stay removed
- protected API routes reject unauthenticated writes
- protected task APIs reject unauthenticated reads/writes
- security headers are present

Signed-in API regression test:

```powershell
npm.cmd run test:regression
```

This test signs into Supabase with `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`, then checks:

- sign in
- create/load business
- save client
- save quote
- update quote status
- upload photo or confirm plan blocks it
- upload voice or confirm plan blocks it
- create task or confirm plan blocks it
- run AI or confirm plan blocks it
- load billing summary

Use a dedicated test user, not your personal/admin login.

Manual browser tests still required:

- create/select business from the UI
- save client from the UI
- save quote from the UI
- upload photo from the UI
- record/upload voice note from the UI
- reopen saved quote
- update quote status
- export quote/PDF

## Development Commands

Install dependencies:

```powershell
npm.cmd install
```

Start dev server:

```powershell
npm.cmd run dev
```

Build:

```powershell
npm.cmd run build
```

Run smoke tests:

```powershell
npm.cmd run test:smoke
```

Run signed-in regression tests:

```powershell
npm.cmd run test:regression
```

## Important Local Development Note

This project is currently stored in OneDrive. Next.js can occasionally hit `.next` cache issues while OneDrive syncs files. If the app starts returning unexplained 500 errors during local development:

1. stop the Node/Next dev server
2. delete `.next`
3. restart the dev server

When Supabase calls fail with a certificate error on Windows, start the server with:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm.cmd run dev
```
