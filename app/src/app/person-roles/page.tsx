import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createPersonRoleAction,
  deletePersonRoleAction,
  updatePersonRoleAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Person = {
  id: string;
  name: string;
  active: boolean;
};

type Role = {
  id: string;
  name: string;
};

type PersonRole = {
  id: string;
  person_id: string;
  role_id: string;
  start_date: string | null;
  end_date: string | null;
};

type Profile = {
  role: UserRole;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return value;
}

export default async function PersonRolesPage() {
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

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("id, name, active")
    .order("name", { ascending: true })
    .returns<Person[]>();

  if (peopleError) {
    throw new Error(peopleError.message);
  }

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Role[]>();

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const { data: personRoles, error: personRolesError } = await supabase
    .from("person_roles")
    .select("id, person_id, role_id, start_date, end_date")
    .order("created_at", { ascending: false })
    .returns<PersonRole[]>();

  if (personRolesError) {
    throw new Error(personRolesError.message);
  }

  const canManage = profile?.role !== "visualizador";
  const activePeople = people?.filter((person) => person.active) || [];

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 4
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Vinculos Pessoa x Cargo
            </h1>
            <p className="muted-text mt-2 text-sm">
              Defina quem ocupa cada cargo e o periodo de atuacao.
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
            <h2 className="text-base font-semibold">Novo vinculo</h2>
            <form
              action={createPersonRoleAction}
              className="mt-4 grid gap-3 md:grid-cols-4"
            >
              <select
                name="person_id"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="" disabled>
                  Selecione a pessoa
                </option>
                {activePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <select
                name="role_id"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="" disabled>
                  Selecione o cargo
                </option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <input
                name="start_date"
                type="date"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                name="end_date"
                type="date"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                type="submit"
                className="md:col-span-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Criar vinculo
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Pessoa</th>
                <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                <th className="px-4 py-3 text-left font-semibold">Inicio</th>
                <th className="px-4 py-3 text-left font-semibold">Fim</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {personRoles?.length ? (
                personRoles.map((personRole) => {
                  const personName =
                    people?.find((item) => item.id === personRole.person_id)?.name ||
                    "-";
                  const roleName =
                    roles?.find((item) => item.id === personRole.role_id)?.name || "-";

                  return (
                    <tr
                      key={personRole.id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        {canManage ? (
                          <form
                            action={updatePersonRoleAction}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="id" value={personRole.id} />
                            <select
                              name="person_id"
                              defaultValue={personRole.person_id}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              {activePeople.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                            <select
                              name="role_id"
                              defaultValue={personRole.role_id}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              {roles?.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <input
                              name="start_date"
                              type="date"
                              defaultValue={personRole.start_date || ""}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              name="end_date"
                              type="date"
                              defaultValue={personRole.end_date || ""}
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
                          personName
                        )}
                      </td>
                      <td className="px-4 py-3">{roleName}</td>
                      <td className="px-4 py-3">{formatDate(personRole.start_date)}</td>
                      <td className="px-4 py-3">{formatDate(personRole.end_date)}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <form action={deletePersonRoleAction}>
                            <input type="hidden" name="id" value={personRole.id} />
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
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 muted-text" colSpan={5}>
                    Nenhum vinculo cadastrado ainda.
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
