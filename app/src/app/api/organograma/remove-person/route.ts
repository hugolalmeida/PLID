import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

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

  const body = (await request.json().catch(() => null)) as
    | { person_role_id?: string }
    | null;
  const personRoleId = String(body?.person_role_id || "").trim();

  if (!personRoleId) {
    return NextResponse.json({ error: "Vinculo obrigatorio." }, { status: 400 });
  }

  const deleteResult = await supabase
    .from("person_roles")
    .delete()
    .eq("id", personRoleId)
    .eq("workspace_id", workspaceId);

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/people");
  revalidatePath("/roles");

  return NextResponse.json({ ok: true });
}
