import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

type OrganizationRecord = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type RoleRecord = {
  id: string;
  name: string;
  organization_id: string;
};

const WARD_TEMPLATE = {
  bishopric: {
    name: "Bispado",
    type: "Presidencia",
    roles: [
      {
        name: "Bispo",
        responsibilities: "Responsavel por: Moças; Primária",
      },
      {
        name: "1o Conselheiro",
        responsibilities: "Responsavel por: Sociedade de Socorro",
      },
      {
        name: "2o Conselheiro",
        responsibilities:
          "Responsavel por: Escola Dominical; Quorum de Elderes; Quoruns do Sacerdocio Aaronico",
      },
    ],
  },
  organizations: [
    {
      name: "Quorum de Elderes",
      type: "Organizacao",
      supervisor: "2o Conselheiro",
    },
    {
      name: "Sociedade de Socorro",
      type: "Organizacao",
      supervisor: "1o Conselheiro",
    },
    {
      name: "Quoruns do Sacerdocio Aaronico",
      type: "Organizacao",
      supervisor: "2o Conselheiro",
    },
    {
      name: "Mocas",
      type: "Organizacao",
      supervisor: "Bispo",
    },
    {
      name: "Escola Dominical",
      type: "Organizacao",
      supervisor: "2o Conselheiro",
    },
    {
      name: "Primaria",
      type: "Organizacao",
      supervisor: "Bispo",
    },
  ],
  organizationRoles: ["Presidente", "1o Conselheiro", "2o Conselheiro"],
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function ensureOrganization(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  workspaceId: string;
  organizationByName: Map<string, OrganizationRecord>;
  name: string;
  type: string;
  parentId: string | null;
}) {
  const key = normalizeKey(input.name);
  const existing = input.organizationByName.get(key);
  if (existing) return { organization: existing, created: false };

  const { data, error } = await input.supabase
    .from("organizations")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      type: input.type,
      parent_id: input.parentId,
    })
    .select("id, name, type, parent_id")
    .single<OrganizationRecord>();

  if (error || !data) {
    throw new Error(error?.message || `Falha ao criar ${input.name}.`);
  }

  input.organizationByName.set(key, data);
  return { organization: data, created: true };
}

async function ensureRole(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  workspaceId: string;
  roleByOrganizationAndName: Map<string, RoleRecord>;
  organizationId: string;
  name: string;
  responsibilities: string | null;
}) {
  const key = `${input.organizationId}::${normalizeKey(input.name)}`;
  const existing = input.roleByOrganizationAndName.get(key);
  if (existing) return { created: false };

  const { data, error } = await input.supabase
    .from("roles")
    .insert({
      workspace_id: input.workspaceId,
      organization_id: input.organizationId,
      name: input.name,
      responsibilities: input.responsibilities,
    })
    .select("id, name, organization_id")
    .single<RoleRecord>();

  if (error || !data) {
    throw new Error(error?.message || `Falha ao criar cargo ${input.name}.`);
  }

  input.roleByOrganizationAndName.set(key, data);
  return { created: true };
}

export async function POST() {
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

  const [organizationsResult, rolesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, type, parent_id")
      .eq("workspace_id", workspaceId)
      .returns<OrganizationRecord[]>(),
    supabase
      .from("roles")
      .select("id, name, organization_id")
      .eq("workspace_id", workspaceId)
      .returns<RoleRecord[]>(),
  ]);

  const readError = organizationsResult.error || rolesResult.error;
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  const organizationByName = new Map<string, OrganizationRecord>();
  for (const organization of organizationsResult.data || []) {
    organizationByName.set(normalizeKey(organization.name), organization);
  }

  const roleByOrganizationAndName = new Map<string, RoleRecord>();
  for (const role of rolesResult.data || []) {
    roleByOrganizationAndName.set(
      `${role.organization_id}::${normalizeKey(role.name)}`,
      role,
    );
  }

  let createdOrganizations = 0;
  let createdRoles = 0;

  try {
    const bishopricResult = await ensureOrganization({
      supabase,
      workspaceId,
      organizationByName,
      name: WARD_TEMPLATE.bishopric.name,
      type: WARD_TEMPLATE.bishopric.type,
      parentId: null,
    });
    if (bishopricResult.created) createdOrganizations += 1;

    for (const role of WARD_TEMPLATE.bishopric.roles) {
      const roleResult = await ensureRole({
        supabase,
        workspaceId,
        roleByOrganizationAndName,
        organizationId: bishopricResult.organization.id,
        name: role.name,
        responsibilities: role.responsibilities,
      });
      if (roleResult.created) createdRoles += 1;
    }

    for (const organization of WARD_TEMPLATE.organizations) {
      const organizationResult = await ensureOrganization({
        supabase,
        workspaceId,
        organizationByName,
        name: organization.name,
        type: organization.type,
        parentId: bishopricResult.organization.id,
      });
      if (organizationResult.created) createdOrganizations += 1;

      for (const roleName of WARD_TEMPLATE.organizationRoles) {
        const roleResult = await ensureRole({
          supabase,
          workspaceId,
          roleByOrganizationAndName,
          organizationId: organizationResult.organization.id,
          name: roleName,
          responsibilities: `Responsavel local em ${organization.name}. Supervisao: ${organization.supervisor}.`,
        });
        if (roleResult.created) createdRoles += 1;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao aplicar modelo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/organizations");
  revalidatePath("/roles");

  return NextResponse.json({
    ok: true,
    summary: {
      createdOrganizations,
      createdRoles,
    },
  });
}
