# Supabase Setup - Meeting Notifications Log

Registra cada tentativa de envio de e-mail de convite de reuniao.

Status usados:
- `sent`
- `failed`
- `skipped`

```sql
create table if not exists public.meeting_notifications_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  recipient_person_id uuid references public.people(id) on delete set null,
  recipient_email text,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  sent_at timestamptz not null default now(),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_notifications_log_workspace_id
  on public.meeting_notifications_log(workspace_id);
create index if not exists idx_meeting_notifications_log_meeting_id
  on public.meeting_notifications_log(meeting_id);
create index if not exists idx_meeting_notifications_log_status
  on public.meeting_notifications_log(status, sent_at desc);

alter table public.meeting_notifications_log enable row level security;

drop policy if exists "meeting_notifications_log_read_member" on public.meeting_notifications_log;
create policy "meeting_notifications_log_read_member"
on public.meeting_notifications_log
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "meeting_notifications_log_insert_non_visualizer" on public.meeting_notifications_log;
create policy "meeting_notifications_log_insert_non_visualizer"
on public.meeting_notifications_log
for insert
to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);
```

## Validacao rapida

```sql
select
  meeting_id,
  recipient_email,
  status,
  payload,
  sent_at
from public.meeting_notifications_log
order by sent_at desc
limit 50;
```
