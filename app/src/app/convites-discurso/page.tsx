import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { ConviteDiscursoClient } from "./convite-discurso-client";

type WorkspaceRow = {
  id: string;
  name: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type RoleRow = {
  id: string;
  organization_id: string;
  name: string;
};

type PersonRoleRow = {
  id: string;
  person_id: string;
  role_id: string;
};

type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .toLowerCase();
}

function identifyBishopricRole(roleName: string) {
  const normalized = normalizeForSearch(roleName);

  if (/\b(1|1o|1a|primeiro|primeira)\b/.test(normalized) && normalized.includes("conselheiro")) {
    return "firstCounselor";
  }
  if (/\b(2|2o|2a|segundo|segunda)\b/.test(normalized) && normalized.includes("conselheiro")) {
    return "secondCounselor";
  }
  if (/\bbispo\b/.test(normalized)) {
    return "bishop";
  }

  return null;
}

export default async function ConvitesDiscursoPage() {
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

  const [
    workspaceResult,
    organizationsResult,
    rolesResult,
    personRolesResult,
    peopleResult,
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .maybeSingle<WorkspaceRow>(),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .returns<OrganizationRow[]>(),
    supabase
      .from("roles")
      .select("id, organization_id, name")
      .eq("workspace_id", workspaceId)
      .returns<RoleRow[]>(),
    supabase
      .from("person_roles")
      .select("id, person_id, role_id")
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
    workspaceResult.error ||
    organizationsResult.error ||
    rolesResult.error ||
    personRolesResult.error ||
    peopleResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const people = peopleResult.data || [];
  const personById = new Map(people.map((person) => [person.id, person]));
  const personRolesByRole = new Map<string, PersonRoleRow[]>();
  for (const personRole of personRolesResult.data || []) {
    const current = personRolesByRole.get(personRole.role_id) || [];
    current.push(personRole);
    personRolesByRole.set(personRole.role_id, current);
  }

  const bishopricOrganization = (organizationsResult.data || []).find(
    (organization) => normalizeForSearch(organization.name) === "bispado",
  );
  const bishopricRoles = bishopricOrganization
    ? (rolesResult.data || []).filter((role) => role.organization_id === bishopricOrganization.id)
    : [];

  const bishopric = {
    bishop: "",
    firstCounselor: "",
    secondCounselor: "",
  };

  for (const role of bishopricRoles) {
    const slot = identifyBishopricRole(role.name);
    if (!slot) continue;
    const link = (personRolesByRole.get(role.id) || [])[0];
    const person = link ? personById.get(link.person_id) : null;
    if (person) {
      bishopric[slot] = person.name;
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-10">
      <ConviteDiscursoClient
        workspaceName={workspaceResult.data?.name || "Ala"}
        people={people}
        bishopric={bishopric}
      />
    </main>
  );
}
