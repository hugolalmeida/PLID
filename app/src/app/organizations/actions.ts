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

export async function createOrganizationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");

  if (!name || !type) {
    redirect("/organizations?create=error&message=Nome%20e%20tipo%20sao%20obrigatorios.");
  }
  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      workspace_id: workspaceId,
      name,
      type,
      parent_id: parentId || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(
      `/organizations?create=error&message=${encodeURIComponent(error.message)}`,
    );
  }

  await logAuditEvent(supabase, {
    entityType: "organization",
    entityId: data.id,
    action: "create",
    payload: { name, type, parentId: parentId || null },
  });

  revalidatePath("/organizations");
  redirect("/organizations?create=success&message=Organizacao%20criada%20com%20sucesso.");
}

export async function updateOrganizationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");
  const returnPath = readValue(formData, "return_path");

  if (!id || !name || !type) {
    throw new Error("ID, nome e tipo sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      type,
      parent_id: parentId || null,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "organization",
    entityId: id,
    action: "update",
    payload: { name, type, parentId: parentId || null },
  });

  revalidatePath("/organizations");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deleteOrganizationAction(formData: FormData) {
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
    .from("organizations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "organization",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/organizations");

  if (returnPath) {
    redirect(returnPath);
  }
}
