import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createOrganizationAction,
  deleteOrganizationAction,
  updateOrganizationAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";

type Organization = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type Profile = {
  role: UserRole;
};

export default async function OrganizationsPage() {
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

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name, type, parent_id")
    .order("name", { ascending: true })
    .returns<Organization[]>();

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
              Modulo 1
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Organizacoes
            </h1>
            <p className="muted-text mt-2 text-sm">
              Cadastre ministerios, departamentos e presidencias para montar a
              base do organograma.
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
            <h2 className="text-base font-semibold">Nova organizacao</h2>
            <form action={createOrganizationAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                name="name"
                placeholder="Nome"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                name="type"
                placeholder="Tipo (ex: ministerio)"
                required
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <select
                name="parent_id"
                defaultValue=""
                className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">Sem organizacao pai</option>
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
                Criar organizacao
              </button>
            </form>
          </section>
        ) : (
          <p className="mt-6 text-sm text-amber-700">
            Seu perfil e visualizador. Voce pode ver a estrutura, mas nao pode
            editar.
          </p>
        )}

        <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[#f8f4ee]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nome</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Organizacao pai</th>
                <th className="px-4 py-3 text-left font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {organizations?.length ? (
                organizations.map((organization) => {
                  const parentName =
                    organizations.find((item) => item.id === organization.parent_id)
                      ?.name || "-";

                  return (
                    <tr key={organization.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        {canManage ? (
                          <form action={updateOrganizationAction} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={organization.id} />
                            <input
                              name="name"
                              defaultValue={organization.name}
                              required
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <input
                              name="type"
                              defaultValue={organization.type}
                              required
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            />
                            <select
                              name="parent_id"
                              defaultValue={organization.parent_id || ""}
                              className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                            >
                              <option value="">Sem pai</option>
                              {organizations
                                .filter((item) => item.id !== organization.id)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
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
                          organization.name
                        )}
                      </td>
                      <td className="px-4 py-3">{organization.type}</td>
                      <td className="px-4 py-3">{parentName}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <form action={deleteOrganizationAction}>
                            <input type="hidden" name="id" value={organization.id} />
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
                  <td className="px-4 py-6 muted-text" colSpan={4}>
                    Nenhuma organizacao cadastrada ainda.
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
