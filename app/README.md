# PLID App

[![Status](https://img.shields.io/badge/status-production%20candidate-0f766e)](./docs/PROJECT_HANDOFF_STATUS.md)
[![Next.js](https://img.shields.io/badge/next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/supabase-rls%20enabled-3ecf8e)](https://supabase.com/)
[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://vercel.com/)

Aplicacao principal do PLID para operacao de lideranca, com modulos de cadastro, execucao, acompanhamento e governanca.

## Requisitos

- Node.js 22+
- npm 11+

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Criar `.env.local`:

```bash
cp .env.example .env.local
```

3. Preencher variaveis obrigatorias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

4. Subir ambiente:

```bash
npm run dev
```

## Scripts

- `npm run dev` -> ambiente local
- `npm run lint` -> validacao ESLint
- `npm run build` -> build de producao
- `npm run start` -> start da build

## Estrutura funcional

- `/dashboard`
- `/organograma`
- `/tasks`
- `/meetings`
- `/goals`
- `/notifications`
- `/auditoria`
- `/workspaces`
- `/profile`

## Job de notificacoes

- Endpoint: `POST /api/jobs/notifications`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Cron configurado em `vercel.json`

## Documentacao

- Handoff: [`docs/PROJECT_HANDOFF_STATUS.md`](./docs/PROJECT_HANDOFF_STATUS.md)
- Auth: [`docs/SUPABASE_AUTH_SETUP.md`](./docs/SUPABASE_AUTH_SETUP.md)
- Workspaces: [`docs/SUPABASE_WORKSPACES_SETUP.md`](./docs/SUPABASE_WORKSPACES_SETUP.md)
- Regras de permissao: [`docs/SUPABASE_WORKSPACE_ROLE_PERMISSIONS_PATCH.md`](./docs/SUPABASE_WORKSPACE_ROLE_PERMISSIONS_PATCH.md)
- Notificacoes: [`docs/SUPABASE_NOTIFICATIONS_SETUP.md`](./docs/SUPABASE_NOTIFICATIONS_SETUP.md)
- Auditoria: [`docs/SUPABASE_AUDIT_SETUP.md`](./docs/SUPABASE_AUDIT_SETUP.md)

## Deploy (Vercel)

Antes de publicar:
- confirme env vars no projeto da Vercel
- execute `npm run lint`
- execute `npm run build`

Dominio atual de producao:
- `https://plid-platform.vercel.app/`
