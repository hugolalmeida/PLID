import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

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

  const formData = await request.formData();
  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");

  if (!name || !type) {
    return NextResponse.json(
      { error: "Nome e tipo sao obrigatorios." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("organizations").insert({
    workspace_id: workspaceId,
    name,
    type,
    parent_id: parentId || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/organizations");
  return NextResponse.json({ ok: true });
}
