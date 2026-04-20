# Supabase Setup - Workspaces (Multi-Tenant)

## Ordem de execucao (importante)

Rode no SQL Editor nesta ordem:

1. **Bloco A** - Estrutura base + funcoes + backfill
2. **Bloco B** - `workspace_id` nas tabelas + backfill + FKs/defaults/indexes
3. **Bloco C** - RLS de `workspaces` e `workspace_members`
4. **Validacao rapida**

Se der erro em um bloco, pare e corrija antes de seguir para o proximo.

Este script inicia o suporte a multi-workspace sem quebrar o que ja existe:

- cria `workspaces` e `workspace_members`
- adiciona `profiles.current_workspace_id`
- cria 1 workspace padrao por usuario existente (backfill)
- adiciona `workspace_id` nas tabelas principais e preenche dados antigos
- define default de `workspace_id` com base no workspace ativo do perfil
- cria RLS para `workspaces` e `workspace_members`

## Bloco A - Estrutura base + funcoes + backfill

```sql
-- BLOCO A (inicio)
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_member_role') then
    create type public.workspace_member_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);

alter table public.profiles
  add column if not exists current_workspace_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_current_workspace_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_current_workspace_id_fkey
      foreign key (current_workspace_id)
      references public.workspaces(id)
      on delete set null;
  end if;
end $$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.current_workspace_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
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
  )
$$;

create or replace function public.can_manage_workspace(p_workspace_id uuid)
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
      and wm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.created_by = auth.uid()
  )
$$;

-- Backfill: cria 1 workspace para cada profile sem membership
do $$
declare
  p record;
  v_base_slug text;
  v_slug text;
  v_suffix int;
begin
  for p in
    select id, full_name
    from public.profiles
  loop
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = p.id
    ) then
      v_base_slug := regexp_replace(
        lower(coalesce(nullif(trim(p.full_name), ''), 'workspace-' || left(p.id::text, 8))),
        '[^a-z0-9]+',
        '-',
        'g'
      );
      v_base_slug := trim(both '-' from v_base_slug);
      if v_base_slug = '' then
        v_base_slug := 'workspace-' || left(p.id::text, 8);
      end if;

      v_slug := v_base_slug;
      v_suffix := 1;
      while exists (select 1 from public.workspaces w where w.slug = v_slug) loop
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix::text;
      end loop;

      with inserted_workspace as (
        insert into public.workspaces (name, slug, created_by)
        values (
          coalesce(nullif(trim(p.full_name), ''), 'Workspace ' || left(p.id::text, 8)),
          v_slug,
          p.id
        )
        returning id
      )
      insert into public.workspace_members (workspace_id, user_id, role)
      select iw.id, p.id, 'owner'
      from inserted_workspace iw;
    end if;

    update public.profiles pf
    set current_workspace_id = coalesce(
      pf.current_workspace_id,
      (
        select wm.workspace_id
        from public.workspace_members wm
        where wm.user_id = p.id
        order by wm.created_at
        limit 1
      )
    )
    where pf.id = p.id;
  end loop;
end $$;
-- BLOCO A (fim)
```

## Bloco B - workspace_id + backfill + FKs/defaults/indexes

