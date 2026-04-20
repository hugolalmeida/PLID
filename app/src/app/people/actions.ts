"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string) {
  return readValue(formData, key) === "true";
}

export async function createPersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!name) {
    redirect("/people?create=error&message=Nome%20obrigatorio.");
  }
  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
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
    redirect(`/people?create=error&message=${encodeURIComponent(error?.message || "Erro ao criar pessoa.")}`);
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: createdPerson.id,
    action: "create",
    payload: {
      name,
      email: email || null,
      phone: phone || null,
      active,
      roleId: roleId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    },
  });

  if (roleId) {
    const { error: linkError } = await supabase.from("person_roles").insert({
      workspace_id: workspaceId,
      person_id: createdPerson.id,
      role_id: roleId,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (linkError) {
      revalidatePath("/people");
      redirect(
        `/people?create=error&message=${encodeURIComponent(
          `Pessoa criada, mas o vinculo inicial de cargo falhou: ${linkError.message}`,
        )}`,
      );
    }
  }

  revalidatePath("/people");
  redirect("/people?create=success&message=Pessoa%20criada%20com%20sucesso.");
}

export async function updatePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");
  const returnPath = readValue(formData, "return_path");

  if (!id || !name) {
    throw new Error("ID e nome sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("people")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      active,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: id,
    action: "update",
    payload: {
      name,
      email: email || null,
      phone: phone || null,
      active,
    },
  });

  revalidatePath("/people");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deletePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/people");

  if (returnPath) {
    redirect(returnPath);
  }
}
