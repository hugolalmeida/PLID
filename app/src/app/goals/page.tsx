import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createGoalAction,
  deleteGoalAction,
  updateGoalAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";
import { ExportActions } from "@/components/ui/export-actions";
import {
  getComputedGoalStatus,
  getEditableGoalStatus,
  goalProgressPercent,
} from "@/lib/goals/effective-status";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { canWriteWorkspaceRole, getWorkspaceRoleForUser } from "@/lib/workspaces/permissions";

type Organization = {
  id: string;
  name: string;
};

type Person = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  organization_id: string;
};

type PersonRole = {
  person_id: string;
  role_id: string;
  start_date: string | null;
  end_date: string | null;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  owner_person_id: string;
  period_start: string;
  period_end: string;
  target_value: number;
  current_value: number;
  status: "draft" | "active" | "at_risk" | "achieved" | "cancelled";
};

type GoalStatusFilter = "all" | Goal["status"];
type GoalPeriodFilter = "all" | "ongoing" | "upcoming" | "ended";

const statusOptions: Array<Goal["status"]> = [
  "draft",
  "active",
  "achieved",
  "cancelled",
];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseStatusFilter(value: string | undefined): GoalStatusFilter {
  if (!value) return "all";
  const allowed: GoalStatusFilter[] = [
    "all",
    "draft",
    "active",
    "at_risk",
    "achieved",
    "cancelled",
  ];
  return allowed.includes(value as GoalStatusFilter)
    ? (value as GoalStatusFilter)
    : "all";
}

function parsePeriodFilter(value: string | undefined): GoalPeriodFilter {
  if (!value) return "all";
  const allowed: GoalPeriodFilter[] = ["all", "ongoing", "upcoming", "ended"];
  return allowed.includes(value as GoalPeriodFilter)
    ? (value as GoalPeriodFilter)
    : "all";
}

function buildGoalsPath({
  status,
  period,
  organizationId,
  editId,
  removeId,
}: {
  status: GoalStatusFilter;
  period: GoalPeriodFilter;
  organizationId: string;
  editId?: string;
  removeId?: string;
}) {
  const params = new URLSearchParams();

  if (status !== "all") params.set("status", status);
  if (period !== "all") params.set("period", period);
  if (organizationId !== "all") params.set("organization_id", organizationId);
  if (editId) params.set("edit", editId);
  if (removeId) params.set("remove", removeId);

  const query = params.toString();
  return query ? `/goals?${query}` : "/goals";
}

function statusLabel(status: Goal["status"]) {
  if (status === "draft") return "Rascunho";
  if (status === "active") return "Ativa";
  if (status === "at_risk") return "Em risco";
  if (status === "achieved") return "Concluida";
  return "Cancelada";
}

