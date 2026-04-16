# Supabase Roles + People Setup (Fase 3 - Parte 2)

Execute no SQL Editor do Supabase.

```sql
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  responsibilities text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  unique (person_id, role_id)
);

alter table public.roles enable row level security;
alter table public.people enable row level security;
alter table public.person_roles enable row level security;

drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_people_updated_at on public.people;
create trigger trg_people_updated_at
before update on public.people
for each row execute function public.set_updated_at();

-- leitura autenticada
drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "people_read_authenticated" on public.people;
create policy "people_read_authenticated"
on public.people
for select
to authenticated
using (true);

drop policy if exists "person_roles_read_authenticated" on public.person_roles;
create policy "person_roles_read_authenticated"
on public.person_roles
for select
to authenticated
using (true);

-- mutacao: somente nao-visualizador
drop policy if exists "roles_insert_non_visualizer" on public.roles;
create policy "roles_insert_non_visualizer"
on public.roles
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "roles_update_non_visualizer" on public.roles;
create policy "roles_update_non_visualizer"
on public.roles
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "roles_delete_non_visualizer" on public.roles;
create policy "roles_delete_non_visualizer"
on public.roles
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "people_insert_non_visualizer" on public.people;
create policy "people_insert_non_visualizer"
on public.people
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "people_update_non_visualizer" on public.people;
create policy "people_update_non_visualizer"
on public.people
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "people_delete_non_visualizer" on public.people;
create policy "people_delete_non_visualizer"
on public.people
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "person_roles_insert_non_visualizer" on public.person_roles;
create policy "person_roles_insert_non_visualizer"
on public.person_roles
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "person_roles_update_non_visualizer" on public.person_roles;
create policy "person_roles_update_non_visualizer"
on public.person_roles
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);

drop policy if exists "person_roles_delete_non_visualizer" on public.person_roles;
create policy "person_roles_delete_non_visualizer"
on public.person_roles
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role <> 'visualizador'
  )
);
```

## Teste rapido
1. Abra `/roles` para criar cargos.
2. Abra `/people` para cadastrar pessoas.
3. Com perfil `visualizador`, valide acesso somente leitura.
