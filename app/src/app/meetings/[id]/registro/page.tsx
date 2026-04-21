import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMeetingTaskFromRecordAction, updateMeetingRecordAction } from "./actions";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";
import { ExportActions } from "@/components/ui/export-actions";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { canWriteWorkspaceRole, getWorkspaceRoleForUser } from "@/lib/workspaces/permissions";

type Person = {
  id: string;
  name: string;
};

type Organization = {
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

type Meeting = {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  minutes: string | null;
};

function formatDateBr(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

function extractSection(text: string, heading: string, nextHeading?: string) {
  const start = text.indexOf(heading);
  if (start < 0) return "";
  const contentStart = start + heading.length;
  const end = nextHeading ? text.indexOf(nextHeading, contentStart) : text.length;
  const raw = text.slice(contentStart, end > -1 ? end : text.length).trim();
  return raw;
}

export default async function MeetingRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: PageSearchParams;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
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

  const [meetingResult, peopleResult, organizationsResult, rolesResult, personRolesResult] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, date, notes, minutes")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle<Meeting>(),
      supabase
        .from("people")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("name", { ascending: true })
        .returns<Person[]>(),
      supabase
        .from("organizations")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<Organization[]>(),
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
    meetingResult.error ||
    peopleResult.error ||
    organizationsResult.error ||
    rolesResult.error ||
    personRolesResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const meeting = meetingResult.data;

  if (!meeting) {
    notFound();
  }

  const people = peopleResult.data || [];
  const organizations = organizationsResult.data || [];
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
  const minutes = meeting.minutes || "";
  const highlights = extractSection(minutes, "Pontos importantes:", "Decisoes:") || "- ";
  const decisions = extractSection(minutes, "Decisoes:", "Encaminhamentos:") || "- ";
  const followUps = extractSection(minutes, "Encaminhamentos:") || "- ";
  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);
  const defaultDueDate = next7.toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 md:p-10">
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
              Data: {formatDateBr(meeting.date)} {meeting.notes ? `| Notas: ${meeting.notes}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExportActions />
            <Link
              href="/meetings"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
            >
              Voltar para reunioes
            </Link>
          </div>
        </div>

        <CreateFeedbackBanner
          status={createFeedback.status}
          message={createFeedback.message}
        />

        <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-base font-semibold">Documento da reuniao</h2>
          <p className="muted-text mt-1 text-sm">
            Registre por blocos para facilitar leitura e conversao em atividades.
          </p>
          <form action={updateMeetingRecordAction} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={meeting.id} />
            <label className="block text-xs font-medium text-[var(--muted)]">
              Pontos importantes
              <textarea
                name="highlights"
                rows={5}
                defaultValue={highlights}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Decisoes
              <textarea
                name="decisions"
                rows={4}
                defaultValue={decisions}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Encaminhamentos
              <textarea
                name="follow_ups"
                rows={5}
                defaultValue={followUps}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </label>
            {canManage ? (
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Salvar registro
              </button>
            ) : null}
          </form>
        </section>

        {canManage ? (
          <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <h2 className="text-base font-semibold">Criar atividade a partir do encaminhamento</h2>
            <p className="muted-text mt-1 text-sm">
              Gera atividade vinculada automaticamente a esta reuniao.
            </p>
            <form action={createMeetingTaskFromRecordAction} className="mt-4 grid gap-3 md:grid-cols-4">
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <input
                name="title"
                placeholder="Titulo da atividade"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                name="description"
                defaultValue={followUps.startsWith("-") ? "" : followUps}
                placeholder="Descricao"
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
                    {personLabelById.get(person.id) || person.name}
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
              <input
                type="date"
                name="due_date"
                defaultValue={defaultDueDate}
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <input
                type="time"
                name="due_time"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
              >
                Criar atividade vinculada
              </button>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  );
}
