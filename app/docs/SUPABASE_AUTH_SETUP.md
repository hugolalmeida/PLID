# Supabase Auth Setup (Fase 2)

Use este script no SQL Editor do Supabase.

```sql
-- papeis permitidos
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('presidencia', 'secretaria', 'lider', 'visualizador');
  end if;
end $$;

-- perfil por usuario autenticado
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.user_role not null default 'visualizador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text;

-- sincroniza e-mail dos usuarios ja existentes
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

alter table public.profiles enable row level security;

-- trigger para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- cria perfil automatico ao registrar usuario no auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- politicas: usuario le/atualiza apenas o proprio perfil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
```

## Teste rapido
1. Abra `/login` e use a aba `Criar conta` para registrar um usuario.
2. Se o projeto exigir confirmacao de e-mail, confirme o link enviado pelo Supabase.
3. Volte para `/login`, use a aba `Entrar` e autentique.
4. Verifique `/dashboard` exibindo e-mail/nome e papel.

## Observacao de confirmacao por e-mail
- Se quiser login imediato sem confirmar e-mail no MVP, desative:
  `Authentication > Providers > Email > Confirm email`.
- Em producao, mantenha confirmacao ativa por seguranca.

## Ajuste de papel
Para promover um usuario:

```sql
update public.profiles
set role = 'lider'
where id = '<USER_UUID>';
```
