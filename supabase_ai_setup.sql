-- TradeQuote AI Scope Check setup
-- Run after the core TradeQuote tables and public.is_business_member() exist.

create extension if not exists vector;

create table if not exists public.ai_runs (
  ai_run_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  run_type text not null default 'scope_check',
  status text not null default 'completed',
  confidence numeric(5,2),
  summary text,
  missing_info jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  model_provider text,
  model_name text,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_questions (
  ai_question_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(ai_run_id) on delete cascade,
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete set null,
  question text not null,
  reason text,
  answer text,
  priority text not null default 'normal',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.ai_quote_suggestions (
  ai_quote_suggestion_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(ai_run_id) on delete cascade,
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete set null,
  suggestion_type text not null default 'quote_item',
  description text not null,
  item_type text,
  quantity numeric(12,2),
  unit text,
  unit_price numeric(12,2),
  amount numeric(12,2),
  confidence numeric(5,2),
  reason text,
  accepted boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_material_suggestions (
  ai_material_suggestion_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(ai_run_id) on delete cascade,
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete set null,
  material_name text not null,
  quantity numeric(12,2),
  unit text,
  allowance_amount numeric(12,2),
  confidence numeric(5,2),
  reason text,
  accepted boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_diagrams (
  ai_diagram_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_runs(ai_run_id) on delete set null,
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete set null,
  diagram_type text not null default 'scope_sketch',
  title text,
  description text,
  diagram_data jsonb not null default '{}'::jsonb,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_knowledge_documents (
  trade_knowledge_document_id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(business_id) on delete cascade,
  trade_type text,
  title text not null,
  content text not null,
  source_type text not null default 'manual',
  tags text[] default '{}',
  embedding vector(1536),
  is_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_assumptions (
  quote_assumption_id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(business_id) on delete cascade,
  job_id uuid references public.jobs(job_id) on delete set null,
  quote_id uuid references public.quotes(quote_id) on delete cascade,
  ai_run_id uuid references public.ai_runs(ai_run_id) on delete set null,
  assumption text not null,
  risk_level text not null default 'medium',
  accepted boolean default false,
  created_at timestamptz not null default now()
);

alter table public.ai_runs enable row level security;
alter table public.ai_questions enable row level security;
alter table public.ai_quote_suggestions enable row level security;
alter table public.ai_material_suggestions enable row level security;
alter table public.ai_diagrams enable row level security;
alter table public.trade_knowledge_documents enable row level security;
alter table public.quote_assumptions enable row level security;

drop policy if exists "Business members can select ai runs" on public.ai_runs;
drop policy if exists "Business members can insert ai runs" on public.ai_runs;
create policy "Business members can select ai runs" on public.ai_runs for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert ai runs" on public.ai_runs for insert to authenticated with check (public.is_business_member(business_id));

drop policy if exists "Business members can select ai questions" on public.ai_questions;
drop policy if exists "Business members can insert ai questions" on public.ai_questions;
drop policy if exists "Business members can update ai questions" on public.ai_questions;
create policy "Business members can select ai questions" on public.ai_questions for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert ai questions" on public.ai_questions for insert to authenticated with check (public.is_business_member(business_id));
create policy "Business members can update ai questions" on public.ai_questions for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "Business members can select quote suggestions" on public.ai_quote_suggestions;
drop policy if exists "Business members can insert quote suggestions" on public.ai_quote_suggestions;
drop policy if exists "Business members can update quote suggestions" on public.ai_quote_suggestions;
create policy "Business members can select quote suggestions" on public.ai_quote_suggestions for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert quote suggestions" on public.ai_quote_suggestions for insert to authenticated with check (public.is_business_member(business_id));
create policy "Business members can update quote suggestions" on public.ai_quote_suggestions for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "Business members can select material suggestions" on public.ai_material_suggestions;
drop policy if exists "Business members can insert material suggestions" on public.ai_material_suggestions;
drop policy if exists "Business members can update material suggestions" on public.ai_material_suggestions;
create policy "Business members can select material suggestions" on public.ai_material_suggestions for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert material suggestions" on public.ai_material_suggestions for insert to authenticated with check (public.is_business_member(business_id));
create policy "Business members can update material suggestions" on public.ai_material_suggestions for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "Business members can select ai diagrams" on public.ai_diagrams;
drop policy if exists "Business members can insert ai diagrams" on public.ai_diagrams;
create policy "Business members can select ai diagrams" on public.ai_diagrams for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert ai diagrams" on public.ai_diagrams for insert to authenticated with check (public.is_business_member(business_id));

drop policy if exists "Business members can select trade knowledge" on public.trade_knowledge_documents;
drop policy if exists "Business members can insert trade knowledge" on public.trade_knowledge_documents;
drop policy if exists "Business members can update trade knowledge" on public.trade_knowledge_documents;
create policy "Business members can select trade knowledge" on public.trade_knowledge_documents for select to authenticated using (is_global = true or public.is_business_member(business_id));
create policy "Business members can insert trade knowledge" on public.trade_knowledge_documents for insert to authenticated with check (business_id is not null and public.is_business_member(business_id));
create policy "Business members can update trade knowledge" on public.trade_knowledge_documents for update to authenticated using (business_id is not null and public.is_business_member(business_id)) with check (business_id is not null and public.is_business_member(business_id));

drop policy if exists "Business members can select quote assumptions" on public.quote_assumptions;
drop policy if exists "Business members can insert quote assumptions" on public.quote_assumptions;
drop policy if exists "Business members can update quote assumptions" on public.quote_assumptions;
create policy "Business members can select quote assumptions" on public.quote_assumptions for select to authenticated using (public.is_business_member(business_id));
create policy "Business members can insert quote assumptions" on public.quote_assumptions for insert to authenticated with check (public.is_business_member(business_id));
create policy "Business members can update quote assumptions" on public.quote_assumptions for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
