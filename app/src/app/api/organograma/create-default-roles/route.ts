import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

type BishopricSupervisor = "bishop" | "firstCounselor" | "secondCounselor";

type OrganizationRecord = {
  id: string;
  name: string;
};

type RoleRecord = {
  id: string;
  name: string;
  organization_id: string;
  responsibilities: string | null;
};

const SUPERVISOR_LABELS: Record<BishopricSupervisor, string> = {
  bishop: "Bispo",
  firstCounselor: "1o Conselheiro",
  secondCounselor: "2o Conselheiro",
};
const SUPERVISOR_VALUES = Object.keys(SUPERVISOR_LABELS) as BishopricSupervisor[];

const ORGANIZATION_ROLE_NAMES = ["Presidente", "1o Conselheiro", "2o Conselheiro"];
const BISHOPRIC_ROLE_NAMES = ["Bispo", "1o Conselheiro", "2o Conselheiro"];

const DEFAULT_SUPERVISOR_BY_ORGANIZATION = new Map<string, BishopricSupervisor>([
  ["mocas", "bishop"],
  ["primaria", "bishop"],
  ["sociedade de socorro", "firstCounselor"],
  ["escola dominical", "secondCounselor"],
  ["quorum de elderes", "secondCounselor"],
  ["quoruns do sacerdocio aaronico", "secondCounselor"],
]);

function isBishopricSupervisor(value: string): value is BishopricSupervisor {
  return SUPERVISOR_VALUES.includes(value as BishopricSupervisor);
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBispado(name: string) {
  return normalizeKey(name) === "bispado";
}

function roleMatchesDefault(roleName: string, defaultRoleName: string) {
  const role = normalizeKey(roleName);
  const expected = normalizeKey(defaultRoleName);

  if (expected === "bispo") return role === "bispo";
  if (expected === "presidente") return role.includes("presidente");
  if (expected === "1o conselheiro") {
    return /\b(1|1o|primeiro|primeira)\b/.test(role) && role.includes("conselheiro");
  }
  if (expected === "2o conselheiro") {
    return /\b(2|2o|segundo|segunda)\b/.test(role) && role.includes("conselheiro");
  }

  return role === expected;
}

function supervisorFromResponsibilities(value: string | null) {
  if (!value) return null;

  const normalized = normalizeKey(value);
  const supervisionIndex = normalized.lastIndexOf("supervisao");
  if (supervisionIndex < 0) return null;

  const supervisionText = normalized.slice(supervisionIndex);
  if (supervisionText.includes("bispo")) return "bishop";
  if (
    /\b(1|1o|primeiro|primeira)\b/.test(supervisionText) &&
    supervisionText.includes("conselheiro")
  ) {
    return "firstCounselor";
  }
  if (
    /\b(2|2o|segundo|segunda)\b/.test(supervisionText) &&
    supervisionText.includes("conselheiro")
  ) {
    return "secondCounselor";
  }

  return null;
}

function inferSupervisor(
  organization: OrganizationRecord,
  roles: RoleRecord[],
  requestedSupervisor: BishopricSupervisor | null,
) {
  if (requestedSupervisor) return requestedSupervisor;

  for (const role of roles) {
    const supervisor = supervisorFromResponsibilities(role.responsibilities);
    if (supervisor) return supervisor;
  }

  return DEFAULT_SUPERVISOR_BY_ORGANIZATION.get(normalizeKey(organization.name)) || "bishop";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace ativo nao encontrado." },
      { status: 400 },
    );
  }

  const workspaceRole = await getWorkspaceRoleForUser(supabase, user.id, workspaceId);
  if (!canWriteWorkspaceRole(workspaceRole)) {
    return NextResponse.json(
      { error: "Voce nao tem permissao para alterar este organograma." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    organization_id?: unknown;
    supervisor?: unknown;
  } | null;

  const organizationId =
    typeof payload?.organization_id === "string" ? payload.organization_id.trim() : "";
  const supervisorValue =
    typeof payload?.supervisor === "string" ? payload.supervisor.trim() : "";
  const requestedSupervisor = isBishopricSupervisor(supervisorValue)
    ? supervisorValue
    : null;

  let organizationsQuery = supabase
    .from("organizations")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  if (organizationId) {
    organizationsQuery = organizationsQuery.eq("id", organizationId);
  }

  const [organizationsResult, rolesResult] = await Promise.all([
    organizationsQuery.returns<OrganizationRecord[]>(),
    supabase
      .from("roles")
      .select("id, name, organization_id, responsibilities")
      .eq("workspace_id", workspaceId)
      .returns<RoleRecord[]>(),
  ]);

  const readError = organizationsResult.error || rolesResult.error;
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  const organizations = organizationsResult.data || [];
  if (organizationId && !organizations.length) {
    return NextResponse.json(
      { error: "Organizacao nao pertence ao workspace ativo." },
      { status: 400 },
    );
  }

  const rolesByOrganization = new Map<string, RoleRecord[]>();
  for (const role of rolesResult.data || []) {
    const current = rolesByOrganization.get(role.organization_id) || [];
    current.push(role);
    rolesByOrganization.set(role.organization_id, current);
  }

  let createdRoles = 0;

  for (const organization of organizations) {
    const existingRoles = rolesByOrganization.get(organization.id) || [];
    const defaultRoleNames = isBispado(organization.name)
      ? BISHOPRIC_ROLE_NAMES
      : ORGANIZATION_ROLE_NAMES;
    const supervisor = inferSupervisor(organization, existingRoles, requestedSupervisor);

    for (const roleName of defaultRoleNames) {
      const exists = existingRoles.some((role) => roleMatchesDefault(role.name, roleName));
      if (exists) continue;

      const responsibilities = isBispado(organization.name)
        ? null
        : `Responsavel local em ${organization.name}. Supervisao: ${SUPERVISOR_LABELS[supervisor]}.`;

      const insertResult = await supabase.from("roles").insert({
        workspace_id: workspaceId,
        organization_id: organization.id,
        name: roleName,
        responsibilities,
      });

      if (insertResult.error) {
        return NextResponse.json({ error: insertResult.error.message }, { status: 400 });
      }

      existingRoles.push({
        id: "",
        name: roleName,
        organization_id: organization.id,
        responsibilities,
      });
      createdRoles += 1;
    }
  }

  revalidatePath("/organograma");
  revalidatePath("/roles");

  return NextResponse.json({
    ok: true,
    summary: { createdRoles },
  });
}
