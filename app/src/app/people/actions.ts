"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string) {
  return readValue(formData, key) === "true";
}

export async function createPersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");

  if (!name) {
    throw new Error("Nome obrigatorio.");
  }

  const { error } = await supabase.from("people").insert({
    name,
    email: email || null,
    phone: phone || null,
    active,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/people");
}

export async function updatePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");

  if (!id || !name) {
    throw new Error("ID e nome sao obrigatorios.");
  }

  const { error } = await supabase
    .from("people")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/people");
}

export async function deletePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("people").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/people");
}
