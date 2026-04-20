# PLID - Handoff de Projeto (Status + Proximos Passos)

## 1. Resumo Executivo

PLID e um sistema web para lideranca de igreja com foco em estrutura organizacional, acompanhamento de atividades e governanca por perfis.

Objetivo desta entrega: registrar tudo o que ja foi implementado e o que falta, para reduzir custo de contexto nas proximas sessoes.

## 2. Stack e Arquitetura

- Frontend: Next.js (App Router) + React + TypeScript
- Backend: Supabase (Postgres + Auth + RLS)
- Deploy alvo: Vercel
- Integracoes planejadas: Google Calendar API + Gmail API

Arquitetura atual:

- Rotas server-first no App Router
- Server Actions para CRUD
- Controle de acesso por perfil via `profiles.role`

## 3. Decisao de Ambiente (Importante)

O projeto de execucao local deve rodar fora do OneDrive:

- Recomendado: `C:\dev\plid-app`

Motivo:

- Em `OneDrive\Desktop`, o Next.js apresentou erros de permissao (`EPERM`, lock em `.next`).

Fluxo atual:

- Pasta fonte: `C:\Users\hugog\OneDrive\Área de Trabalho\PLID\app`
- Pasta de execucao: `C:\dev\plid-app`

Comando de sincronizacao:

```powershell
robocopy "C:\Users\hugog\OneDrive\Área de Trabalho\PLID\app" "C:\dev\plid-app" /E /XD node_modules .next /XF .env.local
```

## 4. Modulos Ja Implementados

- Autenticacao:
  - Login com Supabase
  - Middleware de protecao de rota
  - Dashboard protegido
- Perfis:
  - `presidencia`, `secretaria`, `lider`, `visualizador`
  - Permissao de escrita bloqueada para `visualizador`
- Organizacoes (CRUD): `/organizations`
- Cargos (CRUD): `/roles`
- Pessoas (CRUD): `/people`
- Vinculo inicial pessoa x cargo integrado ao cadastro de `/people`
- Organograma: `/organograma`
  - Visao Geral (mapa por niveis)
  - Visao Detalhada (arvore clicavel + painel lateral)
- Reunioes (CRUD): `/meetings`
  - Campo `minutes` para documento/registro da reuniao
  - Registro dedicado em `/meetings/[id]/registro`
- Atividades (CRUD): `/tasks`
  - Com responsavel, organizacao, status, prazo, horario e reuniao vinculada
  - Sincronizacao automatica com Google Calendar no create/update
  - Botao manual de re-sincronizacao por tarefa
- Notificacoes: `/notifications`
  - Varredura manual para gerar alertas de prazo e tarefas vencidas sem conclusao
  - Envio manual da fila por e-mail (Gmail API)
  - Endpoint de job para automacao: `/api/jobs/notifications`
  - Cron de deploy configurado em `vercel.json` (a cada 6 horas)
  - Retentativa de envio para `failed` (3 tentativas, cooldown 30 min)
  - Observabilidade na tela (contadores e ultimo erro)
  - Log de eventos em `notifications_log`
- Metas (CRUD): `/goals`
  - Detalhe da meta com historico: `/goals/[id]`
- Exportacao:
  - CSV em `/tasks`, `/meetings`, `/goals`
  - PDF via impressao do navegador nos mesmos modulos
- Auditoria:
  - trilha de create/update/delete/status_update/sync em `audit_logs`
  - tela de consulta em `/auditoria`

## 5. Scripts SQL Ja Criados

Documentos em `docs/`:

- `SUPABASE_AUTH_SETUP.md`
- `SUPABASE_ORGANIZATIONS_SETUP.md`
- `SUPABASE_ROLES_PEOPLE_SETUP.md`
- `SUPABASE_MEETINGS_TASKS_SETUP.md`
- `SUPABASE_CALENDAR_EVENTS_SETUP.md`
- `SUPABASE_GOALS_SETUP.md`
- `SUPABASE_NOTIFICATIONS_SETUP.md`
- `SUPABASE_AUDIT_SETUP.md`
- `SUPABASE_WORKSPACES_SETUP.md`
- `EMAIL_NOTIFICATIONS_REMINDER.md`
- `SUPABASE_ORGANOGRAMA_SEED_EXEMPLO.md`

