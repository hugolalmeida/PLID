# Supabase Meetings + Tasks Setup

Execute no SQL Editor do Supabase.

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('todo', 'in_progress', 'done', 'blocked');
  end if;
end $$;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings
  add column if not exists minutes text;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status public.task_status not null default 'todo',
  due_date date not null,
  meeting_id uuid references public.meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings enable row level security;
alter table public.tasks enable row level security;

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop policy if exists "meetings_read_authenticated" on public.meetings;
create policy "meetings_read_authenticated"
on public.meetings
for select
to authenticated
using (true);

drop policy if exists "tasks_read_authenticated" on public.tasks;
create policy "tasks_read_authenticated"
on public.tasks
for select
to authenticated
using (true);

drop policy if exists "meetings_insert_non_visualizer" on public.meetings;
create policy "meetings_insert_non_visualizer"
on public.meetings
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "meetings_update_non_visualizer" on public.meetings;
create policy "meetings_update_non_visualizer"
on public.meetings
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

drop policy if exists "meetings_delete_non_visualizer" on public.meetings;
create policy "meetings_delete_non_visualizer"
on public.meetings
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "tasks_insert_non_visualizer" on public.tasks;
create policy "tasks_insert_non_visualizer"
on public.tasks
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "tasks_update_non_visualizer" on public.tasks;
create policy "tasks_update_non_visualizer"
on public.tasks
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

drop policy if exists "tasks_delete_non_visualizer" on public.tasks;
create policy "tasks_delete_non_visualizer"
on public.tasks
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
1. Acesse `/meetings` e crie uma reuniao.
2. Ao criar, valide o redirecionamento para `/meetings/{id}/registro`.
3. No registro da reuniao, preencha pontos importantes e salve.
4. Acesse `/tasks` e crie atividade vinculando pessoa, organizacao e reuniao.
5. Confirme que usuario `visualizador` fica apenas em leitura.
6. Em reunioes, valide a acao `Abrir registro` para editar o documento (`minutes`).
