# Supabase Setup - Workspace Integrations (Google Calendar por workspace)

Este passo adiciona configuracao de integracao por workspace.

Com isso:
- cada workspace pode ter seu proprio `google_calendar_id`
- sem `google_calendar_id`, o sistema **nao sincroniza** com Google Calendar
- as atividades continuam registradas normalmente no PLID

```sql
create table if not exists public.workspace_integrations (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  google_calendar_id text,
  google_calendar_timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_integrations enable row level security;

drop trigger if exists trg_workspace_integrations_updated_at on public.workspace_integrations;
create trigger trg_workspace_integrations_updated_at
before update on public.workspace_integrations
for each row execute function public.set_updated_at();

drop policy if exists "workspace_integrations_read_member" on public.workspace_integrations;
create policy "workspace_integrations_read_member"
on public.workspace_integrations
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_integrations_insert_admin" on public.workspace_integrations;
create policy "workspace_integrations_insert_admin"
on public.workspace_integrations
for insert
to authenticated
with check (public.can_manage_workspace(workspace_id));

drop policy if exists "workspace_integrations_update_admin" on public.workspace_integrations;
create policy "workspace_integrations_update_admin"
on public.workspace_integrations
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));
```

## Validacao rapida

```sql
select *
from public.workspace_integrations
order by created_at desc;
```

## Observacoes

- O backend ainda precisa destas envs para autenticar com Google:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REFRESH_TOKEN`
- O `GOOGLE_CALENDAR_ID` global nao e mais usado como fallback.
