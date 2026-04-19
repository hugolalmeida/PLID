"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPersonRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const personId = readValue(formData, "person_id");
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!personId || !roleId) {
    redirect("/person-roles?create=error&message=Pessoa%20e%20cargo%20sao%20obrigatorios.");
  }

  const { error } = await supabase.from("person_roles").insert({
    person_id: personId,
    role_id: roleId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) {
    redirect(`/person-roles?create=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/person-roles");
  redirect("/person-roles?create=success&message=Vinculo%20criado%20com%20sucesso.");
}

export async function updatePersonRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const personId = readValue(formData, "person_id");
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");
  const returnPath = readValue(formData, "return_path");

  if (!id || !personId || !roleId) {
    throw new Error("ID, pessoa e cargo sao obrigatorios.");
  }

  const { error } = await supabase
    .from("person_roles")
    .update({
      person_id: personId,
      role_id: roleId,
      start_date: startDate || null,
      end_date: endDate || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/person-roles");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deletePersonRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("person_roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/person-roles");

  if (returnPath) {
    redirect(returnPath);
  }
}
