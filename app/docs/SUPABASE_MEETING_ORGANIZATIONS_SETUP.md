# Supabase Setup - Meeting Organizations (Participantes por Organizacao)

Este passo permite vincular organizacoes em cada reuniao.

Uso no sistema:
- na criacao/edicao de reuniao, voce escolhe organizacoes participantes
- na criacao, o sistema envia e-mail para pessoas ativas vinculadas aos cargos dessas organizacoes

```sql
create table if not exists public.meeting_organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, organization_id)
);

create index if not exists idx_meeting_organizations_workspace_id
  on public.meeting_organizations(workspace_id);
create index if not exists idx_meeting_organizations_meeting_id
  on public.meeting_organizations(meeting_id);
create index if not exists idx_meeting_organizations_organization_id
  on public.meeting_organizations(organization_id);

alter table public.meeting_organizations enable row level security;

drop policy if exists "meeting_organizations_read_member" on public.meeting_organizations;
create policy "meeting_organizations_read_member"
on public.meeting_organizations
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "meeting_organizations_insert_non_visualizer" on public.meeting_organizations;
create policy "meeting_organizations_insert_non_visualizer"
on public.meeting_organizations
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

drop policy if exists "meeting_organizations_update_non_visualizer" on public.meeting_organizations;
create policy "meeting_organizations_update_non_visualizer"
on public.meeting_organizations
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

drop policy if exists "meeting_organizations_delete_non_visualizer" on public.meeting_organizations;
create policy "meeting_organizations_delete_non_visualizer"
on public.meeting_organizations
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
from public.meeting_organizations
order by created_at desc
limit 50;
```
