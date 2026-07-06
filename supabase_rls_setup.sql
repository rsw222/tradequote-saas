-- TradeQuote SaaS RLS setup
-- Run this from Supabase SQL Editor after the app tables and storage buckets exist.

alter table public.businesses
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

update public.businesses b
set owner_user_id = bm.user_id
from public.business_members bm
where bm.business_id = b.business_id
  and bm.role = 'owner'
  and b.owner_user_id is null;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.businesses b
    where b.business_id = target_business_id
      and b.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
  )
  or exists (
    select 1
    from public.businesses b
    where b.business_id = target_business_id
      and b.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_storage_business_path(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  path_business_id uuid;
begin
  path_business_id := split_part(object_name, '/', 1)::uuid;
  return public.is_business_member(path_business_id)
    or exists (
      select 1
      from public.businesses b
      where b.business_id = path_business_id
        and b.owner_user_id = (select auth.uid())
    );
exception when others then
  return false;
end;
$$;

grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.can_access_storage_business_path(text) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_voice_notes enable row level security;

drop policy if exists "Business members can view businesses" on public.businesses;
drop policy if exists "Authenticated users can create owned businesses" on public.businesses;
drop policy if exists "Business owners can update businesses" on public.businesses;
drop policy if exists "Business owners can delete businesses" on public.businesses;

create policy "Business members can view businesses"
on public.businesses
for select
to authenticated
using (public.is_business_member(business_id) or owner_user_id = (select auth.uid()));

create policy "Authenticated users can create owned businesses"
on public.businesses
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "Business owners can update businesses"
on public.businesses
for update
to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

create policy "Business owners can delete businesses"
on public.businesses
for delete
to authenticated
using (public.is_business_owner(business_id));

drop policy if exists "Business members can view memberships" on public.business_members;
drop policy if exists "Owners can create memberships" on public.business_members;
drop policy if exists "Owners can update memberships" on public.business_members;
drop policy if exists "Owners can delete memberships" on public.business_members;

create policy "Business members can view memberships"
on public.business_members
for select
to authenticated
using (public.is_business_member(business_id) or user_id = (select auth.uid()));

create policy "Owners can create memberships"
on public.business_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and public.is_business_owner(business_id)
);

create policy "Owners can update memberships"
on public.business_members
for update
to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

create policy "Owners can delete memberships"
on public.business_members
for delete
to authenticated
using (public.is_business_owner(business_id));

drop policy if exists "Business members can select clients" on public.clients;
drop policy if exists "Business members can insert clients" on public.clients;
drop policy if exists "Business members can update clients" on public.clients;
drop policy if exists "Business members can delete clients" on public.clients;

create policy "Business members can select clients"
on public.clients for select to authenticated
using (public.is_business_member(business_id));

create policy "Business members can insert clients"
on public.clients for insert to authenticated
with check (public.is_business_member(business_id));

create policy "Business members can update clients"
on public.clients for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy "Business members can delete clients"
on public.clients for delete to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Business members can select jobs" on public.jobs;
drop policy if exists "Business members can insert jobs" on public.jobs;
drop policy if exists "Business members can update jobs" on public.jobs;
drop policy if exists "Business members can delete jobs" on public.jobs;

create policy "Business members can select jobs"
on public.jobs for select to authenticated
using (public.is_business_member(business_id));

create policy "Business members can insert jobs"
on public.jobs for insert to authenticated
with check (public.is_business_member(business_id));

create policy "Business members can update jobs"
on public.jobs for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy "Business members can delete jobs"
on public.jobs for delete to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Business members can select quotes" on public.quotes;
drop policy if exists "Business members can insert quotes" on public.quotes;
drop policy if exists "Business members can update quotes" on public.quotes;
drop policy if exists "Business members can delete quotes" on public.quotes;

create policy "Business members can select quotes"
on public.quotes for select to authenticated
using (public.is_business_member(business_id));

create policy "Business members can insert quotes"
on public.quotes for insert to authenticated
with check (public.is_business_member(business_id));

create policy "Business members can update quotes"
on public.quotes for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy "Business members can delete quotes"
on public.quotes for delete to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Business members can select quote items" on public.quote_items;
drop policy if exists "Business members can insert quote items" on public.quote_items;
drop policy if exists "Business members can update quote items" on public.quote_items;
drop policy if exists "Business members can delete quote items" on public.quote_items;

create policy "Business members can select quote items"
on public.quote_items for select to authenticated
using (
  exists (
    select 1
    from public.quotes q
    where q.quote_id = quote_items.quote_id
      and public.is_business_member(q.business_id)
  )
);

create policy "Business members can insert quote items"
on public.quote_items for insert to authenticated
with check (
  exists (
    select 1
    from public.quotes q
    where q.quote_id = quote_items.quote_id
      and public.is_business_member(q.business_id)
  )
);

create policy "Business members can update quote items"
on public.quote_items for update to authenticated
using (
  exists (
    select 1
    from public.quotes q
    where q.quote_id = quote_items.quote_id
      and public.is_business_member(q.business_id)
  )
)
with check (
  exists (
    select 1
    from public.quotes q
    where q.quote_id = quote_items.quote_id
      and public.is_business_member(q.business_id)
  )
);

create policy "Business members can delete quote items"
on public.quote_items for delete to authenticated
using (
  exists (
    select 1
    from public.quotes q
    where q.quote_id = quote_items.quote_id
      and public.is_business_member(q.business_id)
  )
);

drop policy if exists "Business members can select job photos" on public.job_photos;
drop policy if exists "Business members can insert job photos" on public.job_photos;
drop policy if exists "Business members can update job photos" on public.job_photos;
drop policy if exists "Business members can delete job photos" on public.job_photos;

create policy "Business members can select job photos"
on public.job_photos for select to authenticated
using (public.is_business_member(business_id));

create policy "Business members can insert job photos"
on public.job_photos for insert to authenticated
with check (public.is_business_member(business_id));

create policy "Business members can update job photos"
on public.job_photos for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy "Business members can delete job photos"
on public.job_photos for delete to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Business members can select job voice notes" on public.job_voice_notes;
drop policy if exists "Business members can insert job voice notes" on public.job_voice_notes;
drop policy if exists "Business members can update job voice notes" on public.job_voice_notes;
drop policy if exists "Business members can delete job voice notes" on public.job_voice_notes;

create policy "Business members can select job voice notes"
on public.job_voice_notes for select to authenticated
using (public.is_business_member(business_id));

create policy "Business members can insert job voice notes"
on public.job_voice_notes for insert to authenticated
with check (public.is_business_member(business_id));

create policy "Business members can update job voice notes"
on public.job_voice_notes for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create policy "Business members can delete job voice notes"
on public.job_voice_notes for delete to authenticated
using (public.is_business_member(business_id));

drop policy if exists "Business members can upload media" on storage.objects;
drop policy if exists "Business members can view media" on storage.objects;
drop policy if exists "Business members can update media" on storage.objects;
drop policy if exists "Business members can delete media" on storage.objects;

create policy "Business members can upload media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('job_photos', 'job_voice_notes')
  and public.can_access_storage_business_path(name)
);

create policy "Business members can view media"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('job_photos', 'job_voice_notes')
  and public.can_access_storage_business_path(name)
);

create policy "Business members can update media"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('job_photos', 'job_voice_notes')
  and public.can_access_storage_business_path(name)
)
with check (
  bucket_id in ('job_photos', 'job_voice_notes')
  and public.can_access_storage_business_path(name)
);

create policy "Business members can delete media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('job_photos', 'job_voice_notes')
  and public.can_access_storage_business_path(name)
);
