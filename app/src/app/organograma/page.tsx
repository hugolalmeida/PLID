import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrganogramaClient } from "./organograma-client";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { canWriteWorkspaceRole, getWorkspaceRoleForUser } from "@/lib/workspaces/permissions";
import type {
  OrganizationRow,
  PersonRoleRow,
  PersonRow,
  RoleRow,
} from "./types";

export default async function OrganogramaPage() {
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

  const [organizationsResult, rolesResult, personRolesResult, peopleResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, type, parent_id")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<OrganizationRow[]>(),
      supabase
        .from("roles")
        .select("id, organization_id, name, responsibilities")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<RoleRow[]>(),
      supabase
        .from("person_roles")
        .select("id, person_id, role_id, start_date, end_date")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .returns<PersonRoleRow[]>(),
      supabase
        .from("people")
        .select("id, name, email, phone, active")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .returns<PersonRow[]>(),
    ]);

  const firstError =
    organizationsResult.error ||
    rolesResult.error ||
    personRolesResult.error ||
    peopleResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              Modulo 5
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Organograma Interativo
            </h1>
            <p className="muted-text mt-2 text-sm">
              Visualizacao da estrutura com organizacoes, cargos e vinculos.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <OrganogramaClient
          organizations={organizationsResult.data || []}
          roles={rolesResult.data || []}
          personRoles={personRolesResult.data || []}
          people={peopleResult.data || []}
          canManage={canWriteWorkspaceRole(workspaceRole)}
        />
      </section>
    </main>
  );
}
