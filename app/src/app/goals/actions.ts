"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEditableGoalStatus, type GoalStoredStatus } from "@/lib/goals/effective-status";
import { logAuditEvent } from "@/lib/audit/log-event";

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
  let targetValue = 0;
  let currentValue = 0;
  try {
    targetValue = readNumber(formData, "target_value");
    currentValue = readNumber(formData, "current_value");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Valor numerico invalido para a meta.";
    redirect(`/goals?create=error&message=${encodeURIComponent(message)}`);
  }
  const statusRaw = readValue(formData, "status") as GoalStoredStatus;
  const status = getEditableGoalStatus(statusRaw);

  if (
    !title ||
    !organizationId ||
    !ownerPersonId ||
    !periodStart ||
    !periodEnd ||
    !status
  ) {
    redirect("/goals?create=error&message=Preencha%20todos%20os%20campos%20obrigatorios%20da%20meta.");
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
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
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(`/goals?create=error&message=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, {
    entityType: "goal",
    entityId: data.id,
    action: "create",
    payload: {
      title,
      organizationId,
      ownerPersonId,
      periodStart,
      periodEnd,
      targetValue,
      currentValue,
      status,
    },
  });

  revalidatePath("/goals");
  redirect("/goals?create=success&message=Meta%20criada%20com%20sucesso.");
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
  const statusRaw = readValue(formData, "status") as GoalStoredStatus;
  const status = getEditableGoalStatus(statusRaw);
  const returnPath = readValue(formData, "return_path");

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }

  const { data: previousGoal, error: previousGoalError } = await supabase
    .from("goals")
    .select(
      "title, description, organization_id, owner_person_id, period_start, period_end, target_value, current_value, status",
    )
    .eq("id", id)
    .maybeSingle<{
      title: string;
      description: string | null;
      organization_id: string;
      owner_person_id: string;
      period_start: string;
      period_end: string;
      target_value: number;
      current_value: number;
      status: GoalStoredStatus;
    }>();

  if (previousGoalError) {
    throw new Error(previousGoalError.message);
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

  await logAuditEvent(supabase, {
    entityType: "goal",
    entityId: id,
    action: "update",
    payload: {
      title,
      organizationId,
      ownerPersonId,
      periodStart,
      periodEnd,
      targetValue,
      currentValue,
      status,
    },
  });

  if (previousGoal) {
    const changedFields: string[] = [];
    if (previousGoal.title !== title) changedFields.push("titulo");
    if ((previousGoal.description || "") !== (description || "")) changedFields.push("descricao");
    if (previousGoal.organization_id !== organizationId) changedFields.push("organizacao");
    if (previousGoal.owner_person_id !== ownerPersonId) changedFields.push("responsavel");
    if (previousGoal.period_start !== periodStart) changedFields.push("inicio");
    if (previousGoal.period_end !== periodEnd) changedFields.push("fim");
    if (Number(previousGoal.target_value) !== Number(targetValue)) changedFields.push("valor alvo");
    if (Number(previousGoal.current_value) !== Number(currentValue)) changedFields.push("valor atual");
    if (previousGoal.status !== statusRaw) changedFields.push("status");

    if (changedFields.length) {
      const { error: historyError } = await supabase.from("goal_updates").insert({
        goal_id: id,
        update_note: `Meta editada via tela de metas (${changedFields.join(", ")}).`,
        current_value: currentValue,
        created_by: user.id,
      });

      if (historyError) {
        throw new Error(historyError.message);
      }
    }
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deleteGoalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("goals").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "goal",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/goals");

  if (returnPath) {
    redirect(returnPath);
  }
}
