import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createTaskAction,
  deleteTaskAction,
  syncTaskCalendarAction,
  updateTaskAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";
import { ExportActions } from "@/components/ui/export-actions";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

type Profile = {
  role: UserRole;
};

type Person = {
  id: string;
  name: string;
};

type Organization = {
  id: string;
  name: string;
};

type Meeting = {
  id: string;
  title: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  owner_person_id: string;
  organization_id: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  due_date: string;
  due_time: string | null;
  meeting_id: string | null;
};

type CalendarEvent = {
  task_id: string;
  google_event_id: string;
  synced_at: string;
};

type TaskStatusFilter = "all" | Task["status"];
type TaskDeadlineFilter = "all" | "overdue" | "today" | "next_7d" | "no_meeting";

const statusOptions: Array<Task["status"]> = [
  "todo",
  "in_progress",
  "done",
  "blocked",
];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseTaskStatusFilter(value: string | undefined): TaskStatusFilter {
  if (!value) return "all";
  const allowed: TaskStatusFilter[] = ["all", "todo", "in_progress", "done", "blocked"];
  return allowed.includes(value as TaskStatusFilter) ? (value as TaskStatusFilter) : "all";
}

function parseTaskDeadlineFilter(value: string | undefined): TaskDeadlineFilter {
  if (!value) return "all";
  const allowed: TaskDeadlineFilter[] = ["all", "overdue", "today", "next_7d", "no_meeting"];
  return allowed.includes(value as TaskDeadlineFilter)
    ? (value as TaskDeadlineFilter)
    : "all";
}

