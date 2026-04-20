import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { workspace_id?: string }
    | null;
  const workspaceId = String(body?.workspace_id || "").trim();

  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: "workspace_id_invalido" }, { status: 400 });
  }

  const membershipCheck = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ workspace_id: string }>();

  if (membershipCheck.error || !membershipCheck.data) {
    return NextResponse.json(
      {
        ok: false,
        error: membershipCheck.error?.message || "usuario_nao_pertence_ao_workspace",
      },
      { status: 403 },
    );
  }

  const updateResult = await supabase
    .from("profiles")
    .update({ current_workspace_id: workspaceId })
    .eq("id", user.id);

  if (updateResult.error) {
    return NextResponse.json({ ok: false, error: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

