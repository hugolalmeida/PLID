# PLID Roadmap MVP

## 1) Visao em uma frase
Sistema web para estruturar a lideranca da igreja, registrar atividades em reuniao e garantir acompanhamento com calendario e alertas.

## 2) Stack recomendada
- Next.js + React: entrega rapida com App Router e bom deploy na Vercel.
- Supabase: banco, auth e policies em um unico servico (baixo custo inicial).
- Google Calendar API + Gmail API: cobre agenda e cobranca automatica.
- Vercel: deploy simples e escalavel.

## 3) Arquitetura inicial
- Frontend (Next.js App Router): telas e componentes de dominio.
- Backend (Supabase):
  - Postgres para dados.
  - Auth para login e perfis.
  - RLS para seguranca por papel.
- Jobs:
  - Edge Function/Cron para lembrar tarefas 2 dias antes.
  - Edge Function/Cron para cobrar tarefas sem atualizacao por 3 dias.
- Integracoes:
  - Google Calendar para eventos das atividades.
  - Gmail para notificacoes por e-mail.

## 4) Entidades principais
- organizations
- roles
- people
- person_roles
- meetings
- tasks
- calendar_events
- notifications_log
- profiles (usuario + papel de acesso)

## 5) Estrutura de pastas
```text
src/
  app/
    (auth)/
    dashboard/
    organograma/
    atividades/
    reunioes/
    configuracoes/
  components/
    ui/
    shared/
  features/
    auth/
    organizations/
    roles/
    people/
    tasks/
    meetings/
    notifications/
  lib/
    supabase/
    google/
    email/
    utils/
  types/
  server/
    repositories/
    services/
```

## 6) Fases pequenas e executaveis
- Fase 1: setup base (Next.js + Supabase + variaveis + layout inicial).
- Fase 2: autenticacao e perfis de acesso.
- Fase 3: CRUD de organizacoes, cargos e pessoas.
- Fase 4: organograma interativo com painel lateral.
- Fase 5: CRUD de atividades + vinculo com reunioes.
- Fase 6: Google Calendar + notificacoes por e-mail.
- Fase 7: exportacao e refinamentos para reunioes.

## 7) Primeiro passo pratico (hoje)
1. Criar projeto e dependencias base.
2. Configurar cliente Supabase no browser e no server.
3. Preparar `.env.example` para conexao.
4. Subir app localmente e validar:

```bash
npm run dev
```
