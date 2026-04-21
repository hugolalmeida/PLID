# Patch - Permissoes por Papel no Workspace

Use este patch quando usuarios `member` devem conseguir criar/editar/remover dados do workspace,
enquanto `viewer` fica somente leitura.

## Objetivo
- `owner`, `admin`, `member`: escrita nos modulos de negocio
- `viewer`: somente leitura
- `workspaces`/`workspace_members`: continuam restritos para `owner`/`admin`

## SQL (rodar no Supabase SQL Editor)

```sql
create or replace function public.can_write_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  )
$$;

-- organizations
drop policy if exists "organizations_insert_non_visualizer" on public.organizations;
create policy "organizations_insert_non_visualizer"
on public.organizations
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "organizations_update_non_visualizer" on public.organizations;
create policy "organizations_update_non_visualizer"
on public.organizations
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "organizations_delete_non_visualizer" on public.organizations;
create policy "organizations_delete_non_visualizer"
on public.organizations
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- roles
drop policy if exists "roles_insert_non_visualizer" on public.roles;
create policy "roles_insert_non_visualizer"
on public.roles
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "roles_update_non_visualizer" on public.roles;
create policy "roles_update_non_visualizer"
on public.roles
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "roles_delete_non_visualizer" on public.roles;
create policy "roles_delete_non_visualizer"
on public.roles
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- people
drop policy if exists "people_insert_non_visualizer" on public.people;
create policy "people_insert_non_visualizer"
on public.people
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "people_update_non_visualizer" on public.people;
create policy "people_update_non_visualizer"
on public.people
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "people_delete_non_visualizer" on public.people;
create policy "people_delete_non_visualizer"
on public.people
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- person_roles
drop policy if exists "person_roles_insert_non_visualizer" on public.person_roles;
create policy "person_roles_insert_non_visualizer"
on public.person_roles
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "person_roles_update_non_visualizer" on public.person_roles;
create policy "person_roles_update_non_visualizer"
on public.person_roles
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "person_roles_delete_non_visualizer" on public.person_roles;
create policy "person_roles_delete_non_visualizer"
on public.person_roles
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- meetings
drop policy if exists "meetings_insert_non_visualizer" on public.meetings;
create policy "meetings_insert_non_visualizer"
on public.meetings
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "meetings_update_non_visualizer" on public.meetings;
create policy "meetings_update_non_visualizer"
on public.meetings
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "meetings_delete_non_visualizer" on public.meetings;
create policy "meetings_delete_non_visualizer"
on public.meetings
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- tasks
drop policy if exists "tasks_insert_non_visualizer" on public.tasks;
create policy "tasks_insert_non_visualizer"
on public.tasks
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "tasks_update_non_visualizer" on public.tasks;
create policy "tasks_update_non_visualizer"
on public.tasks
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "tasks_delete_non_visualizer" on public.tasks;
create policy "tasks_delete_non_visualizer"
on public.tasks
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- goals
drop policy if exists "goals_insert_non_visualizer" on public.goals;
create policy "goals_insert_non_visualizer"
on public.goals
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "goals_update_non_visualizer" on public.goals;
create policy "goals_update_non_visualizer"
on public.goals
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "goals_delete_non_visualizer" on public.goals;
create policy "goals_delete_non_visualizer"
on public.goals
for delete
to authenticated
using (public.can_write_workspace(workspace_id));

-- goal_updates
drop policy if exists "goal_updates_insert_non_visualizer" on public.goal_updates;
create policy "goal_updates_insert_non_visualizer"
on public.goal_updates
for insert
to authenticated
with check (public.can_write_workspace(workspace_id));

drop policy if exists "goal_updates_update_non_visualizer" on public.goal_updates;
create policy "goal_updates_update_non_visualizer"
on public.goal_updates
for update
to authenticated
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "goal_updates_delete_non_visualizer" on public.goal_updates;
create policy "goal_updates_delete_non_visualizer"
on public.goal_updates
for delete
to authenticated
using (public.can_write_workspace(workspace_id));
```

## Validacao rapida

```sql
select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations','roles','people','person_roles',
    'meetings','tasks','goals','goal_updates'
  )
order by tablename, policyname;
```
