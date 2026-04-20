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
  const responsibilities = readValue(formData, "responsibilities");
  const organizationId = readValue(formData, "organization_id");

  if (!name || !organizationId) {
    return NextResponse.json(
      { error: "Nome e organizacao sao obrigatorios." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("roles").insert({
    workspace_id: workspaceId,
    name,
    responsibilities: responsibilities || null,
    organization_id: organizationId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/organograma");
  revalidatePath("/roles");
  return NextResponse.json({ ok: true });
}