```sql
-- BLOCO B (inicio)

-- adiciona workspace_id nas tabelas principais
alter table public.organizations   add column if not exists workspace_id uuid;
alter table public.roles           add column if not exists workspace_id uuid;
alter table public.people          add column if not exists workspace_id uuid;
alter table public.person_roles    add column if not exists workspace_id uuid;
alter table public.meetings        add column if not exists workspace_id uuid;
alter table public.tasks           add column if not exists workspace_id uuid;
alter table public.goals           add column if not exists workspace_id uuid;
alter table public.goal_updates    add column if not exists workspace_id uuid;
alter table public.calendar_events add column if not exists workspace_id uuid;
alter table public.notifications_log add column if not exists workspace_id uuid;
alter table public.audit_logs      add column if not exists workspace_id uuid;

-- organizations
update public.organizations
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- roles herdam de organizations
update public.roles r
set workspace_id = o.workspace_id
from public.organizations o
where r.organization_id = o.id
  and r.workspace_id is null;
update public.roles
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- people (fallback)
update public.people
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- person_roles herdam de roles
update public.person_roles pr
set workspace_id = r.workspace_id
from public.roles r
where pr.role_id = r.id
  and pr.workspace_id is null;
update public.person_roles
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- meetings (fallback)
update public.meetings
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- tasks herdam de organizations
update public.tasks t
set workspace_id = o.workspace_id
from public.organizations o
where t.organization_id = o.id
  and t.workspace_id is null;
update public.tasks
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- goals herdam de organizations
update public.goals g
set workspace_id = o.workspace_id
from public.organizations o
where g.organization_id = o.id
  and g.workspace_id is null;
update public.goals
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- goal_updates herdam de goals
update public.goal_updates gu
set workspace_id = g.workspace_id
from public.goals g
where gu.goal_id = g.id
  and gu.workspace_id is null;
update public.goal_updates
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- calendar_events herdam de tasks
update public.calendar_events ce
set workspace_id = t.workspace_id
from public.tasks t
where ce.task_id = t.id
  and ce.workspace_id is null;
update public.calendar_events
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- notifications herdam de tasks
update public.notifications_log nl
set workspace_id = t.workspace_id
from public.tasks t
where nl.task_id = t.id
  and nl.workspace_id is null;
update public.notifications_log
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- audit_logs (fallback)
update public.audit_logs
set workspace_id = coalesce(
  workspace_id,
  (select id from public.workspaces order by created_at limit 1)
)
where workspace_id is null;

-- FKs + defaults
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_workspace_id_fkey') then
    alter table public.organizations add constraint organizations_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'roles_workspace_id_fkey') then
    alter table public.roles add constraint roles_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'people_workspace_id_fkey') then
    alter table public.people add constraint people_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'person_roles_workspace_id_fkey') then
    alter table public.person_roles add constraint person_roles_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'meetings_workspace_id_fkey') then
    alter table public.meetings add constraint meetings_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_workspace_id_fkey') then
    alter table public.tasks add constraint tasks_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_workspace_id_fkey') then
    alter table public.goals add constraint goals_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goal_updates_workspace_id_fkey') then
    alter table public.goal_updates add constraint goal_updates_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_workspace_id_fkey') then
    alter table public.calendar_events add constraint calendar_events_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notifications_log_workspace_id_fkey') then
    alter table public.notifications_log add constraint notifications_log_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_logs_workspace_id_fkey') then
    alter table public.audit_logs add constraint audit_logs_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
end $$;

alter table public.organizations   alter column workspace_id set default public.current_workspace_id();
alter table public.roles           alter column workspace_id set default public.current_workspace_id();
alter table public.people          alter column workspace_id set default public.current_workspace_id();
alter table public.person_roles    alter column workspace_id set default public.current_workspace_id();
alter table public.meetings        alter column workspace_id set default public.current_workspace_id();
alter table public.tasks           alter column workspace_id set default public.current_workspace_id();
alter table public.goals           alter column workspace_id set default public.current_workspace_id();
alter table public.goal_updates    alter column workspace_id set default public.current_workspace_id();
alter table public.calendar_events alter column workspace_id set default public.current_workspace_id();
alter table public.notifications_log alter column workspace_id set default public.current_workspace_id();
alter table public.audit_logs      alter column workspace_id set default public.current_workspace_id();

create index if not exists idx_organizations_workspace_id on public.organizations(workspace_id);
create index if not exists idx_roles_workspace_id on public.roles(workspace_id);
create index if not exists idx_people_workspace_id on public.people(workspace_id);
create index if not exists idx_person_roles_workspace_id on public.person_roles(workspace_id);
create index if not exists idx_meetings_workspace_id on public.meetings(workspace_id);
create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);
create index if not exists idx_goals_workspace_id on public.goals(workspace_id);
create index if not exists idx_goal_updates_workspace_id on public.goal_updates(workspace_id);
create index if not exists idx_calendar_events_workspace_id on public.calendar_events(workspace_id);
create index if not exists idx_notifications_log_workspace_id on public.notifications_log(workspace_id);
create index if not exists idx_audit_logs_workspace_id on public.audit_logs(workspace_id);

-- no primeiro deploy multi-tenant, mantenha nullable para nao travar o fluxo.
-- depois de validar tudo, voce pode aplicar NOT NULL nas colunas workspace_id.
-- BLOCO B (fim)
```

