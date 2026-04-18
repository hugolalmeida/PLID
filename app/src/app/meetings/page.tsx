import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Profile = {
  role: UserRole;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  minutes: string | null;
};

export default async function MeetingsPage() {
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

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, title, date, notes, minutes")
    .order("date", { ascending: false })
    .returns<Meeting[]>();

  if (error) {
    throw new Error(error.message);
  }

  const canManage = profile?.role !== "visualizador";

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
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Nova reuniao</h2>
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
              <button
                type="submit"
                className="md:col-span-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Criar e abrir registro
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titulo</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Notas</th>
                <th className="px-4 py-3 text-left font-semibold">Documento</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {meetings?.length ? (
                meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={updateMeetingAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={meeting.id} />
                          <input
                            name="title"
                            defaultValue={meeting.title}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            type="date"
                            name="date"
                            defaultValue={meeting.date}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            name="notes"
                            defaultValue={meeting.notes || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium"
                          >
                            Salvar
                          </button>
                        </form>
                      ) : (
                        meeting.title
                      )}
                    </td>
                    <td className="px-4 py-3">{meeting.date}</td>
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
                        <form action={deleteMeetingAction}>
                          <input type="hidden" name="id" value={meeting.id} />
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
                  <td className="px-4 py-6 muted-text" colSpan={5}>
                    Nenhuma reuniao cadastrada ainda.
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
