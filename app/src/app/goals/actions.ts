"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string) {
  const raw = readValue(formData, key);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numerico invalido em ${key}.`);
  }
  return parsed;
}

export async function createGoalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const organizationId = readValue(formData, "organization_id");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const periodStart = readValue(formData, "period_start");
  const periodEnd = readValue(formData, "period_end");
  const targetValue = readNumber(formData, "target_value");
  const currentValue = readNumber(formData, "current_value");
  const status = readValue(formData, "status");

  if (
    !title ||
    !organizationId ||
    !ownerPersonId ||
    !periodStart ||
    !periodEnd ||
    !status
  ) {
    throw new Error("Preencha todos os campos obrigatorios da meta.");
  }

  const { error } = await supabase.from("goals").insert({
    title,
    description: description || null,
    organization_id: organizationId,
    owner_person_id: ownerPersonId,
    period_start: periodStart,
    period_end: periodEnd,
    target_value: targetValue,
    current_value: currentValue,
    status,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/goals");
}

export async function updateGoalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const organizationId = readValue(formData, "organization_id");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const periodStart = readValue(formData, "period_start");
  const periodEnd = readValue(formData, "period_end");
  const targetValue = readNumber(formData, "target_value");
  const currentValue = readNumber(formData, "current_value");
  const status = readValue(formData, "status");

  if (
    !id ||
    !title ||
    !organizationId ||
    !ownerPersonId ||
    !periodStart ||
    !periodEnd ||
    !status
  ) {
    throw new Error("Preencha todos os campos obrigatorios da meta.");
  }

  const { error } = await supabase
    .from("goals")
    .update({
      title,
      description: description || null,
      organization_id: organizationId,
      owner_person_id: ownerPersonId,
      period_start: periodStart,
      period_end: periodEnd,
      target_value: targetValue,
      current_value: currentValue,
      status,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
}

export async function deleteGoalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("goals").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/goals");
}

