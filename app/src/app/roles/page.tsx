import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type UserRole } from "@/lib/auth/roles";
import { readCreateFeedback, type PageSearchParams } from "@/lib/ui/action-feedback";
import { CreateFeedbackBanner } from "@/components/ui/create-feedback-banner";

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

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildRolesPath(editId?: string) {
  const params = new URLSearchParams();
  if (editId) params.set("edit", editId);
  const query = params.toString();
  return query ? `/roles?${query}` : "/roles";
}

export default async function RolesPage({
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
  const editingRole =
    canManage && editingId ? roles.find((role) => role.id === editingId) || null : null;
  const closeEditPath = buildRolesPath();

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

        <CreateFeedbackBanner
          status={createFeedback.status}
          message={createFeedback.message}
        />

        {canManage ? (
          <details className="create-collapsible mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
              <span>Novo cargo</span>
              <span className="create-toggle-icon rounded-md border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +
              </span>
            </summary>
            <div className="create-collapsible-content">
              <div>
                <form action={createRoleAction} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    name="name"
                    placeholder="Nome do cargo"
                    required
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <input
                    name="responsibilities"
                    placeholder="Responsabilidades (curto)"
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
                  />
                  <select
                    name="organization_id"
                    required
                    defaultValue=""
                    className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-sm"
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
              </div>
            </div>
          </details>
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
                roles.map((role) => {
                  const openEditPath = buildRolesPath(role.id);
                  return (
                    <tr key={role.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{role.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        {organizations?.find((item) => item.id === role.organization_id)?.name || "-"}
                      </td>
                      <td className="px-4 py-3">{role.responsibilities || "-"}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                            <Link
                              href={openEditPath}
                              className="rounded-md border border-[var(--line)] p-1.5 text-xs font-medium"
                              title="Editar cargo"
                              aria-label={`Editar cargo ${role.name}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.39.242l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.242-.39l8.95-8.95zM12.172 5L5.223 11.95l-.55 1.65 1.65-.55L13.272 6.1 12.172 5z" />
                              </svg>
                            </Link>
                            <form action={deleteRoleAction}>
                              <input type="hidden" name="id" value={role.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-red-200 p-1.5 text-xs font-medium text-red-700"
                                title="Remover cargo"
                                aria-label={`Remover cargo ${role.name}`}
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
                  <td className="px-4 py-6 muted-text" colSpan={4}>
                    Nenhum cargo cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingRole ? (
          <div className="modal-overlay">
            <div className="modal-card max-w-2xl">
              <div className="modal-header">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
                    Edicao rapida
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Editar cargo</h2>
                  <p className="muted-text text-sm">{editingRole.name}</p>
                </div>
                <Link href={closeEditPath} className="modal-close">
                  Fechar
                </Link>
              </div>
              <form action={updateRoleAction} className="modal-body grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={editingRole.id} />
                <input type="hidden" name="return_path" value={closeEditPath} />
                <label className="text-xs font-medium text-[var(--muted)]">
                  Nome
                  <input
                    name="name"
                    defaultValue={editingRole.name}
                    required
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Organizacao
                  <select
                    name="organization_id"
                    defaultValue={editingRole.organization_id}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  >
                    {organizations?.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-medium text-[var(--muted)]">
                  Responsabilidades
                  <input
                    name="responsibilities"
                    defaultValue={editingRole.responsibilities || ""}
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
