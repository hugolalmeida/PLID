"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    throw new Error("Nome e organizacao sao obrigatorios.");
  }

  const { error } = await supabase.from("roles").insert({
    name,
    responsibilities,
    organization_id: organizationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/roles");
}

export async function updateRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const responsibilities = readValue(formData, "responsibilities");
  const organizationId = readValue(formData, "organization_id");

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

  revalidatePath("/roles");
}

export async function deleteRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/roles");
}
