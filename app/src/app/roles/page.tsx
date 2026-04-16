import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Organization = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  responsibilities: string | null;
  organization_id: string;
};

type Profile = {
  role: UserRole;
};

export default async function RolesPage() {
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

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Organization[]>();

  if (organizationsError) {
    throw new Error(organizationsError.message);
  }

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, name, responsibilities, organization_id")
    .order("name", { ascending: true })
    .returns<Role[]>();

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const canManage = profile?.role !== "visualizador";

  return (
    <main className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 2
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Cargos</h1>
            <p className="muted-text mt-2 text-sm">
              Defina cargos por organizacao e mantenha responsabilidades claras.
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
            <h2 className="text-base font-semibold">Novo cargo</h2>
            <form action={createRoleAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                name="name"
                placeholder="Nome do cargo"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                name="responsibilities"
                placeholder="Responsabilidades (curto)"
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <select
                name="organization_id"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="" disabled>
                  Selecione a organizacao
                </option>
                {organizations?.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="md:col-span-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
              >
                Criar cargo
              </button>
            </form>
          </section>
        ) : null}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                <th className="px-4 py-3 text-left font-semibold">Organizacao</th>
                <th className="px-4 py-3 text-left font-semibold">Responsabilidades</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {roles?.length ? (
                roles.map((role) => (
                  <tr key={role.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={updateRoleAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={role.id} />
                          <input
                            name="name"
                            defaultValue={role.name}
                            required
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <input
                            name="responsibilities"
                            defaultValue={role.responsibilities || ""}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          />
                          <select
                            name="organization_id"
                            defaultValue={role.organization_id}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                          >
                            {organizations?.map((organization) => (
                              <option key={organization.id} value={organization.id}>
                                {organization.name}
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
                        role.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {organizations?.find((item) => item.id === role.organization_id)?.name ||
                        "-"}
                    </td>
                    <td className="px-4 py-3">{role.responsibilities || "-"}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <form action={deleteRoleAction}>
                          <input type="hidden" name="id" value={role.id} />
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
                  <td className="px-4 py-6 muted-text" colSpan={4}>
                    Nenhum cargo cadastrado ainda.
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
