import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createPersonAction,
  deletePersonAction,
  updatePersonAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";

type Person = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};

type Profile = {
  role: UserRole;
};

type Role = {
  id: string;
  name: string;
};

type PersonRole = {
  person_id: string;
  role_id: string;
  start_date: string | null;
  end_date: string | null;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildPeoplePath(editId?: string) {
  const params = new URLSearchParams();
  if (editId) params.set("edit", editId);
  const query = params.toString();
  return query ? `/people?${query}` : "/people";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const createFeedback = readCreateFeedback(resolvedSearchParams);
  const editingId = firstValue(resolvedSearchParams.edit);
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

  const [peopleResult, rolesResult, personRolesResult] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, email, phone, active")
      .order("name", { ascending: true })
      .returns<Person[]>(),
    supabase
      .from("roles")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<Role[]>(),
    supabase
      .from("person_roles")
      .select("person_id, role_id, start_date, end_date")
      .returns<PersonRole[]>(),
  ]);

  const firstError = peopleResult.error || rolesResult.error || personRolesResult.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const people = peopleResult.data || [];
  const roles = rolesResult.data || [];
  const personRoles = personRolesResult.data || [];
  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentRoleByPerson = new Map<string, string>();

  people.forEach((person) => {
    const activeLinks = personRoles
      .filter((link) => {
        if (link.person_id !== person.id) return false;
        const startsOk = !link.start_date || link.start_date <= todayIso;
        const endsOk = !link.end_date || link.end_date >= todayIso;
        return startsOk && endsOk;
      })
      .sort((a, b) => {
        const aStart = a.start_date || "0000-01-01";
        const bStart = b.start_date || "0000-01-01";
        return bStart.localeCompare(aStart);
      });

    const current = activeLinks[0];
    currentRoleByPerson.set(person.id, current ? roleNameById.get(current.role_id) || "-" : "-");
  });

  const canManage = profile?.role !== "visualizador";
  const editingPerson =
    canManage && editingId ? people.find((person) => person.id === editingId) || null : null;
  const closeEditPath = buildPeoplePath();

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 3
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Pessoas</h1>
            <p className="muted-text mt-2 text-sm">
              Cadastro de lideres e membros com contato e status de atividade.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <CreateFeedbackBanner
          status={createFeedback.status}
          message={createFeedback.message}
        />

        {canManage ? (
          <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
              <span>Nova pessoa</span>
              <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +
              </span>
            </summary>
            <div className="create-collapsible-content">
              <div>
                <form action={createPersonAction} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    name="name"
                    placeholder="Nome completo"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="email"
                    placeholder="E-mail"
                    type="email"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="phone"
                    placeholder="Telefone"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <select
                    name="active"
                    defaultValue="true"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                  <select
                    name="role_id"
                    defaultValue=""
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  >
                    <option value="">Sem cargo inicial</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="start_date"
                    type="date"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="end_date"
                    type="date"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="md:col-span-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
                  >
                    Criar pessoa
                  </button>
                </form>
              </div>
            </div>
          </details>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nome</th>
                <th className="px-4 py-3 text-left font-semibold">Cargo atual</th>
                <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                <th className="px-4 py-3 text-left font-semibold">Telefone</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {people?.length ? (
                people.map((person) => {
                  const openEditPath = buildPeoplePath(person.id);
                  return (
                    <tr key={person.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{person.name}</p>
                      </td>
                      <td className="px-4 py-3">{currentRoleByPerson.get(person.id) || "-"}</td>
                      <td className="px-4 py-3">{person.email || "-"}</td>
                      <td className="px-4 py-3">{person.phone || "-"}</td>
                      <td className="px-4 py-3">{person.active ? "Ativo" : "Inativo"}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                            <Link
                              href={openEditPath}
                              className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                              title="Editar pessoa"
                              aria-label={`Editar pessoa ${person.name}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.39.242l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.242-.39l8.95-8.95zM12.172 5L5.223 11.95l-.55 1.65 1.65-.55L13.272 6.1 12.172 5z" />
                              </svg>
                            </Link>
                            <form action={deletePersonAction}>
                              <input type="hidden" name="id" value={person.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-red-200 p-1.5 text-xs font-medium text-red-700"
                                title="Remover pessoa"
                                aria-label={`Remover pessoa ${person.name}`}
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
                    Nenhuma pessoa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingPerson ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-2xl">
              <div className="modal-header">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                    Edicao rapida
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Editar pessoa</h2>
                  <p className="muted-text text-sm">{editingPerson.name}</p>
                </div>
                <Link href={closeEditPath} className="modal-close">
                  Fechar
                </Link>
              </div>
              <form action={updatePersonAction} className="modal-body grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={editingPerson.id} />
                <input type="hidden" name="return_path" value={closeEditPath} />
                <label className="text-xs font-medium text-[var(--muted)]">
                  Nome
                  <input
                    name="name"
                    defaultValue={editingPerson.name}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Status
                  <select
                    name="active"
                    defaultValue={editingPerson.active ? "true" : "false"}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  E-mail
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingPerson.email || ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Telefone
                  <input
                    name="phone"
                    defaultValue={editingPerson.phone || ""}
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
