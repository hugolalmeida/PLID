import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { type PageSearchParams } from "@/lib/ui/action-feedback";
import { canWriteWorkspaceRole, getWorkspaceRoleForUser } from "@/lib/workspaces/permissions";
import {
  runNotificationsSweepAction,
  runSweepAndSendNotificationsAction,
  sendQueuedNotificationsAction,
} from "./actions";

type NotificationLog = {
  id: string;
  task_id: string;
  type: "due_reminder_2d" | "overdue_status_2d";
  recipient_email: string | null;
  sent_at: string;
  status: string;
  payload: Record<string, string | number | boolean | null> | null;
};

function typeLabel(type: NotificationLog["type"]) {
  if (type === "due_reminder_2d") return "Lembrete de prazo (2 dias)";
  return "Atraso sem conclusao (+2 dias)";
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseDaysFilter(value: string | undefined) {
  const allowed = new Set(["7", "30", "90"]);
  if (!value || !allowed.has(value)) return 30;
  return Number(value);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedDays = parseDaysFilter(firstValue(resolvedSearchParams.days));
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - selectedDays);
  const periodStartIso = periodStart.toISOString();

  const logsResult = await supabase
      .from("notifications_log")
      .select("id, task_id, type, recipient_email, sent_at, status, payload")
      .eq("workspace_id", workspaceId)
      .gte("sent_at", periodStartIso)
      .order("sent_at", { ascending: false })
      .limit(50)
      .returns<NotificationLog[]>();

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);
  const canManage = canWriteWorkspaceRole(workspaceRole);
  const logs = logsResult.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter((log) => log.sent_at.slice(0, 10) === today).length;
  const queuedCount = logs.filter((log) => log.status === "queued").length;
  const sentCount = logs.filter((log) => log.status === "sent").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const skippedCount = logs.filter((log) => log.status === "skipped").length;
  const latestFailure = logs.find(
    (log) => log.status === "failed" && typeof log.payload?.dispatch_error === "string",
  );

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 9
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Notificacoes</h1>
            <p className="muted-text mt-2 text-sm">
              Gera alertas de atividades com prazo proximo e de atraso sem
              conclusao.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Alertas hoje</p>
            <p className="mt-1 text-2xl font-semibold">{todayCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Fila pendente</p>
            <p className="mt-1 text-2xl font-semibold">{queuedCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Cobertura</p>
            <p className="muted-text mt-2 text-sm">
              Regras: prazo em 2 dias e tarefa vencida ha 2 dias sem conclusao.
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Enviadas</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{sentCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Falhas</p>
            <p className="mt-1 text-2xl font-semibold text-red-700">{failedCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-medium">Ignoradas</p>
            <p className="mt-1 text-2xl font-semibold">{skippedCount}</p>
          </article>
        </section>

        {latestFailure ? (
          <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Ultimo erro de envio</p>
            <p className="mt-1 text-sm text-red-700">
              {String(latestFailure.payload?.dispatch_error || "Erro nao informado")}
            </p>
          </section>
        ) : null}

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Execucao manual</h2>
            <p className="muted-text mt-1 text-sm">
              Gera logs de notificacao e dispara os e-mails pendentes da fila.
            </p>
            <form action="/notifications" className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-[var(--muted)]">
                Periodo do log
                <select
                  name="days"
                  defaultValue={String(selectedDays)}
                  className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                >
                  <option value="7">Ultimos 7 dias</option>
                  <option value="30">Ultimos 30 dias</option>
                  <option value="90">Ultimos 90 dias</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold"
              >
                Aplicar filtro
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={runSweepAndSendNotificationsAction}>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Varrer + Enviar
                </button>
              </form>
              <form action={runNotificationsSweepAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  Gerar fila
                </button>
              </form>
              <form action={sendQueuedNotificationsAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  Enviar fila (e-mail)
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="mobile-table min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Task</th>
                <th className="px-4 py-3 text-left font-semibold">Destinatario</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3" data-label="Tipo">{typeLabel(log.type)}</td>
                    <td className="px-4 py-3 font-mono text-xs" data-label="Task">{log.task_id.slice(0, 8)}</td>
                    <td className="px-4 py-3" data-label="Destinatario">
                      {log.recipient_email || log.payload?.recipient_profile || "-"}
                    </td>
                    <td className="px-4 py-3" data-label="Status">{log.status}</td>
                    <td className="px-4 py-3" data-label="Data">{new Date(log.sent_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3" data-label="Resumo">{log.payload?.reason || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={6}>
                    Nenhum log de notificacao ainda.
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
