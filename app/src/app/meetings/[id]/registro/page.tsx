import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateMeetingRecordAction } from "./actions";

type Meeting = {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  minutes: string | null;
};

export default async function MeetingRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("id, title, date, notes, minutes")
    .eq("id", id)
    .maybeSingle<Meeting>();

  if (error) {
    throw new Error(error.message);
  }

  if (!meeting) {
    notFound();
  }

  const template = [
    "Pontos importantes:",
    "- ",
    "",
    "Decisoes:",
    "- ",
    "",
    "Encaminhamentos:",
    "- Responsavel: ",
    "  Prazo: ",
    "  Acao: ",
  ].join("\n");

  return (
    <main className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Registro da reuniao
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              {meeting.title}
            </h1>
            <p className="muted-text mt-2 text-sm">
              Data: {meeting.date} {meeting.notes ? `| Notas: ${meeting.notes}` : ""}
            </p>
          </div>
          <Link
            href="/meetings"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar para reunioes
          </Link>
        </div>

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-base font-semibold">Documento da reuniao</h2>
          <p className="muted-text mt-1 text-sm">
            Use este espaco para registrar o que foi falado, decisoes e proximas
            acoes.
          </p>
          <form action={updateMeetingRecordAction} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={meeting.id} />
            <textarea
              name="minutes"
              rows={18}
              defaultValue={meeting.minutes || template}
              className="w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Salvar registro
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

