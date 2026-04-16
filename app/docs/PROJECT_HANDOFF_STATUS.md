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
- Vinculos pessoa x cargo (CRUD): `/person-roles`
- Organograma: `/organograma`
  - Visao Geral (mapa por niveis)
  - Visao Detalhada (arvore clicavel + painel lateral)
- Reunioes (CRUD): `/meetings`
- Atividades (CRUD): `/tasks`
  - Com responsavel, organizacao, status, prazo, horario e reuniao vinculada
- Metas (CRUD): `/goals`
  - Detalhe da meta com historico: `/goals/[id]`

## 5. Scripts SQL Ja Criados
Documentos em `docs/`:
- `SUPABASE_AUTH_SETUP.md`
- `SUPABASE_ORGANIZATIONS_SETUP.md`
- `SUPABASE_ROLES_PEOPLE_SETUP.md`
- `SUPABASE_MEETINGS_TASKS_SETUP.md`
- `SUPABASE_CALENDAR_EVENTS_SETUP.md`
- `SUPABASE_GOALS_SETUP.md`
- `SUPABASE_ORGANOGRAMA_SEED_EXEMPLO.md`

## 6. Estado Atual de Backend
Ja pronto:
- Estrutura base de dados para organizacao, pessoas, cargos, reunioes e tarefas
- RLS e policies para leitura autenticada e escrita por perfil autorizado
- `due_time` em `tasks`
- Tabela `calendar_events` preparada
- Estrutura de metas (`goals`) e historico (`goal_updates`)

Falta:
- Integracao real com Google Calendar (sincronizar `tasks` <-> `calendar_events`)
- Notificacoes por e-mail e regras de cobranca automatica
- Exportacao (PDF/CSV)
- Auditoria/historico de alteracoes

## 7. Pontos Funcionais Pendentes (Produto)
Alta prioridade:
1. Integracao Google Calendar na criacao/edicao de atividade
2. Modulo de notificacoes (2 dias antes + tarefa sem atualizacao)
3. Ata de reuniao (vinculada em `meetings`)

Media prioridade:
1. Dashboard com indicadores reais (atrasadas, concluidas, por ministerio)
2. Exportacao de relatorios
3. Integracao de metas com dashboard executivo

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
- Reunioes: adicionar campo de ata (texto rico ou markdown simples)
- Atividades: manter horario (ja adicionado) e evoluir para lembretes automáticos
- Organograma: ampliar visao geral para leitura executiva em uma tela

## 11. Plano Sugerido para a Proxima Sessao
1. Implementar modulo de Metas (DB + CRUD + tela)
2. Implementar Ata em Reunioes
3. Iniciar integracao Google Calendar (sincronizacao basica)
4. Rodada de refinamento visual no frontend (priorizando tarefas, metas e organograma)

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
- `/tasks`
- `/organizations`
- `/roles`
- `/people`
- `/person-roles`
- `/goals`

---
Ultima atualizacao: 15/04/2026
