import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addWorkspaceMemberAction,
  createWorkspaceAction,
  deleteWorkspaceAction,
  removeWorkspaceMemberAction,
  switchWorkspaceAction,
  transferWorkspaceOwnershipAction,
  updateWorkspaceCalendarIntegrationAction,
  updateWorkspaceMemberRoleAction,
  updateWorkspaceAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWorkspaceContext, type WorkspaceRole } from "@/lib/workspaces/server";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";

function workspaceRoleLabel(role: WorkspaceRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Membro";
  return "Visualizador";
}

type MemberProfileRow = {
  user_id: string;
  role: WorkspaceRole;
  full_name: string | null;
  email: string | null;
};

type WorkspaceIntegrationRow = {
  google_calendar_id: string | null;
  google_calendar_timezone: string | null;
};

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getUserWorkspaceContext(supabase, user.id);
  const activeWorkspace = context.options.find(
    (workspace) => workspace.id === context.currentWorkspaceId,
  );
  const canManageMembers =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";
  const isOwnerInAnyWorkspace = context.options.some(
    (workspace) => workspace.role === "owner",
  );

  const membersResult =
    context.enabled && context.currentWorkspaceId
      ? await supabase.rpc("list_workspace_member_profiles", {
          p_workspace_id: context.currentWorkspaceId,
        })
      : { data: [] as MemberProfileRow[], error: null };

  if (membersResult.error) {
    throw new Error(
      `${membersResult.error.message}. Rode o SQL de RPC de membros no doc SUPABASE_WORKSPACES_SETUP.md.`,
    );
  }

  const members = (membersResult.data || []) as MemberProfileRow[];

  const integrationResult =
    context.enabled && context.currentWorkspaceId
      ? await supabase
          .from("workspace_integrations")
          .select("google_calendar_id, google_calendar_timezone")
          .eq("workspace_id", context.currentWorkspaceId)
          .maybeSingle<WorkspaceIntegrationRow>()
      : { data: null as WorkspaceIntegrationRow | null, error: null };

  const integrationErrorMessage = integrationResult.error?.message || "";
  const integrationSetupMissing =
    integrationErrorMessage.toLowerCase().includes("workspace_integrations") ||
    integrationErrorMessage.toLowerCase().includes("does not exist");

  if (integrationResult.error && !integrationSetupMissing) {
    throw new Error(integrationResult.error.message);
  }

  const integration = integrationResult.data;

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Multi Workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Espacos de trabalho</h1>
            <p className="muted-text mt-2 text-sm">
              Separe dados por contexto (ex.: Igreja e Trabalho) e alterne o workspace ativo.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <CreateFeedbackBanner status={createFeedback.status} message={createFeedback.message} />

        {!context.enabled ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Workspaces ainda nao habilitados no banco.</p>
            <p className="mt-1">
              {context.setupMessage ||
                "Rode o SQL do arquivo app/docs/SUPABASE_WORKSPACES_SETUP.md e recarregue a pagina."}
            </p>
          </div>
        ) : (
          <>
            <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
                <span>Novo workspace</span>
                <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  +
                </span>
              </summary>
              <div className="create-collapsible-content">
                <form action={createWorkspaceAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="min-w-[280px] flex-1 text-xs font-medium text-[var(--muted)]">
                    Nome do workspace
                    <input
                      name="name"
                      required
                      placeholder="Ex.: Igreja Central"
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Criar workspace
                  </button>
                </form>
              </div>
            </details>

            <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Workspace</th>
                    <th className="px-4 py-3 text-left font-semibold">Slug</th>
                    <th className="px-4 py-3 text-left font-semibold">Papel</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {context.options.length ? (
                    context.options.map((workspace) => {
                      const isCurrent = context.currentWorkspaceId === workspace.id;
                      return (
                        <tr
                          key={workspace.id}
                          className="border-b border-[var(--line)] last:border-0"
                        >
                          <td className="px-4 py-3 font-medium">{workspace.name}</td>
                          <td className="px-4 py-3">{workspace.slug}</td>
                          <td className="px-4 py-3">{workspaceRoleLabel(workspace.role)}</td>
                          <td className="px-4 py-3">
                            {isCurrent ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                                Ativo
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {!isCurrent ? (
                                <form action={switchWorkspaceAction}>
                                  <input type="hidden" name="workspace_id" value={workspace.id} />
                                  <button
                                    type="submit"
                                    title="Ativar workspace"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--foreground)]"
                                  >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m5 12 5 5L20 7" />
                                    </svg>
                                  </button>
                                </form>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">Em uso</span>
                              )}

                              <details className="group relative">
                                <summary
                                  title="Editar workspace"
                                  className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--foreground)]"
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </summary>
                                <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-xl border border-[var(--line)] bg-white p-3 shadow-md">
                                  <p className="text-xs font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
                                    Editar workspace
                                  </p>
                                  <form action={updateWorkspaceAction} className="mt-2 space-y-2">
                                    <input type="hidden" name="workspace_id" value={workspace.id} />
                                    <input
                                      name="name"
                                      required
                                      defaultValue={workspace.name}
                                      className="w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                                    />
                                    <button
                                      type="submit"
                                      className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium"
                                    >
                                      Salvar
                                    </button>
                                  </form>
                                </div>
                              </details>

                              {workspace.role === "owner" ? (
                                <details className="group relative">
                                  <summary
                                    title="Remover workspace"
                                    className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-red-200 bg-white text-red-700"
                                  >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14H6L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                    </svg>
                                  </summary>
                                  <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-xl border border-red-200 bg-white p-3 shadow-md">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-red-700 uppercase">
                                      Confirmar remocao
                                    </p>
                                    <p className="mt-2 text-xs text-[var(--muted)]">
                                      Esta acao remove o workspace e seus dados. Digite{" "}
                                      <span className="font-semibold">{workspace.name}</span> para confirmar.
                                    </p>
                                    <form action={deleteWorkspaceAction} className="mt-2 space-y-2">
                                      <input type="hidden" name="workspace_id" value={workspace.id} />
                                      <input
                                        name="confirm_name"
                                        required
                                        placeholder={workspace.name}
                                        className="w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                                      />
                                      <button
                                        type="submit"
                                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                                      >
                                        Remover workspace
                                      </button>
                                    </form>
                                  </div>
                                </details>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-6 muted-text" colSpan={5}>
                        Nenhum workspace encontrado para este usuario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {context.currentWorkspaceId ? (
              <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
                <h2 className="text-base font-semibold">Membros do workspace ativo</h2>
                <p className="muted-text mt-1 text-sm">
                  Compartilhe este workspace com outras contas.
                </p>

                {canManageMembers ? (
                  <form action={addWorkspaceMemberAction} className="mt-4 flex flex-wrap items-end gap-2">
                    <input
                      type="hidden"
                      name="workspace_id"
                      value={context.currentWorkspaceId}
                    />
                    <label className="min-w-[240px] flex-1 text-xs font-medium text-[var(--muted)]">
                      E-mail da conta
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="pessoa@email.com"
                        className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-[var(--muted)]">
                      Papel
                      <select
                        name="role"
                        defaultValue="member"
                        className="mt-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Membro</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Adicionar
                    </button>
                  </form>
                ) : (
                  <p className="muted-text mt-4 text-sm">
                    Somente owner/admin podem gerenciar membros.
                  </p>
                )}

                <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                        <th className="px-4 py-3 text-left font-semibold">Papel</th>
                        <th className="px-4 py-3 text-left font-semibold">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length ? (
                        members.map((member) => {
                          const isSelf = member.user_id === user.id;
                          return (
                            <tr key={member.user_id} className="border-b border-[var(--line)] last:border-0">
                              <td className="px-4 py-3">{member.full_name || "Sem nome"}</td>
                              <td className="px-4 py-3">{member.email || "-"}</td>
                              <td className="px-4 py-3">{workspaceRoleLabel(member.role)}</td>
                              <td className="px-4 py-3">
                                {canManageMembers && member.role !== "owner" ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <form action={updateWorkspaceMemberRoleAction} className="flex items-center gap-2">
                                      <input type="hidden" name="workspace_id" value={context.currentWorkspaceId} />
                                      <input type="hidden" name="member_user_id" value={member.user_id} />
                                      <select
                                        name="role"
                                        defaultValue={member.role}
                                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                                      >
                                        <option value="admin">Admin</option>
                                        <option value="member">Membro</option>
                                        <option value="viewer">Visualizador</option>
                                      </select>
                                      <button
                                        type="submit"
                                        title="Atualizar papel"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-white"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="m5 12 5 5L20 7" />
                                        </svg>
                                      </button>
                                    </form>
                                    {activeWorkspace?.role === "owner" ? (
                                      <details className="group relative">
                                        <summary
                                          title="Transferir ownership"
                                          className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md border border-amber-200 bg-white text-amber-700"
                                        >
                                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 3v18" />
                                            <path d="m5 10 7-7 7 7" />
                                          </svg>
                                        </summary>
                                        <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-xl border border-amber-200 bg-white p-3 shadow-md">
                                          <p className="text-xs font-semibold tracking-[0.08em] text-amber-700 uppercase">
                                            Transferir ownership
                                          </p>
                                          <p className="mt-1 text-xs text-[var(--muted)]">
                                            Este membro se tornara owner e voce sera admin.
                                          </p>
                                          <form action={transferWorkspaceOwnershipAction} className="mt-2">
                                            <input type="hidden" name="workspace_id" value={context.currentWorkspaceId} />
                                            <input type="hidden" name="target_user_id" value={member.user_id} />
                                            <button
                                              type="submit"
                                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700"
                                            >
                                              Confirmar
                                            </button>
                                          </form>
                                        </div>
                                      </details>
                                    ) : null}
                                    {!isSelf ? (
                                      <form action={removeWorkspaceMemberAction}>
                                        <input type="hidden" name="workspace_id" value={context.currentWorkspaceId} />
                                        <input type="hidden" name="member_user_id" value={member.user_id} />
                                        <button
                                          type="submit"
                                          title="Remover membro"
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-700"
                                        >
                                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18" />
                                            <path d="M8 6V4h8v2" />
                                            <path d="M19 6l-1 14H6L5 6" />
                                            <path d="M10 11v6M14 11v6" />
                                          </svg>
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="muted-text text-xs">Sem acao</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-4 py-6 muted-text" colSpan={4}>
                            Nenhum membro encontrado no workspace ativo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {context.currentWorkspaceId ? (
              <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
                <h2 className="text-base font-semibold">Integracao Google Calendar (workspace ativo)</h2>
                <p className="muted-text mt-1 text-sm">
                  Defina o calendar ID para sincronizacao de atividades. Sem calendar ID, a atividade fica apenas no sistema.
                </p>
                {integrationSetupMissing ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Tabela <code>workspace_integrations</code> nao encontrada. Rode o SQL de{" "}
                    <code>app/docs/SUPABASE_WORKSPACE_INTEGRATIONS_SETUP.md</code>.
                  </div>
                ) : canManageMembers ? (
                  <form action={updateWorkspaceCalendarIntegrationAction} className="mt-4 grid gap-3 md:grid-cols-3">
                    <input type="hidden" name="workspace_id" value={context.currentWorkspaceId} />
                    <label className="text-xs font-medium text-[var(--muted)] md:col-span-2">
                      Google Calendar ID
                      <input
                        name="google_calendar_id"
                        defaultValue={integration?.google_calendar_id || ""}
                        placeholder="ex.: primary ou abc123@group.calendar.google.com"
                        className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-[var(--muted)]">
                      Timezone
                      <input
                        name="google_calendar_timezone"
                        defaultValue={integration?.google_calendar_timezone || "America/Sao_Paulo"}
                        placeholder="America/Sao_Paulo"
                        className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-2 text-sm"
                      />
                    </label>
                    <div className="md:col-span-3 flex items-center gap-2">
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
                      >
                        Salvar integracao
                      </button>
                      <p className="muted-text text-xs">
                        Deixe vazio para desativar a sincronizacao de calendario neste workspace.
                      </p>
                    </div>
                  </form>
                ) : (
                  <p className="muted-text mt-4 text-sm">
                    Somente owner/admin podem editar a integracao.
                  </p>
                )}
              </section>
            ) : null}

            {isOwnerInAnyWorkspace ? (
              <section className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-4">
                <h2 className="text-base font-semibold">Debug rapido (owner)</h2>
                <p className="muted-text mt-1 text-sm">
                  Dados tecnicos para validar permissao e remocao de workspace.
                </p>
                <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold">Slug</th>
                        <th className="px-4 py-3 text-left font-semibold">Workspace ID</th>
                        <th className="px-4 py-3 text-left font-semibold">Meu papel</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {context.options.map((workspace) => {
                        const isCurrent = context.currentWorkspaceId === workspace.id;
                        return (
                          <tr key={`debug-${workspace.id}`} className="border-b border-[var(--line)] last:border-0">
                            <td className="px-4 py-3">{workspace.name}</td>
                            <td className="px-4 py-3">{workspace.slug}</td>
                            <td className="px-4 py-3 font-mono text-xs">{workspace.id}</td>
                            <td className="px-4 py-3">{workspaceRoleLabel(workspace.role)}</td>
                            <td className="px-4 py-3">{isCurrent ? "Ativo" : "Inativo"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
