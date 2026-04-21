# Supabase Setup - Meeting Calendar Events

Este passo habilita sincronizacao de **reunioes** com Google Calendar.

Sem esta tabela:
- as reunioes continuam funcionando no PLID
- o botao de sincronizacao mostra setup pendente

```sql
create table if not exists public.meeting_calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid not null unique references public.meetings(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_calendar_events_workspace_id
  on public.meeting_calendar_events(workspace_id);

create index if not exists idx_meeting_calendar_events_meeting_id
  on public.meeting_calendar_events(meeting_id);

alter table public.meeting_calendar_events enable row level security;

drop trigger if exists trg_meeting_calendar_events_updated_at on public.meeting_calendar_events;
create trigger trg_meeting_calendar_events_updated_at
before update on public.meeting_calendar_events
for each row execute function public.set_updated_at();

drop policy if exists "meeting_calendar_events_read_authenticated" on public.meeting_calendar_events;
create policy "meeting_calendar_events_read_authenticated"
on public.meeting_calendar_events
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "meeting_calendar_events_insert_non_visualizer" on public.meeting_calendar_events;
create policy "meeting_calendar_events_insert_non_visualizer"
on public.meeting_calendar_events
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

drop policy if exists "meeting_calendar_events_update_non_visualizer" on public.meeting_calendar_events;
create policy "meeting_calendar_events_update_non_visualizer"
on public.meeting_calendar_events
for update
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  public.can_manage_workspace(workspace_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "meeting_calendar_events_delete_non_visualizer" on public.meeting_calendar_events;
create policy "meeting_calendar_events_delete_non_visualizer"
on public.meeting_calendar_events
for delete
to authenticated
using (
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
select *
from public.meeting_calendar_events
order by synced_at desc
limit 20;
```