function buildTasksPath({
  status,
  organizationId,
  deadline,
  editId,
}: {
  status: TaskStatusFilter;
  organizationId: string;
  deadline: TaskDeadlineFilter;
  editId?: string;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (organizationId !== "all") params.set("organization_id", organizationId);
  if (deadline !== "all") params.set("deadline", deadline);
  if (editId) params.set("edit", editId);
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

function statusLabel(status: Task["status"]) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  if (status === "done") return "Concluida";
  return "Bloqueada";
}

function statusBadgeClass(status: Task["status"]) {
  if (status === "todo") return "bg-amber-500";
  if (status === "in_progress") return "bg-sky-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-rose-500";
}

function formatDateBr(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
  const selectedStatus = parseTaskStatusFilter(firstValue(resolvedSearchParams.status));
  const selectedOrganizationId = firstValue(resolvedSearchParams.organization_id) || "all";
  const selectedDeadline = parseTaskDeadlineFilter(firstValue(resolvedSearchParams.deadline));
  const editingTaskId = firstValue(resolvedSearchParams.edit);
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const [
    tasksResult,
    peopleResult,
    organizationsResult,
    meetingsResult,
    calendarEventsResult,
  ] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, owner_person_id, organization_id, status, due_date, due_time, meeting_id",
        )
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true })
        .returns<Task[]>(),
      supabase
        .from("people")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<Person[]>(),
      supabase
        .from("organizations")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<Organization[]>(),
      supabase
        .from("meetings")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .order("date", { ascending: false })
        .returns<Meeting[]>(),
      supabase
        .from("calendar_events")
        .select("task_id, google_event_id, synced_at")
        .eq("workspace_id", workspaceId)
        .returns<CalendarEvent[]>(),
    ]);

  const firstError =
    tasksResult.error ||
    peopleResult.error ||
    organizationsResult.error ||
    meetingsResult.error ||
    calendarEventsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const tasks = tasksResult.data || [];
  const people = peopleResult.data || [];
  const organizations = organizationsResult.data || [];
  const meetings = meetingsResult.data || [];
  const calendarEvents = calendarEventsResult.data || [];
  const calendarByTaskId = new Map(
    calendarEvents.map((event) => [event.task_id, event]),
  );
  const canManage = profile?.role !== "visualizador";
  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  const next7 = new Date(today);
  next7.setUTCDate(next7.getUTCDate() + 7);
  const next7Iso = new Date(
    Date.UTC(next7.getUTCFullYear(), next7.getUTCMonth(), next7.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);

  const filteredTasks = tasks.filter((task) => {
    if (selectedStatus !== "all" && task.status !== selectedStatus) {
      return false;
    }

    if (selectedOrganizationId !== "all" && task.organization_id !== selectedOrganizationId) {
      return false;
    }

    if (selectedDeadline === "overdue") {
      return task.due_date < todayIso;
    }

    if (selectedDeadline === "today") {
      return task.due_date === todayIso;
    }

    if (selectedDeadline === "next_7d") {
      return task.due_date >= todayIso && task.due_date <= next7Iso;
    }

    if (selectedDeadline === "no_meeting") {
      return !task.meeting_id;
    }

    return true;
  });
  const editingTask =
    canManage && editingTaskId
      ? filteredTasks.find((task) => task.id === editingTaskId) || null
      : null;
  const closeEditPath = buildTasksPath({
    status: selectedStatus,
    organizationId: selectedOrganizationId,
    deadline: selectedDeadline,
  });

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 7
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Atividades</h1>
            <p className="muted-text mt-2 text-sm">
              Registre e acompanhe atividades da lideranca com prazo e responsavel.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExportActions csvHref="/api/export/tasks" />
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
          <form action="/tasks" className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-[var(--muted)]">
              Status
              <select
                name="status"
                defaultValue={selectedStatus}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todos</option>
                <option value="todo">A fazer</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluida</option>
                <option value="blocked">Bloqueada</option>
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
            <label className="text-xs font-medium text-[var(--muted)]">
              Prazo
              <select
                name="deadline"
                defaultValue={selectedDeadline}
                className="mt-1 block rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Todos</option>
                <option value="overdue">Atrasadas</option>
                <option value="today">Vencem hoje</option>
                <option value="next_7d">Proximos 7 dias</option>
                <option value="no_meeting">Sem reuniao vinculada</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Filtrar
            </button>
            <Link
              href="/tasks"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Limpar
            </Link>
            <p className="ml-auto text-xs text-[var(--muted)]">
              {filteredTasks.length} atividade(s) encontrada(s)
            </p>
          </form>
        </section>

        {canManage ? (
          <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
              <span>Nova atividade</span>
              <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +
              </span>
            </summary>
            <div className="create-collapsible-content">
              <div>
                <form action={createTaskAction} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    name="title"
                    placeholder="Titulo"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="description"
                    placeholder="Descricao/Anuncio"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
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
                        {person.name}
                      </option>
                    ))}
                  </select>
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
                    name="status"
                    defaultValue="todo"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    name="due_date"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    type="time"
                    name="due_time"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <select
                    name="meeting_id"
                    defaultValue=""
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    <option value="">Sem reuniao vinculada</option>
                    {meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
                  >
                    Criar atividade
                  </button>
                </form>
              </div>
            </div>
          </details>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                A fazer
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Em andamento
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Concluida
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Bloqueada
              </span>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titulo</th>
                <th className="px-4 py-3 text-left font-semibold">Organizacao</th>
                <th className="px-4 py-3 text-left font-semibold">Prazo</th>
                <th className="px-4 py-3 text-left font-semibold">Horario</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Reuniao</th>
                <th className="px-4 py-3 text-left font-semibold">Calendario</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length ? (
                filteredTasks.map((task) => {
                  const syncedEvent = calendarByTaskId.get(task.id);
                  const openEditPath = buildTasksPath({
                    status: selectedStatus,
                    organizationId: selectedOrganizationId,
                    deadline: selectedDeadline,
                    editId: task.id,
                  });
                  return (
                    <tr key={task.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{task.title}</p>
                        <p className="muted-text line-clamp-2 text-xs">{task.description || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {organizations.find((organization) => organization.id === task.organization_id)
                          ?.name || "-"}
                      </td>
                      <td className="px-4 py-3">{formatDateBr(task.due_date)}</td>
                      <td className="px-4 py-3">{task.due_time || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          title={statusLabel(task.status)}
                          aria-label={statusLabel(task.status)}
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${statusBadgeClass(task.status)}`}
                        >
                          <span className="sr-only">{statusLabel(task.status)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.meeting_id
                          ? meetings.find((meeting) => meeting.id === task.meeting_id)?.title || "-"
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {syncedEvent ? (
                          <p className="text-xs text-emerald-700">
                            Sincronizada em{" "}
                            {new Date(syncedEvent.synced_at).toLocaleString("pt-BR")}
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">Nao sincronizada</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                            <Link
                              href={openEditPath}
                              className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                              title="Editar atividade"
                              aria-label={`Editar atividade ${task.title}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.39.242l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.242-.39l8.95-8.95zM12.172 5L5.223 11.95l-.55 1.65 1.65-.55L13.272 6.1 12.172 5z" />
                              </svg>
                            </Link>
                            <form action={syncTaskCalendarAction}>
                              <input type="hidden" name="task_id" value={task.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                                title="Re-sincronizar calendario"
                                aria-label={`Re-sincronizar calendario da atividade ${task.title}`}
                              >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                  <path d="M10 2a8 8 0 00-7.75 6H1a1 1 0 100 2h3a1 1 0 001-1V6a1 1 0 10-2 0v.93A6 6 0 1110 16a1 1 0 100 2 8 8 0 000-16z" />
                                </svg>
                              </button>
                            </form>
                            <form action={deleteTaskAction}>
                              <input type="hidden" name="id" value={task.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-red-200 p-1.5 text-xs font-medium text-red-700"
                                title="Remover atividade"
                                aria-label={`Remover atividade ${task.title}`}
                              >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                  <path d="M7 2a1 1 0 00-.894.553L5.382 4H3a1 1 0 100 2h1l.8 10.4A2 2 0 006.79 18h6.42a2 2 0 001.99-1.6L16 6h1a1 1 0 100-2h-2.382l-.724-1.447A1 1 0 0013 2H7zm1.618 2h2.764l.5 1H8.118l.5-1zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
                                </svg>
                              </button>
                            </form>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={9}>
                    Nenhuma atividade encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingTask ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-3xl">
              <div className="modal-header">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                    Edicao rapida
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Editar atividade</h2>
                  <p className="muted-text text-sm">{editingTask.title}</p>
                </div>
                <Link
                  href={closeEditPath}
                  className="modal-close"
                >
                  Fechar
                </Link>
              </div>

              <form action={updateTaskAction} className="modal-body grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={editingTask.id} />
                <input type="hidden" name="return_path" value={closeEditPath} />
                <label className="text-xs font-medium text-[var(--muted)]">
                  Titulo
                  <input
                    name="title"
                    defaultValue={editingTask.title}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Responsavel
                  <select
                    name="owner_person_id"
                    defaultValue={editingTask.owner_person_id}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-medium text-[var(--muted)]">
                  Descricao
                  <input
                    name="description"
                    defaultValue={editingTask.description || ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Organizacao
                  <select
                    name="organization_id"
                    defaultValue={editingTask.organization_id}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Status
                  <select
                    name="status"
                    defaultValue={editingTask.status}
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
                  Prazo
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={editingTask.due_date}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Horario
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTask.due_time || ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="md:col-span-2 text-xs font-medium text-[var(--muted)]">
                  Reuniao vinculada
                  <select
                    name="meeting_id"
                    defaultValue={editingTask.meeting_id || ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    <option value="">Sem reuniao</option>
                    {meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </option>
                    ))}
                  </select>
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
      </section>
    </main>
  );
}
