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

        <div className="mt-6 grid gap-4 md:grid-cols-3">
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
            <p className="text-sm font-medium">Atividades</p>
            <p className="muted-text mt-2 text-sm">Modulo em construcao.</p>
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