## 6. Estado Atual de Backend

Ja pronto:

- Estrutura base de dados para organizacao, pessoas, cargos, reunioes e tarefas
- RLS e policies para leitura autenticada e escrita por perfil autorizado
- `due_time` em `tasks`
- Tabela `calendar_events` preparada
- Sincronizacao automatica task -> Google Calendar com upsert em `calendar_events`
- Estrutura `notifications_log` com regras de varredura
- Envio de e-mail via Gmail API (status `queued`, `sent`, `failed`, `skipped`)
- Endpoint automatico `/api/jobs/notifications` para varredura + envio
- `vercel.json` com cron a cada 6 horas
- Estrutura de metas (`goals`) e historico (`goal_updates`)
- Campo `minutes` em `meetings` para documento/registro da reuniao
- Fluxo de registro separado da criacao rapida de reunioes
- Exportacao CSV + PDF (impressao) em atividades, reunioes e metas
- Auditoria de mudancas criticas com insercao em `audit_logs`

Falta:

- Configurar variavel `CRON_SECRET` no ambiente de deploy (Vercel)
- Tela dedicada para consulta/filtragem de auditoria (atualmente somente tabela/log no banco)
- Isolamento completo por workspace em todas as policies RLS funcionais

## 7. Pontos Funcionais Pendentes (Produto)

Alta prioridade:

1. Configurar variavel `CRON_SECRET` no ambiente de deploy (Vercel)
2. Finalizar multi-workspace (RLS por `workspace_id` em todos os modulos)
3. Dashboard com indicadores reais (atrasadas, concluidas, por ministerio)

Media prioridade:

1. Exportacao de relatorios
2. Integracao de metas com dashboard executivo
3. Melhorar editor do documento da reuniao (markdown ou texto rico)

## 8. Modulo de Metas (Status)

Ja implementado:

- Cadastro e edicao de metas em `/goals`
- Status de meta: `draft`, `active`, `at_risk`, `achieved`, `cancelled`
- Historico de atualizacoes em `/goals/[id]`
- Atualizacao de progresso com registro de autor e data

Pendencias do modulo:

- Filtros por status, periodo e organizacao
- Metricas agregadas por ministerio
- Widgets de metas no dashboard principal

## 9. Melhorias de Front-end (Backlog)

Melhorias recomendadas para proxima rodada de UX:

1. Sistema visual consistente:
   - padronizar espacamentos, estados de componentes e hierarquia tipografica
2. Tabelas:
   - filtros, ordenacao e paginacao
   - cabecalho fixo e feedback de carregamento
3. Formularios:
   - validacao inline mais clara
   - mensagens de erro/sucesso padronizadas
4. Organograma:
   - zoom e pan
   - destaque por camada (bispo, conselheiros, presidencias)
5. Acessibilidade:
   - foco visivel, navegacao por teclado, contraste revisado
6. Mobile:
   - layout otimizado para uso durante reunioes

## 10. Itens Ja Mapeados para Refino Futuro

- Reunioes: evoluir o documento da reuniao para texto rico ou markdown simples
- Atividades: manter horario (ja adicionado) e evoluir para lembretes automáticos
- Organograma: ampliar visao geral para leitura executiva em uma tela

## 11. Plano Sugerido para a Proxima Sessao

1. Validar cron em producao (Vercel) com `CRON_SECRET`
2. Rodar `SUPABASE_WORKSPACES_SETUP.md` e validar `/workspaces`
3. Aplicar RLS por workspace em tabelas funcionais e revisar filtros
4. Criar indicadores no dashboard (tarefas, metas, reunioes)
5. Rodada de refinamento visual no frontend (priorizando tarefas, metas e organograma)

## 12. Checklist de Retomada Rapida

1. Sincronizar codigo para `C:\dev\plid-app`
2. Garantir `.env.local` correto em `C:\dev\plid-app`
3. Rodar SQLs pendentes no Supabase
4. Executar:

```powershell
cd C:\dev\plid-app
npm run dev
```

5. Validar rotas principais:

- `/dashboard`
- `/organograma`
- `/meetings`
- `/meetings/{id}/registro`
- `/tasks`
- `/notifications`
- `/auditoria`
- `/organizations`
- `/roles`
- `/people`
- `/goals`

---

Ultima atualizacao: 19/04/2026
