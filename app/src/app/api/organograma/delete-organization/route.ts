import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

type RoleRecord = {
  id: string;
};

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
  } | null;
  const organizationId =
    typeof payload?.organization_id === "string" ? payload.organization_id.trim() : "";

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organizacao obrigatoria." },
      { status: 400 },
    );
  }

  const [organizationResult, childrenResult, rolesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ id: string; name: string }>(),
    supabase
      .from("organizations")
      .select("id")
      .eq("parent_id", organizationId)
      .eq("workspace_id", workspaceId)
      .limit(1),
    supabase
      .from("roles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("workspace_id", workspaceId)
      .returns<RoleRecord[]>(),
  ]);

  const readError = organizationResult.error || childrenResult.error || rolesResult.error;
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  if (!organizationResult.data) {
    return NextResponse.json(
      { error: "Organizacao nao pertence ao workspace ativo." },
      { status: 400 },
    );
  }

  if ((childrenResult.data || []).length) {
    return NextResponse.json(
      {
        error:
          "Esta organizacao possui organizacoes subordinadas. Mova ou remova as subordinadas antes.",
      },
      { status: 400 },
    );
  }

  const roleIds = (rolesResult.data || []).map((role) => role.id);
  if (roleIds.length) {
    const deleteLinksResult = await supabase
      .from("person_roles")
      .delete()
      .in("role_id", roleIds)
      .eq("workspace_id", workspaceId);

    if (deleteLinksResult.error) {
      return NextResponse.json({ error: deleteLinksResult.error.message }, { status: 400 });
    }

    const deleteRolesResult = await supabase
      .from("roles")
      .delete()
      .eq("organization_id", organizationId)
      .eq("workspace_id", workspaceId);

    if (deleteRolesResult.error) {
      return NextResponse.json({ error: deleteRolesResult.error.message }, { status: 400 });
    }
  }

  const deleteOrganizationResult = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId)
    .eq("workspace_id", workspaceId);

  if (deleteOrganizationResult.error) {
    return NextResponse.json(
      { error: deleteOrganizationResult.error.message },
      { status: 400 },
    );
  }

  revalidatePath("/organograma");
  revalidatePath("/organizations");
  revalidatePath("/roles");
  revalidatePath("/people");

  return NextResponse.json({ ok: true });
}
