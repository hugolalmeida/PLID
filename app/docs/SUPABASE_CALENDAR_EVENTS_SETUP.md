# Supabase Calendar Events Setup

Este passo prepara o backend para integracao com Google Calendar e adiciona horario nas atividades.

```sql
alter table public.tasks
  add column if not exists due_time time;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop policy if exists "calendar_events_read_authenticated" on public.calendar_events;
create policy "calendar_events_read_authenticated"
on public.calendar_events
for select
to authenticated
using (true);

drop policy if exists "calendar_events_insert_non_visualizer" on public.calendar_events;
create policy "calendar_events_insert_non_visualizer"
on public.calendar_events
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "calendar_events_update_non_visualizer" on public.calendar_events;
create policy "calendar_events_update_non_visualizer"
on public.calendar_events
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "calendar_events_delete_non_visualizer" on public.calendar_events;
create policy "calendar_events_delete_non_visualizer"
on public.calendar_events
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);
```

## Teste rapido
1. Execute o SQL acima.
2. Configure variaveis no `.env.local`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN`
   - `GOOGLE_CALENDAR_ID` (ex.: `primary`)
   - `GOOGLE_CALENDAR_TIMEZONE` (ex.: `America/Sao_Paulo`)
3. Abra `/tasks` e crie/edite uma atividade: o sistema tenta sincronizar automaticamente.
4. Verifique em `calendar_events` se `google_event_id` e `synced_at` foram preenchidos.
5. Se necessario, use o botao `Sincronizar` como reprocessamento manual.
