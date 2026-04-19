"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";

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
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!name) {
    redirect("/people?create=error&message=Nome%20obrigatorio.");
  }

  const { data: createdPerson, error } = await supabase
    .from("people")
    .insert({
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
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");
  const returnPath = readValue(formData, "return_path");

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
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("people").delete().eq("id", id);

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
