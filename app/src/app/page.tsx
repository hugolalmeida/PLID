import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWorkspaceContext, type WorkspaceRole } from "@/lib/workspaces/server";

function roleLabel(role: WorkspaceRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Membro";
  return "Visualizador";
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6 md:p-10">
        <section className="surface-card p-6 md:p-10">
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
            PLID
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            Plataforma de Lideranca
          </h1>
          <p className="muted-text mt-4 max-w-3xl">
            Entre na sua conta para acessar dashboard, organograma, metas,
            reunioes e atividades por workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const context = await getUserWorkspaceContext(supabase, user.id);
  const profileResult = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();
  const viewerName =
    profileResult.data?.full_name?.trim() || user.email || "usuario";

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Bem-vindo
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              {viewerName}
            </h1>
            <p className="muted-text mt-2 text-sm">
              Selecione um workspace para continuar. O workspace ativo pode ser
              trocado no seletor lateral.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Ir para dashboard
            </Link>
            <Link
              href="/workspaces"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              Gerenciar workspaces
            </Link>
          </div>
        </div>

        {!context.enabled ? (
          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Workspaces ainda nao habilitados no banco.</p>
            <p className="mt-1">
              {context.setupMessage ||
                "Rode o SQL do arquivo app/docs/SUPABASE_WORKSPACES_SETUP.md."}
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {context.options.length ? (
              context.options.map((workspace) => {
                const isCurrent = context.currentWorkspaceId === workspace.id;
                return (
                  <article
                    key={workspace.id}
                    className="rounded-xl border border-[var(--line)] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{workspace.name}</h2>
                        <p className="muted-text mt-1 text-sm">{workspace.slug}</p>
                        <p className="mt-2 text-xs font-medium text-[var(--muted)]">
                          Papel: {roleLabel(workspace.role)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isCurrent
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isCurrent ? "Ativo" : "Disponivel"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href="/dashboard"
                        className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
                      >
                        Abrir dashboard
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-sm">Nenhum workspace encontrado para esta conta.</p>
                <Link
                  href="/workspaces"
                  className="mt-3 inline-block rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
                >
                  Criar primeiro workspace
                </Link>
              </article>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
