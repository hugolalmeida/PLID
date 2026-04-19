import Link from "next/link";
import { redirect } from "next/navigation";
import {
  signOutAction,
  updateGoalStatusQuickAction,
  updateMeetingStatusQuickAction,
  updateTaskStatusQuickAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";
import { getComputedGoalStatus, goalProgressPercent } from "@/lib/goals/effective-status";
import { type PageSearchParams } from "@/lib/ui/action-feedback";

type ProfileRow = {
  full_name: string | null;
  role: UserRole;
};

type MeetingStatus = "todo" | "in_progress" | "done";

type MeetingRow = {
  id: string;
  title: string;
  date: string;
  status: MeetingStatus;
};

type TaskPreviewRow = {
  id: string;
  title: string;
  due_date: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  organization_id: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type GoalPreviewRow = {
  id: string;
  title: string;
  status: "draft" | "active" | "at_risk" | "achieved" | "cancelled";
  current_value: number;
  target_value: number;
  period_start: string;
  period_end: string;
  organization_id: string;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseRangeDays(raw: string | undefined) {
  const allowed = new Set(["7", "30", "90"]);
  if (!raw || !allowed.has(raw)) return 7;
  return Number(raw);
}

function roleLabel(role: UserRole | undefined) {
  if (role === "presidencia") return "Presidencia";
  if (role === "secretaria") return "Secretaria";
  if (role === "lider") return "Lider";
  if (role === "visualizador") return "Visualizador";
  return "Sem perfil definido";
}

function taskStatusLabel(status: TaskPreviewRow["status"]) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  if (status === "done") return "Concluida";
  return "Bloqueada";
}

function goalStatusLabel(status: GoalPreviewRow["status"]) {
  if (status === "draft") return "Rascunho";
  if (status === "active") return "Ativa";
  if (status === "at_risk") return "Em risco";
  if (status === "achieved") return "Concluida";
  return "Cancelada";
}

function meetingStatusLabel(status: MeetingStatus) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  return "Concluida";
}

function taskStatusBadgeClass(status: TaskPreviewRow["status"]) {
  if (status === "todo") return "bg-slate-400";
  if (status === "in_progress") return "bg-blue-500";
  if (status === "blocked") return "bg-red-500";
  return "bg-emerald-500";
}

function goalStatusBadgeClass(status: GoalPreviewRow["status"]) {
  if (status === "draft") return "bg-slate-400";
  if (status === "active") return "bg-emerald-500";
  if (status === "at_risk") return "bg-red-500";
  if (status === "achieved") return "bg-teal-500";
  return "bg-zinc-500";
}

function meetingStatusBadgeClass(status: MeetingStatus) {
  if (status === "todo") return "bg-slate-400";
  if (status === "in_progress") return "bg-blue-500";
  return "bg-emerald-500";
}

function goalRiskSemaforo(goal: GoalPreviewRow) {
  const computedStatus = getComputedGoalStatus(goal);
  if (computedStatus === "at_risk") return { label: "Risco alto", className: "bg-red-500" };
  if (computedStatus === "active") return { label: "Em andamento", className: "bg-emerald-500" };
  return { label: "Neutro", className: "bg-slate-400" };
}

function goalTrend(goal: GoalPreviewRow) {
  const progress = goalProgressPercent(goal.current_value, goal.target_value);
  const start = new Date(`${goal.period_start}T00:00:00`).getTime();
  const end = new Date(`${goal.period_end}T00:00:00`).getTime();
  const now = Date.now();
  const elapsed = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  const expected = Math.round(elapsed * 100);

  if (progress >= expected + 10) return "Acima do ritmo";
  if (progress <= expected - 10) return "Atrasada";
  return "No ritmo";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedRangeDays = parseRangeDays(firstValue(resolvedSearchParams.range_days));
  const selectedOrganizationId = firstValue(resolvedSearchParams.organization_id) || "";
  const updatedType = firstValue(resolvedSearchParams.updated);
  const updatedId = firstValue(resolvedSearchParams.updated_id);

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

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + selectedRangeDays);
  const rangeEndIso = rangeEnd.toISOString().slice(0, 10);

  const tasksOpenQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done");
  const tasksOverdueQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done")
    .lt("due_date", todayIso);
  const tasksDueWindowQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done")
    .gte("due_date", todayIso)
    .lte("due_date", rangeEndIso);
  const goalsMetricsQuery = supabase
    .from("goals")
    .select("id, status, current_value, target_value, period_start, period_end")
    .in("status", ["active", "at_risk"])
    .returns<
      Array<
        Pick<
          GoalPreviewRow,
          "id" | "status" | "current_value" | "target_value" | "period_start" | "period_end"
        >
      >
    >();
  const tasksPreviewQuery = supabase
    .from("tasks")
    .select("id, title, due_date, status, organization_id")
    .neq("status", "done")
    .gte("due_date", todayIso)
    .lte("due_date", rangeEndIso)
    .order("due_date", { ascending: true })
    .limit(5)
    .returns<TaskPreviewRow[]>();
  const goalsPreviewQuery = supabase
    .from("goals")
    .select(
      "id, title, status, current_value, target_value, period_start, period_end, organization_id",
    )
    .in("status", ["active", "at_risk"])
    .order("period_end", { ascending: true })
    .limit(5)
    .returns<GoalPreviewRow[]>();

  if (selectedOrganizationId) {
    tasksOpenQuery.eq("organization_id", selectedOrganizationId);
    tasksOverdueQuery.eq("organization_id", selectedOrganizationId);
    tasksDueWindowQuery.eq("organization_id", selectedOrganizationId);
    goalsMetricsQuery.eq("organization_id", selectedOrganizationId);
    tasksPreviewQuery.eq("organization_id", selectedOrganizationId);
    goalsPreviewQuery.eq("organization_id", selectedOrganizationId);
  }

  const [
    tasksOpenResult,
    tasksOverdueResult,
    tasksDueWeekResult,
    goalsMetricsResult,
    tasksPreviewResult,
    goalsPreviewResult,
    organizationsResult,
  ] = await Promise.all([
    tasksOpenQuery,
    tasksOverdueQuery,
    tasksDueWindowQuery,
    goalsMetricsQuery,
    tasksPreviewQuery,
    goalsPreviewQuery,
    supabase
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<OrganizationRow[]>(),
  ]);

  const meetingsWithStatusResult = await supabase
    .from("meetings")
    .select("id, title, date, status")
    .gte("date", todayIso)
    .lte("date", rangeEndIso)
    .order("date", { ascending: true })
    .limit(3)
    .returns<MeetingRow[]>();

  let meetingsUpcomingError = meetingsWithStatusResult.error;
  let upcomingMeetings = meetingsWithStatusResult.data || [];

  if (
    meetingsWithStatusResult.error &&
    meetingsWithStatusResult.error.message.toLowerCase().includes("status")
  ) {
    const meetingsFallbackResult = await supabase
      .from("meetings")
      .select("id, title, date")
      .gte("date", todayIso)
      .lte("date", rangeEndIso)
      .order("date", { ascending: true })
      .limit(3)
      .returns<Array<Omit<MeetingRow, "status">>>();

    meetingsUpcomingError = meetingsFallbackResult.error;
    upcomingMeetings = (meetingsFallbackResult.data || []).map((meeting) => ({
      ...meeting,
      status: "todo" as const,
    }));
  }

  const firstError =
    tasksOpenResult.error ||
    tasksOverdueResult.error ||
    tasksDueWeekResult.error ||
    goalsMetricsResult.error ||
    tasksPreviewResult.error ||
    goalsPreviewResult.error ||
    organizationsResult.error ||
    meetingsUpcomingError;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const canManage = profile?.role !== "visualizador";
  const tasksOpenCount = tasksOpenResult.count || 0;
  const tasksOverdueCount = tasksOverdueResult.count || 0;
  const tasksDueWeekCount = tasksDueWeekResult.count || 0;
  const goalsEligible = goalsMetricsResult.data || [];
  const goalsAtRiskCount = goalsEligible.filter(
    (goal) => getComputedGoalStatus(goal) === "at_risk",
  ).length;
  const goalsActiveCount = goalsEligible.filter(
    (goal) => getComputedGoalStatus(goal) === "active",
  ).length;
  const upcomingTasks = tasksPreviewResult.data || [];
  const goalsInFocus = goalsPreviewResult.data || [];
  const organizations = organizationsResult.data || [];
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const organizationLabel =
    selectedOrganizationId
      ? organizationById.get(selectedOrganizationId)?.name || "organizacao selecionada"
      : "";
  const scopeSuffix = selectedOrganizationId ? ` para ${organizationLabel}` : "";

  function showUpdatedBadge(type: "task" | "goal" | "meeting", id: string) {
    return updatedType === type && updatedId === id;
  }
  const todayLabel = today.toLocaleDateString("pt-BR");

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Dashboard executivo
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Bem-vindo, {profile?.full_name || user.email}
            </h1>
            <p className="muted-text mt-2 text-sm">Perfil: {roleLabel(profile?.role)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="exec-pill">Atualizado em {todayLabel}</span>
              {selectedOrganizationId && selectedOrganizationId !== "" ? (
                <span className="exec-pill">
                  Organizacao: {organizations.find((o) => o.id === selectedOrganizationId)?.name || "Filtro ativo"}
                </span>
              ) : null}
            </div>
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

        <form action="/dashboard" className="mt-4 flex flex-wrap items-end gap-2 exec-panel">
          <label className="text-xs font-medium text-[var(--muted)]">
            Janela
            <select
              name="range_days"
              defaultValue={String(selectedRangeDays)}
              className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Organizacao
            <select
              name="organization_id"
              defaultValue={selectedOrganizationId}
              className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Todas</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-medium"
          >
            Aplicar
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-medium"
          >
            Limpar
          </Link>
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="exec-kpi">
            <p className="text-sm font-medium">Atividades em aberto</p>
            <p className="mt-2 text-2xl font-semibold">{tasksOpenCount}</p>
            <p className="muted-text mt-1 text-xs">Status diferente de concluida</p>
          </article>
          <article className="exec-kpi">
            <p className="text-sm font-medium">Atrasadas</p>
            <p className="mt-2 text-2xl font-semibold text-red-700">{tasksOverdueCount}</p>
            <p className="muted-text mt-1 text-xs">Prazo ja passou e ainda nao concluidas</p>
          </article>
          <article className="exec-kpi">
            <p className="text-sm font-medium">Vencendo em {selectedRangeDays} dias</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{tasksDueWeekCount}</p>
            <p className="muted-text mt-1 text-xs">Atividades que pedem acompanhamento</p>
          </article>
          <article className="exec-kpi">
            <p className="text-sm font-medium">Metas ativas / em risco</p>
            <p className="mt-2 text-2xl font-semibold">
              {goalsActiveCount} <span className="muted-text text-base font-medium">/</span>{" "}
              <span className="text-red-700">{goalsAtRiskCount}</span>
            </p>
            <p className="muted-text mt-1 text-xs">Estado atual do planejamento</p>
          </article>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <article className="exec-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Proximas atividades</p>
              <Link
                href="/tasks"
                className="text-xs font-medium text-[var(--accent)] underline underline-offset-2"
              >
                Ver tudo
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                A fazer
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Em andamento
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Concluida
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Bloqueada
              </span>
            </div>
            {upcomingTasks.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {upcomingTasks.map((task) => {
                  return (
                    <li key={task.id} className="rounded-lg border border-[var(--line)] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{task.title}</p>
                        <span
                          title={taskStatusLabel(task.status)}
                          aria-label={taskStatusLabel(task.status)}
                          className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${taskStatusBadgeClass(task.status)}`}
                        >
                          <span className="sr-only">{taskStatusLabel(task.status)}</span>
                        </span>
                      </div>
                      <p className="muted-text mt-1 text-xs">
                        Prazo: {new Date(`${task.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="muted-text text-xs">
                        Organizacao responsavel:{" "}
                        {organizationById.get(task.organization_id)?.name || "Nao definida"}
                      </p>
                      {canManage ? (
                        <form action={updateTaskStatusQuickAction} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="range_days" value={String(selectedRangeDays)} />
                          <input type="hidden" name="organization_id" value={selectedOrganizationId} />
                          <select
                            name="status"
                            defaultValue={task.status}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                          >
                            <option value="todo">A fazer</option>
                            <option value="in_progress">Em andamento</option>
                            <option value="done">Concluida</option>
                            <option value="blocked">Bloqueada</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium"
                          >
                            Atualizar
                          </button>
                        </form>
                      ) : null}
                      {showUpdatedBadge("task", task.id) ? (
                        <p className="mt-1 text-xs font-medium text-emerald-700">Status salvo.</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted-text mt-2 text-sm">
                Sem atividades em aberto nos proximos {selectedRangeDays} dias{scopeSuffix}.
              </p>
            )}
          </article>

          <article className="exec-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Metas em foco</p>
              <Link
                href="/goals"
                className="text-xs font-medium text-[var(--accent)] underline underline-offset-2"
              >
                Ver tudo
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Ativa
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Em risco
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                Concluida
              </span>
            </div>
            {goalsInFocus.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {goalsInFocus.map((goal) => {
                  const progress = goalProgressPercent(goal.current_value, goal.target_value);
                  const computedStatus = getComputedGoalStatus(goal);
                  const semaforo = goalRiskSemaforo(goal);
                  const trend = goalTrend(goal);
                  return (
                    <li key={goal.id} className="rounded-lg border border-[var(--line)] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{goal.title}</p>
                        <span
                          title={goalStatusLabel(computedStatus)}
                          aria-label={goalStatusLabel(computedStatus)}
                          className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${goalStatusBadgeClass(computedStatus)}`}
                        >
                          <span className="sr-only">{goalStatusLabel(computedStatus)}</span>
                        </span>
                      </div>
                      <p className="muted-text mt-1 text-xs">
                        Fim em{" "}
                        {new Date(`${goal.period_end}T12:00:00`).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="mt-2 h-2 w-full rounded-full bg-[#ece7dd]">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="muted-text mt-1 text-xs">
                        {goal.current_value} / {goal.target_value} ({progress}%) | Tendencia: {trend} |{" "}
                        <span className="inline-flex items-center gap-1">
                          <span className={`inline-block h-2 w-2 rounded-full ${semaforo.className}`} />
                          {semaforo.label}
                        </span>
                      </p>
                      {canManage ? (
                        <form action={updateGoalStatusQuickAction} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="id" value={goal.id} />
                          <input type="hidden" name="range_days" value={String(selectedRangeDays)} />
                          <input type="hidden" name="organization_id" value={selectedOrganizationId} />
                          <select
                            name="status"
                            defaultValue={computedStatus === "at_risk" ? "active" : computedStatus}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                          >
                            <option value="draft">Rascunho</option>
                            <option value="active">Ativa</option>
                            <option value="achieved">Concluida</option>
                            <option value="cancelled">Cancelada</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium"
                          >
                            Atualizar
                          </button>
                        </form>
                      ) : null}
                      {showUpdatedBadge("goal", goal.id) ? (
                        <p className="mt-1 text-xs font-medium text-emerald-700">Status salvo.</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted-text mt-2 text-sm">
                Sem metas ativas ou em risco no momento{scopeSuffix}.
              </p>
            )}
          </article>

          <article className="exec-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Proximas reunioes</p>
              <Link
                href="/meetings"
                className="text-xs font-medium text-[var(--accent)] underline underline-offset-2"
              >
                Ver tudo
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                A fazer
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Em andamento
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Concluida
              </span>
            </div>
            {upcomingMeetings.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {upcomingMeetings.map((meeting) => (
                  <li key={meeting.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{meeting.title}</p>
                      <span
                        title={meetingStatusLabel(meeting.status)}
                        aria-label={meetingStatusLabel(meeting.status)}
                        className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${meetingStatusBadgeClass(meeting.status)}`}
                      >
                        <span className="sr-only">{meetingStatusLabel(meeting.status)}</span>
                      </span>
                    </div>
                    <p className="muted-text mt-1 text-xs">
                      Data: {new Date(`${meeting.date}T12:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="mt-2">
                      <Link
                        href={`/meetings/${meeting.id}/registro`}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white p-1.5 text-[var(--accent)]"
                        title="Abrir registro da reuniao"
                        aria-label={`Abrir registro da reuniao ${meeting.title}`}
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                          <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0010.586 2H6zm4 1.5V7a1 1 0 001 1h3.5V16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1h4zm-2 7a1 1 0 100 2h4a1 1 0 100-2H8zm0 3a1 1 0 100 2h4a1 1 0 100-2H8z" />
                        </svg>
                      </Link>
                    </div>
                    {canManage ? (
                      <form action={updateMeetingStatusQuickAction} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="id" value={meeting.id} />
                        <input type="hidden" name="range_days" value={String(selectedRangeDays)} />
                        <input type="hidden" name="organization_id" value={selectedOrganizationId} />
                        <select
                          name="status"
                          defaultValue={meeting.status}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                        >
                          <option value="todo">A fazer</option>
                          <option value="in_progress">Em andamento</option>
                          <option value="done">Concluida</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium"
                        >
                          Atualizar
                        </button>
                      </form>
                    ) : null}
                    {showUpdatedBadge("meeting", meeting.id) ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">Status salvo.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text mt-2 text-sm">
                Sem reunioes nos proximos {selectedRangeDays} dias{scopeSuffix}.
              </p>
            )}
          </article>
        </div>

        <div className="mt-6 exec-panel">
          <p className="text-sm font-medium">Atalhos rapidos</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/tasks"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Atividades
            </Link>
            <Link
              href="/goals"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Metas
            </Link>
            <Link
              href="/meetings"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Reunioes
            </Link>
          </div>
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