## Bloco C - RLS workspaces

```sql
-- BLOCO C (inicio)

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "workspaces_read_member" on public.workspaces;
create policy "workspaces_read_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_authenticated" on public.workspaces;
create policy "workspaces_insert_authenticated"
on public.workspaces
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_update_admin"
on public.workspaces
for update
to authenticated
using (public.can_manage_workspace(id))
with check (public.can_manage_workspace(id));

drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
on public.workspaces
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "workspace_members_read_own" on public.workspace_members;
create policy "workspace_members_read_own"
on public.workspace_members
for select
to authenticated
using (user_id = auth.uid() or public.can_manage_workspace(workspace_id));

drop policy if exists "workspace_members_insert_admin" on public.workspace_members;
create policy "workspace_members_insert_admin"
on public.workspace_members
for insert
to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  or (
    role = 'owner'
    and user_id = auth.uid()
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.created_by = auth.uid()
    )
  )
);

drop policy if exists "workspace_members_update_admin" on public.workspace_members;
create policy "workspace_members_update_admin"
on public.workspace_members
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

drop policy if exists "workspace_members_delete_admin" on public.workspace_members;
create policy "workspace_members_delete_admin"
on public.workspace_members
for delete
to authenticated
using (public.can_manage_workspace(workspace_id));
-- BLOCO C (fim)
```

## Validacao rapida

```sql
select id, name, slug, created_by, created_at
from public.workspaces
order by created_at desc;

select workspace_id, user_id, role, created_at
from public.workspace_members
order by created_at desc;

select id, full_name, current_workspace_id
from public.profiles
order by created_at desc;
```

## 3) Proximo passo recomendado

Depois de validar este setup:

1. atualizar as politicas RLS de cada tabela funcional para filtrar por `workspace_id`.
2. tornar `workspace_id` `not null` nas tabelas principais.
3. revisar relatorios/exportacoes para sempre respeitar o workspace ativo.

## Troubleshooting rapido

### 1) "Conta nao encontrada" ao adicionar membro
Se a conta foi criada diretamente no Supabase antes do trigger de `profiles`, rode:

```sql
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');
```

### 2) Remocao de workspace falhando por permissao
Garanta a policy de delete:

```sql
drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
on public.workspaces
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);
```

Opcional (recomendado para estabilidade): use RPC segura para remocao.

```sql
create or replace function public.delete_workspace_if_owner(
  p_workspace_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_delete boolean;
begin
  if p_actor_user_id is null then
    return false;
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_user_id then
    return false;
  end if;

  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_user_id
      and wm.role = 'owner'
  ) into v_can_delete;

  if not v_can_delete then
    return false;
  end if;

  delete from public.workspaces w
  where w.id = p_workspace_id;

  return found;
end;
$$;

grant execute on function public.delete_workspace_if_owner(uuid, uuid) to authenticated;
```

### 3) Adicao/listagem de membros falhando por RLS de profiles
Rode estas RPCs (security definer) para lookup e listagem segura:

```sql
create or replace function public.find_profile_for_workspace_invite(
  p_workspace_id uuid,
  p_email text
)
returns table (
  id uuid,
  email text,
  full_name text,
  current_workspace_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.current_workspace_id
  from public.profiles p
  where public.can_manage_workspace(p_workspace_id)
    and lower(coalesce(p.email, '')) = lower(coalesce(p_email, ''))
  limit 1
$$;

grant execute on function public.find_profile_for_workspace_invite(uuid, text) to authenticated;

create or replace function public.list_workspace_member_profiles(
  p_workspace_id uuid
)
returns table (
  user_id uuid,
  role public.workspace_member_role,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select wm.user_id, wm.role, p.full_name, p.email
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  where public.is_workspace_member(p_workspace_id)
    and wm.workspace_id = p_workspace_id
  order by
    case wm.role
      when 'owner' then 1
      when 'admin' then 2
      when 'member' then 3
      else 4
    end,
    lower(coalesce(p.full_name, p.email, ''))
$$;

grant execute on function public.list_workspace_member_profiles(uuid) to authenticated;
```
