# Supabase Goals Setup

Execute no SQL Editor do Supabase.

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'goal_status') then
    create type public.goal_status as enum (
      'draft',
      'active',
      'at_risk',
      'achieved',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  target_value numeric(12,2) not null check (target_value >= 0),
  current_value numeric(12,2) not null default 0 check (current_value >= 0),
  status public.goal_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_period_valid check (period_end >= period_start)
);

create table if not exists public.goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  update_note text not null,
  current_value numeric(12,2) not null check (current_value >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
alter table public.goal_updates enable row level security;

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop policy if exists "goals_read_authenticated" on public.goals;
create policy "goals_read_authenticated"
on public.goals
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "goal_updates_read_authenticated" on public.goal_updates;
create policy "goal_updates_read_authenticated"
on public.goal_updates
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "goals_insert_non_visualizer" on public.goals;
create policy "goals_insert_non_visualizer"
on public.goals
for insert
to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "goals_update_non_visualizer" on public.goals;
create policy "goals_update_non_visualizer"
on public.goals
for update
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "goals_delete_non_visualizer" on public.goals;
create policy "goals_delete_non_visualizer"
on public.goals
for delete
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "goal_updates_insert_non_visualizer" on public.goal_updates;
create policy "goal_updates_insert_non_visualizer"
on public.goal_updates
for insert
to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "goal_updates_update_non_visualizer" on public.goal_updates;
create policy "goal_updates_update_non_visualizer"
on public.goal_updates
for update
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "goal_updates_delete_non_visualizer" on public.goal_updates;
create policy "goal_updates_delete_non_visualizer"
on public.goal_updates
for delete
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);
```

## Teste rapido
1. Execute o SQL.
2. Acesse `/goals` e crie uma meta.
3. Abra detalhe da meta e registre uma atualizacao.
4. Com perfil `visualizador`, valide acesso somente leitura.
