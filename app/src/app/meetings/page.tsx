import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";
import { ExportActions } from "@/components/ui/export-actions";

type Profile = {
  role: UserRole;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  minutes: string | null;
  status: "todo" | "in_progress" | "done";
};

type MeetingStatusFilter = "all" | Meeting["status"];
type MeetingPeriodFilter = "all" | "today" | "next_7d" | "upcoming" | "past";

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseMeetingStatusFilter(value: string | undefined): MeetingStatusFilter {
  if (!value) return "all";
  const allowed: MeetingStatusFilter[] = ["all", "todo", "in_progress", "done"];
  return allowed.includes(value as MeetingStatusFilter)
    ? (value as MeetingStatusFilter)
    : "all";
}

function parseMeetingPeriodFilter(value: string | undefined): MeetingPeriodFilter {
  if (!value) return "all";
  const allowed: MeetingPeriodFilter[] = ["all", "today", "next_7d", "upcoming", "past"];
  return allowed.includes(value as MeetingPeriodFilter)
    ? (value as MeetingPeriodFilter)
    : "all";
}

function buildMeetingsPath({
  status,
  period,
  editId,
}: {
  status: MeetingStatusFilter;
  period: MeetingPeriodFilter;
  editId?: string;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (period !== "all") params.set("period", period);
  if (editId) params.set("edit", editId);
  const query = params.toString();
  return query ? `/meetings?${query}` : "/meetings";
}

function meetingStatusLabel(status: Meeting["status"]) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  return "Concluida";
}

function meetingStatusBadgeClass(status: Meeting["status"]) {
  if (status === "todo") return "bg-amber-500";
  if (status === "in_progress") return "bg-sky-500";
  return "bg-emerald-500";
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
  const selectedStatus = parseMeetingStatusFilter(firstValue(resolvedSearchParams.status));
  const selectedPeriod = parseMeetingPeriodFilter(firstValue(resolvedSearchParams.period));
  const editingMeetingId = firstValue(resolvedSearchParams.edit);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const meetingsWithStatus = await supabase
    .from("meetings")
    .select("id, title, date, notes, minutes, status")
    .order("date", { ascending: false })
    .returns<Meeting[]>();

  let meetings = meetingsWithStatus.data || [];
  let error = meetingsWithStatus.error;

  if (meetingsWithStatus.error && meetingsWithStatus.error.message.toLowerCase().includes("status")) {
    const fallback = await supabase
      .from("meetings")
      .select("id, title, date, notes, minutes")
      .order("date", { ascending: false })
      .returns<Array<Omit<Meeting, "status">>>();

    meetings = (fallback.data || []).map((meeting) => ({
      ...meeting,
      status: "todo",
    }));
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

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

  const filteredMeetings = meetings.filter((meeting) => {
    if (selectedStatus !== "all" && meeting.status !== selectedStatus) {
      return false;
    }

    if (selectedPeriod === "today") {
      return meeting.date === todayIso;
    }

    if (selectedPeriod === "next_7d") {
      return meeting.date >= todayIso && meeting.date <= next7Iso;
    }

    if (selectedPeriod === "upcoming") {
      return meeting.date >= todayIso;
    }

    if (selectedPeriod === "past") {
      return meeting.date < todayIso;
    }

    return true;
  });
  const editingMeeting =
    canManage && editingMeetingId
      ? filteredMeetings.find((meeting) => meeting.id === editingMeetingId) || null
      : null;
  const closeEditPath = buildMeetingsPath({
    status: selectedStatus,
    period: selectedPeriod,
  });

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 6
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Reunioes</h1>
            <p className="muted-text mt-2 text-sm">
              Crie reunioes rapidamente e depois abra um registro separado para
              anotar pontos importantes, decisoes e encaminhamentos.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExportActions csvHref="/api/export/meetings" />
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
          <form action="/meetings" className="flex flex-wrap items-end gap-3">
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
                <option value="today">Hoje</option>
                <option value="next_7d">Proximos 7 dias</option>
                <option value="upcoming">Futuras</option>
                <option value="past">Passadas</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Filtrar
            </button>
            <Link
              href="/meetings"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Limpar
            </Link>
            <p className="ml-auto text-xs text-[var(--muted)]">
              {filteredMeetings.length} reuniao(oes) encontrada(s)
            </p>
          </form>
        </section>

        {canManage ? (
          <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
              <span>Nova reuniao</span>
              <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +
              </span>
            </summary>
            <div className="create-collapsible-content">
              <div>
                <form action={createMeetingAction} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    name="title"
                    placeholder="Titulo da reuniao"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <input
                    type="date"
                    name="date"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <input
                    name="notes"
                    placeholder="Notas curtas"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <select
                    name="status"
                    defaultValue="todo"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="todo">A fazer</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="done">Concluida</option>
                  </select>
                  <button
                    type="submit"
                    className="md:col-span-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
                  >
                    Criar e abrir registro
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
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titulo</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Notas</th>
                <th className="px-4 py-3 text-left font-semibold">Documento</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeetings.length ? (
                filteredMeetings.map((meeting) => {
                  const openEditPath = buildMeetingsPath({
                    status: selectedStatus,
                    period: selectedPeriod,
                    editId: meeting.id,
                  });

                  return (
                    <tr key={meeting.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{meeting.title}</p>
                    </td>
                    <td className="px-4 py-3">{meeting.date}</td>
                    <td className="px-4 py-3">
                      <span
                        title={meetingStatusLabel(meeting.status)}
                        aria-label={meetingStatusLabel(meeting.status)}
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${meetingStatusBadgeClass(meeting.status)}`}
                      >
                        <span className="sr-only">{meetingStatusLabel(meeting.status)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{meeting.notes || "-"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/meetings/${meeting.id}/registro`}
                        className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium text-[var(--accent)]"
                      >
                        Abrir registro
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                          <Link
                            href={openEditPath}
                            className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                            title="Editar reuniao"
                            aria-label={`Editar reuniao ${meeting.title}`}
                          >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.39.242l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.242-.39l8.95-8.95zM12.172 5L5.223 11.95l-.55 1.65 1.65-.55L13.272 6.1 12.172 5z" />
                            </svg>
                          </Link>
                          <form action={deleteMeetingAction}>
                            <input type="hidden" name="id" value={meeting.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-red-200 p-1.5 text-xs font-medium text-red-700"
                              title="Remover reuniao"
                              aria-label={`Remover reuniao ${meeting.title}`}
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
                  <td className="px-4 py-6 muted-text" colSpan={6}>
                    Nenhuma reuniao encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingMeeting ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-2xl">
              <div className="modal-header">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                    Edicao rapida
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Editar reuniao</h2>
                  <p className="muted-text text-sm">{editingMeeting.title}</p>
                </div>
                <Link
                  href={closeEditPath}
                  className="modal-close"
                >
                  Fechar
                </Link>
              </div>

              <form action={updateMeetingAction} className="modal-body grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={editingMeeting.id} />
                <input type="hidden" name="return_path" value={closeEditPath} />
                <label className="text-xs font-medium text-[var(--muted)]">
                  Titulo
                  <input
                    name="title"
                    defaultValue={editingMeeting.title}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Data
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingMeeting.date}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Status
                  <select
                    name="status"
                    defaultValue={editingMeeting.status}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    <option value="todo">A fazer</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="done">Concluida</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-medium text-[var(--muted)]">
                  Notas
                  <input
                    name="notes"
                    defaultValue={editingMeeting.notes || ""}
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
      </section>
    </main>
  );
}
