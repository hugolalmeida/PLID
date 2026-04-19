"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const name = readValue(formData, "name");
  const responsibilities = readValue(formData, "responsibilities");
  const organizationId = readValue(formData, "organization_id");

  if (!name || !organizationId) {
    redirect("/roles?create=error&message=Nome%20e%20organizacao%20sao%20obrigatorios.");
  }

  const { data, error } = await supabase
    .from("roles")
    .insert({
      name,
      responsibilities,
      organization_id: organizationId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(`/roles?create=error&message=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, {
    entityType: "role",
    entityId: data.id,
    action: "create",
    payload: {
      name,
      responsibilities: responsibilities || null,
      organizationId,
    },
  });

  revalidatePath("/roles");
  redirect("/roles?create=success&message=Cargo%20criado%20com%20sucesso.");
}

export async function updateRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const responsibilities = readValue(formData, "responsibilities");
  const organizationId = readValue(formData, "organization_id");
  const returnPath = readValue(formData, "return_path");

  if (!id || !name || !organizationId) {
    throw new Error("ID, nome e organizacao sao obrigatorios.");
  }

  const { error } = await supabase
    .from("roles")
    .update({
      name,
      responsibilities,
      organization_id: organizationId,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "role",
    entityId: id,
    action: "update",
    payload: {
      name,
      responsibilities: responsibilities || null,
      organizationId,
    },
  });

  revalidatePath("/roles");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deleteRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "role",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/roles");

  if (returnPath) {
    redirect(returnPath);
  }
}
