import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

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

const statusOptions: Array<Task["status"]> = [
  "todo",
  "in_progress",
  "done",
  "blocked",
];

function statusLabel(status: Task["status"]) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  if (status === "done") return "Concluida";
  return "Bloqueada";
}

export default async function TasksPage() {
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

  const [tasksResult, peopleResult, organizationsResult, meetingsResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, owner_person_id, organization_id, status, due_date, due_time, meeting_id",
        )
        .order("due_date", { ascending: true })
        .returns<Task[]>(),
      supabase
        .from("people")
        .select("id, name")
        .order("name", { ascending: true })
        .returns<Person[]>(),
      supabase
        .from("organizations")
        .select("id, name")
        .order("name", { ascending: true })
        .returns<Organization[]>(),
      supabase
        .from("meetings")
        .select("id, title")
        .order("date", { ascending: false })
        .returns<Meeting[]>(),
    ]);

  const firstError =
    tasksResult.error ||
    peopleResult.error ||
    organizationsResult.error ||
    meetingsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const tasks = tasksResult.data || [];
  const people = peopleResult.data || [];
  const organizations = organizationsResult.data || [];
  const meetings = meetingsResult.data || [];
  const canManage = profile?.role !== "visualizador";

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
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Nova atividade</h2>
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
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titulo</th>
                <th className="px-4 py-3 text-left font-semibold">Responsavel</th>
                <th className="px-4 py-3 text-left font-semibold">Organizacao</th>
                <th className="px-4 py-3 text-left font-semibold">Prazo</th>
                <th className="px-4 py-3 text-left font-semibold">Horario</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Reuniao</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length ? (
                tasks.map((task) => (
                  <tr key={task.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={updateTaskAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={task.id} />
                          <input
                            name="title"
                            defaultValue={task.title}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            name="description"
                            defaultValue={task.description || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <select
                            name="owner_person_id"
                            defaultValue={task.owner_person_id}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          >
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                          <select
                            name="organization_id"
                            defaultValue={task.organization_id}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          >
                            {organizations.map((organization) => (
                              <option key={organization.id} value={organization.id}>
                                {organization.name}
                              </option>
                            ))}
                          </select>
                          <select
                            name="status"
                            defaultValue={task.status}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
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
                            defaultValue={task.due_date}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            type="time"
                            name="due_time"
                            defaultValue={task.due_time || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <select
                            name="meeting_id"
                            defaultValue={task.meeting_id || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="">Sem reuniao</option>
                            {meetings.map((meeting) => (
                              <option key={meeting.id} value={meeting.id}>
                                {meeting.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium"
                          >
                            Salvar
                          </button>
                        </form>
                      ) : (
                        task.title
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {people.find((person) => person.id === task.owner_person_id)?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {organizations.find((organization) => organization.id === task.organization_id)
                        ?.name || "-"}
                    </td>
                    <td className="px-4 py-3">{task.due_date}</td>
                    <td className="px-4 py-3">{task.due_time || "-"}</td>
                    <td className="px-4 py-3">{statusLabel(task.status)}</td>
                    <td className="px-4 py-3">
                      {task.meeting_id
                        ? meetings.find((meeting) => meeting.id === task.meeting_id)?.title || "-"
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={deleteTaskAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700"
                          >
                            Remover
                          </button>
                        </form>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={8}>
                    Nenhuma atividade cadastrada ainda.
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
