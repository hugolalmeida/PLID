import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

type BishopricSupervisor = "bishop" | "firstCounselor" | "secondCounselor";

type RoleRecord = {
  id: string;
  responsibilities: string | null;
};

const SUPERVISOR_LABELS: Record<BishopricSupervisor, string> = {
  bishop: "Bispo",
  firstCounselor: "1o Conselheiro",
  secondCounselor: "2o Conselheiro",
};
const SUPERVISOR_VALUES = Object.keys(SUPERVISOR_LABELS) as BishopricSupervisor[];

function isBishopricSupervisor(value: string): value is BishopricSupervisor {
  return SUPERVISOR_VALUES.includes(value as BishopricSupervisor);
}

function withSupervisorResponsibility(
  responsibilities: string | null,
  supervisor: BishopricSupervisor,
) {
  const label = SUPERVISOR_LABELS[supervisor];
  const cleaned = (responsibilities || "")
    .replace(
      /\s*Supervisao:\s*(Bispo|1o Conselheiro|2o Conselheiro|Primeiro Conselheiro|Segundo Conselheiro)\.?\s*/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+[.;]$/g, "")
    .trim();

  if (!cleaned) return `Supervisao: ${label}.`;
  return `${cleaned.replace(/[.;]\s*$/g, "")}. Supervisao: ${label}.`;
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
  const supervisor =
    typeof payload?.supervisor === "string" ? payload.supervisor.trim() : "";

  if (!organizationId || !isBishopricSupervisor(supervisor)) {
    return NextResponse.json(
      { error: "Organizacao e supervisao sao obrigatorias." },
      { status: 400 },
    );
  }

  const organizationResult = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ id: string; name: string }>();

  if (organizationResult.error) {
    return NextResponse.json({ error: organizationResult.error.message }, { status: 400 });
  }

  if (!organizationResult.data) {
    return NextResponse.json(
      { error: "Organizacao nao pertence ao workspace ativo." },
      { status: 400 },
    );
  }

  if (organizationResult.data.name.trim().toLowerCase() === "bispado") {
    return NextResponse.json(
      { error: "O Bispado nao precisa de supervisao externa." },
      { status: 400 },
    );
  }

  const rolesResult = await supabase
    .from("roles")
    .select("id, responsibilities")
    .eq("organization_id", organizationId)
    .eq("workspace_id", workspaceId)
    .returns<RoleRecord[]>();

  if (rolesResult.error) {
    return NextResponse.json({ error: rolesResult.error.message }, { status: 400 });
  }

  const roles = rolesResult.data || [];
  if (!roles.length) {
    return NextResponse.json(
      { error: "Crie ao menos um cargo nesta organizacao antes de trocar a supervisao." },
      { status: 400 },
    );
  }

  for (const role of roles) {
    const updateResult = await supabase
      .from("roles")
      .update({
        responsibilities: withSupervisorResponsibility(
          role.responsibilities,
          supervisor,
        ),
      })
      .eq("id", role.id)
      .eq("workspace_id", workspaceId);

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
    }
  }

  revalidatePath("/organograma");
  revalidatePath("/roles");

  return NextResponse.json({ ok: true });
}
