# Supabase Organizations Setup (Fase 3 - Parte 1)

Execute no SQL Editor do Supabase.

```sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  parent_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_no_self_parent check (id is distinct from parent_id)
);

alter table public.organizations enable row level security;

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop policy if exists "organizations_read_authenticated" on public.organizations;
create policy "organizations_read_authenticated"
on public.organizations
for select
to authenticated
using (true);

drop policy if exists "organizations_insert_non_visualizer" on public.organizations;
create policy "organizations_insert_non_visualizer"
on public.organizations
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

drop policy if exists "organizations_update_non_visualizer" on public.organizations;
create policy "organizations_update_non_visualizer"
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "organizations_delete_non_visualizer" on public.organizations;
create policy "organizations_delete_non_visualizer"
on public.organizations
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);
```

## Teste rapido
1. Acesse `/organizations`.
2. Com perfil `visualizador`: deve apenas visualizar.
3. Com perfil `lider`/`secretaria`/`presidencia`: deve criar, editar e remover.
