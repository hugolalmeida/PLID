# PLID - Plataforma de Lideranca da Igreja

Base do MVP em Next.js + Supabase para organograma, atividades, reunioes e acompanhamento da lideranca.

## Requisitos
- Node.js 22+
- npm 11+

## Primeiro uso
1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base em `.env.example`:

```bash
cp .env.example .env.local
```

3. Preencha:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Rode o projeto:

```bash
npm run dev
```

## Documentacao
- Roadmap e arquitetura inicial: `docs/ROADMAP_MVP.md`
- Setup de auth/perfis no Supabase: `docs/SUPABASE_AUTH_SETUP.md`
- Setup de organizacoes no Supabase: `docs/SUPABASE_ORGANIZATIONS_SETUP.md`

## Stack
- Next.js (App Router)
- React
- Supabase (Auth + Postgres + RLS)
- Google Calendar API
- Gmail API
- Vercel
