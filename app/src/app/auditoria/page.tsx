import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type PageSearchParams } from "@/lib/ui/action-feedback";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

type AuditLog = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "status_update" | "sync";
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ActionFilter = "all" | AuditLog["action"];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseAction(value: string | undefined): ActionFilter {
  if (!value) return "all";
  const allowed: ActionFilter[] = [
    "all",
    "create",
    "update",
    "delete",
    "status_update",
    "sync",
  ];
  return allowed.includes(value as ActionFilter) ? (value as ActionFilter) : "all";
}

function parseLimit(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  if (parsed < 20) return 20;
  if (parsed > 500) return 500;
  return parsed;
}

function actionLabel(action: AuditLog["action"]) {
  if (action === "create") return "Criacao";
  if (action === "update") return "Edicao";
  if (action === "delete") return "Remocao";
  if (action === "status_update") return "Troca de status";
  return "Sincronizacao";
}

function actionBadgeClass(action: AuditLog["action"]) {
  if (action === "create") return "bg-emerald-100 text-emerald-800";
  if (action === "update") return "bg-sky-100 text-sky-800";
  if (action === "delete") return "bg-rose-100 text-rose-800";
  if (action === "status_update") return "bg-amber-100 text-amber-800";
  return "bg-violet-100 text-violet-800";
}

function safePayload(payload: Record<string, unknown> | null) {
  if (!payload) return "-";
  return JSON.stringify(payload, null, 2);
}

function actorDisplay(log: AuditLog) {
  const actorName = log.payload?._actor_name;
  if (typeof actorName === "string" && actorName.trim()) {
    return actorName;
  }
  return log.actor_user_id || "-";
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedEntityType = firstValue(resolvedSearchParams.entity_type) || "all";
  const selectedAction = parseAction(firstValue(resolvedSearchParams.action));
  const selectedLimit = parseLimit(firstValue(resolvedSearchParams.limit));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  const query = supabase
    .from("audit_logs")
    .select("id, entity_type, entity_id, action, actor_user_id, payload, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(selectedLimit);

  if (selectedEntityType !== "all") {
    query.eq("entity_type", selectedEntityType);
  }

  if (selectedAction !== "all") {
    query.eq("action", selectedAction);
  }

  const { data, error } = await query.returns<AuditLog[]>();

  if (error) {
    throw new Error(error.message);
  }

  const logs = data || [];
  const entityTypes = Array.from(
    new Set(logs.map((log) => log.entity_type).filter(Boolean)),
  ).sort();

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Governanca
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Auditoria</h1>
            <p className="muted-text mt-2 text-sm">
              Trilhas de create/update/delete/status/sync para rastreabilidade.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <form action="/auditoria" className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-[var(--muted)]">
              Entidade
              <select
                name="entity_type"
                defaultValue={selectedEntityType}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todas</option>
                {entityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityType}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">
              Acao
              <select
                name="action"
                defaultValue={selectedAction}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todas</option>
                <option value="create">Criacao</option>
                <option value="update">Edicao</option>
                <option value="delete">Remocao</option>
                <option value="status_update">Troca de status</option>
                <option value="sync">Sincronizacao</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">
              Limite
              <select
                name="limit"
                defaultValue={String(selectedLimit)}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Filtrar
            </button>
            <Link
              href="/auditoria"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Limpar
            </Link>
            <p className="ml-auto text-xs text-[var(--muted)]">
              {logs.length} evento(s)
            </p>
          </form>
        </section>

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="mobile-table min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Quando</th>
                <th className="px-4 py-3 text-left font-semibold">Acao</th>
                <th className="px-4 py-3 text-left font-semibold">Entidade</th>
                <th className="px-4 py-3 text-left font-semibold">ID Entidade</th>
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3" data-label="Quando">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3" data-label="Acao">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionBadgeClass(log.action)}`}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3" data-label="Entidade">{log.entity_type}</td>
                    <td className="px-4 py-3" data-label="ID Entidade">
                      <code className="text-xs">{log.entity_id}</code>
                    </td>
                    <td className="px-4 py-3" data-label="Usuario">
                      <span className="text-xs">{actorDisplay(log)}</span>
                    </td>
                    <td className="px-4 py-3" data-label="Payload">
                      <details>
                        <summary className="cursor-pointer text-xs text-[var(--accent)]">
                          Ver payload
                        </summary>
                        <pre className="mt-2 max-w-[420px] overflow-auto rounded-md border border-[var(--line)] bg-[#faf7f2] p-2 text-xs whitespace-pre-wrap">
                          {safePayload(log.payload)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={6}>
                    Nenhum evento de auditoria encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
