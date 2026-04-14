"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createOrganizationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");

  if (!name || !type) {
    throw new Error("Nome e tipo sao obrigatorios.");
  }

  const { error } = await supabase.from("organizations").insert({
    name,
    type,
    parent_id: parentId || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/organizations");
}

export async function updateOrganizationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const type = readValue(formData, "type");
  const parentId = readValue(formData, "parent_id");

  if (!id || !name || !type) {
    throw new Error("ID, nome e tipo sao obrigatorios.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      type,
      parent_id: parentId || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/organizations");
}

export async function deleteOrganizationAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("organizations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/organizations");
}
