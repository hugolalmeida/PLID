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
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readValue(formData, "active") !== "false";
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!name) {
    return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 });
  }

  const { data: createdPerson, error } = await supabase
    .from("people")
    .insert({
      workspace_id: workspaceId,
      name,
      email: email || null,
      phone: phone || null,
      active,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !createdPerson) {
    return NextResponse.json(
      { error: error?.message || "Erro ao criar pessoa." },
      { status: 400 },
    );
  }

  if (roleId) {
    const { error: linkError } = await supabase.from("person_roles").insert({
      workspace_id: workspaceId,
      person_id: createdPerson.id,
      role_id: roleId,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (linkError) {
      return NextResponse.json(
        {
          error: `Pessoa criada, mas o vinculo inicial de cargo falhou: ${linkError.message}`,
        },
        { status: 400 },
      );
    }
  }

  revalidatePath("/organograma");
  revalidatePath("/people");
  return NextResponse.json({ ok: true });
}
