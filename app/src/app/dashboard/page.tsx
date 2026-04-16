import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type ProfileRow = {
  full_name: string | null;
  role: UserRole;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  return (
    <main className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Dashboard inicial
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Bem-vindo, {profile?.full_name || user.email}
            </h1>
          </div>
          <form action={signOutAction}>
            <button
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
              type="submit"
            >
              Sair
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Perfil ativo</p>
            <p className="muted-text mt-2 text-sm">
              {profile?.role || "Sem perfil definido"}
            </p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Organizacoes</p>
            <p className="muted-text mt-2 text-sm">
              Primeiro CRUD do dominio ja disponivel.
            </p>
            <Link
              href="/organizations"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Organograma</p>
            <p className="muted-text mt-2 text-sm">
              Visualizacao interativa da estrutura completa.
            </p>
            <Link
              href="/organograma"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Atividades</p>
            <p className="muted-text mt-2 text-sm">
              Cadastro com prazo, responsavel e reuniao vinculada.
            </p>
            <Link
              href="/tasks"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Reunioes</p>
            <p className="muted-text mt-2 text-sm">
              Registro de reunioes para historico e vinculo de tarefas.
            </p>
            <Link
              href="/meetings"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Cargos</p>
            <p className="muted-text mt-2 text-sm">
              Cadastro de cargos por organizacao.
            </p>
            <Link
              href="/roles"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Pessoas</p>
            <p className="muted-text mt-2 text-sm">
              Cadastro de lideres e membros.
            </p>
            <Link
              href="/people"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Vinculos</p>
            <p className="muted-text mt-2 text-sm">
              Associacao de pessoa com cargo e periodo.
            </p>
            <Link
              href="/person-roles"
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Abrir modulo
            </Link>
          </article>
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--accent)] underline underline-offset-2"
          >
            Voltar para a pagina inicial
          </Link>
        </div>
      </section>
    </main>
  );
}
