# Supabase Notifications Setup

Cria a estrutura de logs para notificacoes de tarefas e habilita envio manual de e-mail pela tela `/notifications`.

Importante: este setup assume que o SQL de `SUPABASE_WORKSPACES_SETUP.md` ja foi aplicado (coluna `workspace_id` + funcoes de workspace).

```sql
create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null check (type in ('due_reminder_2d', 'overdue_status_2d')),
  recipient_email text,
  sent_at timestamptz not null default now(),
  status text not null default 'queued',
  payload jsonb,
  created_at timestamptz not null default now()
);

-- migracao para bancos ja existentes (troca stale_3d por overdue_status_2d)
alter table public.notifications_log
  drop constraint if exists notifications_log_type_check;

alter table public.notifications_log
  add constraint notifications_log_type_check
  check (type in ('due_reminder_2d', 'overdue_status_2d'));

create index if not exists idx_notifications_log_task_id on public.notifications_log(task_id);
create index if not exists idx_notifications_log_type_sent_at on public.notifications_log(type, sent_at desc);

alter table public.notifications_log enable row level security;

drop policy if exists "notifications_read_authenticated" on public.notifications_log;
create policy "notifications_read_authenticated"
on public.notifications_log
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "notifications_insert_non_visualizer" on public.notifications_log;
create policy "notifications_insert_non_visualizer"
on public.notifications_log
for insert
to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "notifications_update_non_visualizer" on public.notifications_log;
create policy "notifications_update_non_visualizer"
on public.notifications_log
for update
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
)
with check (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);

drop policy if exists "notifications_delete_non_visualizer" on public.notifications_log;
create policy "notifications_delete_non_visualizer"
on public.notifications_log
for delete
to authenticated
using (
  public.can_manage_workspace(workspace_id)
  and
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role <> 'visualizador'
  )
);
```

## Teste rapido
1. Execute o SQL acima.
2. Abra `/notifications`.
3. Clique em `Gerar fila`.
4. Verifique novos registros em `notifications_log`.
5. Clique em `Enviar fila (e-mail)`.
6. Verifique `status` como `sent`, `failed` ou `skipped`.
7. Se houver `failed`, clique novamente apos alguns minutos para retentativa automatica.
8. Regras ativas:
   - `due_reminder_2d`: tarefa vence em 2 dias.
   - `overdue_status_2d`: tarefa venceu ha 2 dias e ainda nao foi concluida.

## Regras de robustez do envio
- Retentativa automatica para `failed` (ate 3 tentativas, com cooldown de 30 minutos).
- Registro de `dispatch_attempts`, `last_attempt_at`, `dispatch_error` e `gmail_message_id` no `payload`.
- Evita reenvio de notificacoes `sent` porque o processamento trabalha apenas `queued` e `failed`.

## Variaveis de ambiente (env)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_GMAIL_FROM` (opcional, exibicao do remetente)
- `CRON_SECRET` (obrigatorio para endpoint de job)

## Escopos Google recomendados
Ao gerar o refresh token, inclua:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/gmail.send`

## Endpoint de automacao (cron/job)
- Rota: `POST /api/jobs/notifications`
- Autorizacao: `Authorization: Bearer <CRON_SECRET>`
- Execucao: gera fila + envia pendentes em uma unica chamada.

## Cron no deploy (Vercel)
- Arquivo: `vercel.json`
- Agendamento atual: a cada 6 horas (`0 */6 * * *`)
- Requisito: configurar `CRON_SECRET` nas variaveis de ambiente do projeto.
