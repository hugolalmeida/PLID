import Link from "next/link";
import Image from "next/image";
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
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
        <section className="surface-card p-6 md:p-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-center md:gap-8 md:text-left">
            <Image
              src="/plid_mark.png"
              alt="PLID"
              width={176}
              height={176}
              className="h-28 w-28 object-contain md:h-36 md:w-36"
              priority
            />
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
                PLID
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-5xl">
                Plataforma de Lideranca
              </h1>
              <p className="muted-text mt-3 max-w-2xl text-sm md:text-base">
                Uma plataforma para organizar lideranca com visao executiva, processos claros
                e acompanhamento continuo por equipe, reuniao e meta.
              </p>
            </div>
          </div>

          <section className="mt-8 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-[var(--line)] bg-white p-4">
              <h2 className="text-sm font-semibold">Estrutura organizacional</h2>
              <p className="muted-text mt-1 text-sm">
                Monte organogramas por niveis e relacione pessoas, cargos e organizacoes.
              </p>
            </article>
            <article className="rounded-xl border border-[var(--line)] bg-white p-4">
              <h2 className="text-sm font-semibold">Execucao e governanca</h2>
              <p className="muted-text mt-1 text-sm">
                Controle atividades, reunioes, metas e registros com rastreabilidade.
              </p>
            </article>
            <article className="rounded-xl border border-[var(--line)] bg-white p-4">
              <h2 className="text-sm font-semibold">Multi-workspace</h2>
              <p className="muted-text mt-1 text-sm">
                Separe contextos (ex.: Igreja e Trabalho) com permissoes por papel.
              </p>
            </article>
          </section>

          <section className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-sm font-semibold">Funcionalidades principais</h2>
            <ul className="muted-text mt-2 grid list-disc gap-1 pl-5 text-sm md:grid-cols-2">
              <li>Dashboard executivo por workspace</li>
              <li>Organograma interativo com visao geral e detalhada</li>
              <li>Atividades com status, prazo e sincronizacao</li>
              <li>Reunioes com registro e participantes por organizacao</li>
              <li>Metas com historico de atualizacoes</li>
              <li>Auditoria de alteracoes e notificacoes automáticas</li>
            </ul>
          </section>

          <section className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-sm font-semibold">Como funciona em 3 passos</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <article className="rounded-lg border border-[var(--line)] bg-[#fdf9f2] p-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--accent)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12h18" />
                    <path d="M12 3v18" />
                  </svg>
                </span>
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--accent)] uppercase">
                  Passo 1
                </p>
                <h3 className="mt-1 text-sm font-semibold">Estruture seu workspace</h3>
                <p className="muted-text mt-1 text-sm">
                  Cadastre organizacoes, cargos e pessoas para montar a base de lideranca.
                </p>
              </article>
              <article className="rounded-lg border border-[var(--line)] bg-[#fdf9f2] p-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--accent)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </svg>
                </span>
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--accent)] uppercase">
                  Passo 2
                </p>
                <h3 className="mt-1 text-sm font-semibold">Planeje e execute</h3>
                <p className="muted-text mt-1 text-sm">
                  Crie reunioes, atividades e metas com acompanhamento de status e prazos.
                </p>
              </article>
              <article className="rounded-lg border border-[var(--line)] bg-[#fdf9f2] p-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--accent)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 19h16" />
                    <path d="M7 15l3-3 2 2 5-5" />
                  </svg>
                </span>
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--accent)] uppercase">
                  Passo 3
                </p>
                <h3 className="mt-1 text-sm font-semibold">Acompanhe resultados</h3>
                <p className="muted-text mt-1 text-sm">
                  Use dashboard, auditoria e notificacoes para manter governanca e ritmo.
                </p>
              </article>
            </div>
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Acessar plataforma
            </Link>
            <span className="text-xs text-[var(--muted)]">
              Entre para gerenciar seus workspaces e modulos.
            </span>
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
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
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
            <Link
              href="/workspaces#calendar-integracao"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Configurar calendario
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
