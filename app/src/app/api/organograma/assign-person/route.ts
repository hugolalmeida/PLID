import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  canWriteWorkspaceRole,
  getWorkspaceRoleForUser,
} from "@/lib/workspaces/permissions";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  const formData = await request.formData();
  const roleId = readValue(formData, "role_id");
  const personId = readValue(formData, "person_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!roleId || !personId) {
    return NextResponse.json(
      { error: "Cargo e pessoa sao obrigatorios." },
      { status: 400 },
    );
  }

  const [roleResult, personResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ id: string }>(),
  ]);

  const readError = roleResult.error || personResult.error;
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  if (!roleResult.data || !personResult.data) {
    return NextResponse.json(
      { error: "Cargo ou pessoa nao pertence ao workspace ativo." },
      { status: 400 },
    );
  }

  const clearResult = await supabase
    .from("person_roles")
    .delete()
    .eq("role_id", roleId)
    .eq("workspace_id", workspaceId);

  if (clearResult.error) {
    return NextResponse.json({ error: clearResult.error.message }, { status: 400 });
  }

  const insertResult = await supabase.from("person_roles").insert({
    workspace_id: workspaceId,
    person_id: personId,
    role_id: roleId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/people");
  revalidatePath("/roles");

  return NextResponse.json({ ok: true });
}
