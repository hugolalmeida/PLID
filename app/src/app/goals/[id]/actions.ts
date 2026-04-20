"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

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

export async function createGoalUpdateAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const goalId = readValue(formData, "goal_id");
  const updateNote = readValue(formData, "update_note");
  const currentValue = readNumber(formData, "current_value");

  if (!goalId || !updateNote) {
    throw new Error("Meta e observacao sao obrigatorias.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);

  const { error: insertError } = await supabase.from("goal_updates").insert({
    goal_id: goalId,
    workspace_id: workspaceId,
    update_note: updateNote,
    current_value: currentValue,
    created_by: user.id,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: goalError } = await supabase
    .from("goals")
    .update({
      current_value: currentValue,
    })
    .eq("id", goalId)
    .eq("workspace_id", workspaceId);

  if (goalError) {
    throw new Error(goalError.message);
  }

  await logAuditEvent(supabase, {
    entityType: "goal",
    entityId: goalId,
    action: "update",
    payload: {
      source: "goal_updates",
      updateNote,
      currentValue,
    },
  });

  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
}
