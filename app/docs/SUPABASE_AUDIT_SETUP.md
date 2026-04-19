create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'status_update', 'sync')),
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_read_authenticated" on public.audit_logs;
create policy "audit_logs_read_authenticated"
on public.audit_logs
for select
to authenticated
using (true);

drop policy if exists "audit_logs_insert_non_visualizer" on public.audit_logs;
create policy "audit_logs_insert_non_visualizer"
on public.audit_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