function statusBadgeClass(status: Goal["status"]) {
  if (status === "draft") return "bg-slate-100 text-slate-800";
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "at_risk") return "bg-amber-100 text-amber-800";
  if (status === "achieved") return "bg-sky-100 text-sky-800";
  return "bg-rose-100 text-rose-800";
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
  const selectedStatus = parseStatusFilter(firstValue(resolvedSearchParams.status));
  const selectedPeriod = parsePeriodFilter(firstValue(resolvedSearchParams.period));
  const selectedOrganizationId = firstValue(resolvedSearchParams.organization_id) || "all";
  const editingGoalId = firstValue(resolvedSearchParams.edit);
  const removingGoalId = firstValue(resolvedSearchParams.remove);
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

  let goalsQuery = supabase
    .from("goals")
    .select(
      "id, title, description, organization_id, owner_person_id, period_start, period_end, target_value, current_value, status",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (selectedOrganizationId !== "all") {
    goalsQuery = goalsQuery.eq("organization_id", selectedOrganizationId);
  }

  const [goalsResult, organizationsResult, peopleResult, rolesResult, personRolesResult] = await Promise.all([
    goalsQuery.returns<Goal[]>(),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .returns<Organization[]>(),
    supabase
      .from("people")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .returns<Person[]>(),
    supabase
      .from("roles")
      .select("id, name, organization_id")
      .eq("workspace_id", workspaceId)
      .returns<Role[]>(),
    supabase
      .from("person_roles")
      .select("person_id, role_id, start_date, end_date")
      .eq("workspace_id", workspaceId)
      .returns<PersonRole[]>(),
  ]);

  const firstError =
    goalsResult.error ||
    organizationsResult.error ||
    peopleResult.error ||
    rolesResult.error ||
    personRolesResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const goals = goalsResult.data || [];
  const organizations = organizationsResult.data || [];
  const people = peopleResult.data || [];
  const roles = rolesResult.data || [];
  const personRoles = personRolesResult.data || [];
  const organizationNameById = new Map(
    organizations.map((organization) => [organization.id, organization.name]),
  );
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const personLabelById = new Map<string, string>();

  for (const person of people) {
    const currentLinks = personRoles
      .filter((link) => {
        if (link.person_id !== person.id) return false;
        const startsOk = !link.start_date || link.start_date <= todayIso;
        const endsOk = !link.end_date || link.end_date >= todayIso;
        return startsOk && endsOk;
      })
      .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

    const currentRole = currentLinks[0] ? roleById.get(currentLinks[0].role_id) : null;
    if (!currentRole) {
      personLabelById.set(person.id, person.name);
      continue;
    }

    const orgName = organizationNameById.get(currentRole.organization_id) || "Organizacao";
    personLabelById.set(person.id, `${person.name} (${currentRole.name} - ${orgName})`);
  }

  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);
  const canManage = canWriteWorkspaceRole(workspaceRole);
  const today = new Date();
  const todayDateIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);

  const filteredGoals = goals.filter((goal) => {
    const computedStatus = getComputedGoalStatus(goal);
    if (selectedStatus !== "all" && computedStatus !== selectedStatus) {
      return false;
    }

    if (selectedPeriod === "ongoing") {
      return goal.period_start <= todayDateIso && goal.period_end >= todayDateIso;
    }

    if (selectedPeriod === "upcoming") {
      return goal.period_start > todayDateIso;
    }

    if (selectedPeriod === "ended") {
      return goal.period_end < todayDateIso;
    }

    return true;
  });
  const editingGoal = canManage && editingGoalId
    ? filteredGoals.find((goal) => goal.id === editingGoalId) || null
    : null;
  const removingGoal =
    canManage && removingGoalId
      ? filteredGoals.find((goal) => goal.id === removingGoalId) || null
      : null;
  const closeEditPath = buildGoalsPath({
    status: selectedStatus,
    period: selectedPeriod,
    organizationId: selectedOrganizationId,
  });

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 8
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Metas</h1>
            <p className="muted-text mt-2 text-sm">
              Defina metas por periodo, acompanhe progresso e registre atualizacoes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExportActions csvHref="/api/export/goals" />
            <Link
              href="/dashboard"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>

        <CreateFeedbackBanner
          status={createFeedback.status}
          message={createFeedback.message}
        />

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <form action="/goals" className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-[var(--muted)]">
              Status
              <select
                name="status"
                defaultValue={selectedStatus}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todos</option>
                <option value="draft">Rascunho</option>
                <option value="active">Ativa</option>
                <option value="at_risk">Em risco</option>
                <option value="achieved">Concluida</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">
              Periodo
              <select
                name="period"
                defaultValue={selectedPeriod}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todos</option>
                <option value="ongoing">Em andamento</option>
                <option value="upcoming">Futuras</option>
                <option value="ended">Encerradas</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">
              Organizacao
              <select
                name="organization_id"
                defaultValue={selectedOrganizationId}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todas</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Filtrar
            </button>
            <Link
              href="/goals"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Limpar
            </Link>
            <p className="ml-auto text-xs text-[var(--muted)]">
              {filteredGoals.length} meta(s) encontrada(s)
            </p>
          </form>
        </section>

        {canManage ? (
          <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
              <span>Nova meta</span>
              <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +
              </span>
            </summary>
            <div className="create-collapsible-content">
              <div>
                <form action={createGoalAction} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    name="title"
                    placeholder="Titulo da meta"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="description"
                    placeholder="Descricao"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <select
                    name="organization_id"
                    required
                    defaultValue=""
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    <option value="" disabled>
                      Organizacao
                    </option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="owner_person_id"
                    required
                    defaultValue=""
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    <option value="" disabled>
                      Responsavel
                    </option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personLabelById.get(person.id) || person.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    name="period_start"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    type="date"
                    name="period_end"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="target_value"
                    placeholder="Meta alvo"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="current_value"
                    defaultValue="0"
                    placeholder="Valor atual"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <select
                    name="status"
                    defaultValue="draft"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
                  >
                    Criar meta
                  </button>
                </form>
              </div>
            </div>
          </details>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="mobile-table min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Meta</th>
                <th className="px-4 py-3 text-left font-semibold">Responsavel</th>
                <th className="px-4 py-3 text-left font-semibold">Periodo</th>
                <th className="px-4 py-3 text-left font-semibold">Progresso</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredGoals.length ? (
                filteredGoals.map((goal) => {
                  const ownerName =
                    people.find((person) => person.id === goal.owner_person_id)?.name || "-";
                  const progress = goalProgressPercent(goal.current_value, goal.target_value);
                  const computedStatus = getComputedGoalStatus(goal);
                  const openEditPath = buildGoalsPath({
                    status: selectedStatus,
                    period: selectedPeriod,
                    organizationId: selectedOrganizationId,
                    editId: goal.id,
                  });
                  const openRemovePath = buildGoalsPath({
                    status: selectedStatus,
                    period: selectedPeriod,
                    organizationId: selectedOrganizationId,
                    removeId: goal.id,
                  });

                  return (
                    <tr key={goal.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3" data-label="Meta">
                        <div>
                          <p className="font-medium">{goal.title}</p>
                          <p className="muted-text line-clamp-2 text-xs">{goal.description || "-"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3" data-label="Responsavel">{ownerName}</td>
                      <td className="px-4 py-3" data-label="Periodo">
                        {goal.period_start} ate {goal.period_end}
                      </td>
                      <td className="px-4 py-3" data-label="Progresso">
                        <div className="w-36 rounded-full bg-[#ece7dd]">
                          <div
                            className="h-2 rounded-full bg-[var(--accent)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {goal.current_value} / {goal.target_value} ({progress}%)
                        </p>
                      </td>
                      <td className="px-4 py-3" data-label="Status">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(computedStatus)}`}
                        >
                          {statusLabel(computedStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3" data-label="Acoes">
                        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                          {canManage ? (
                            <Link
                              href={openEditPath}
                              className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                              title="Editar meta"
                              aria-label={`Editar meta ${goal.title}`}
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5"
                                fill="currentColor"
                              >
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.39.242l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.242-.39l8.95-8.95zM12.172 5L5.223 11.95l-.55 1.65 1.65-.55L13.272 6.1 12.172 5z" />
                              </svg>
                            </Link>
                          ) : null}
                          <Link
                            href={`/goals/${goal.id}`}
                            className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                            title="Detalhes"
                            aria-label={`Detalhes da meta ${goal.title}`}
                          >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                              <path d="M10 3a7 7 0 110 14 7 7 0 010-14zm0 3a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 102 0 1 1 0 10-2 0v3a1 1 0 102 0v-3a1 1 0 10-2 0z" />
                            </svg>
                          </Link>
                          {canManage ? (
                            <Link
                              href={openRemovePath}
                              className="rounded-md border border-red-200 p-1.5 text-xs font-medium text-red-700"
                              title="Remover meta"
                              aria-label={`Remover meta ${goal.title}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                <path d="M7 2a1 1 0 00-.894.553L5.382 4H3a1 1 0 100 2h1l.8 10.4A2 2 0 006.79 18h6.42a2 2 0 001.99-1.6L16 6h1a1 1 0 100-2h-2.382l-.724-1.447A1 1 0 0013 2H7zm1.618 2h2.764l.5 1H8.118l.5-1zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
                              </svg>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={6}>
                    Nenhuma meta encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingGoal ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-3xl">
              <div className="modal-header">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                    Edicao rapida
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Editar meta</h2>
                  <p className="muted-text text-sm">{editingGoal.title}</p>
                </div>
                <Link
                  href={closeEditPath}
                  className="modal-close"
                >
                  Fechar
                </Link>
              </div>

              <form action={updateGoalAction} className="modal-body grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={editingGoal.id} />
                <input type="hidden" name="return_path" value={closeEditPath} />
                <label className="text-xs font-medium text-[var(--muted)]">
                  Titulo
                  <input
                    name="title"
                    defaultValue={editingGoal.title}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Organizacao
                  <select
                    name="organization_id"
                    defaultValue={editingGoal.organization_id}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-medium text-[var(--muted)]">
                  Descricao
                  <input
                    name="description"
                    defaultValue={editingGoal.description || ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Responsavel
                  <select
                    name="owner_person_id"
                    defaultValue={editingGoal.owner_person_id}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personLabelById.get(person.id) || person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Status
                  <select
                    name="status"
                    defaultValue={getEditableGoalStatus(editingGoal.status)}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Inicio
                  <input
                    type="date"
                    name="period_start"
                    defaultValue={editingGoal.period_start}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Fim
                  <input
                    type="date"
                    name="period_end"
                    defaultValue={editingGoal.period_end}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Valor alvo
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="target_value"
                    defaultValue={editingGoal.target_value}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Valor atual
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="current_value"
                    defaultValue={editingGoal.current_value}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <div className="modal-actions md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Salvar alteracoes
                  </button>
                  <Link
                    href={closeEditPath}
                    className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-medium"
                  >
                    Cancelar
                  </Link>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {removingGoal ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-lg">
              <div className="modal-header">
                <h2 className="text-lg font-semibold">Confirmar remocao</h2>
                <Link
                  href={closeEditPath}
                  className="modal-close"
                >
                  Fechar
                </Link>
              </div>
              <div className="modal-body">
              <p className="muted-text text-sm">
                Deseja remover a meta <strong>{removingGoal.title}</strong>? Esta acao nao pode ser desfeita.
              </p>
              <div className="modal-actions mt-4">
                <form action={deleteGoalAction}>
                  <input type="hidden" name="id" value={removingGoal.id} />
                  <input type="hidden" name="return_path" value={closeEditPath} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    Confirmar remocao
                  </button>
                </form>
                <Link
                  href={closeEditPath}
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-medium"
                >
                  Cancelar
                </Link>
              </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
