"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEditableGoalStatus, type GoalStoredStatus } from "@/lib/goals/effective-status";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildDashboardRedirectPath(
  formData: FormData,
  updatedType: "task" | "goal" | "meeting",
  updatedId: string,
) {
  const rangeDays = readValue(formData, "range_days");
  const organizationId = readValue(formData, "organization_id");

  const params = new URLSearchParams();
  params.set("updated", updatedType);
  params.set("updated_id", updatedId);

  if (rangeDays) {
    params.set("range_days", rangeDays);
  }

  if (organizationId) {
    params.set("organization_id", organizationId);
  }

  return `/dashboard?${params.toString()}`;
}

export async function updateTaskStatusQuickAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const status = readValue(formData, "status");

  if (!id || !status) {
    throw new Error("ID e status da atividade sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "task",
    entityId: id,
    action: "status_update",
    payload: { status, source: "dashboard_quick_action" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  redirect(buildDashboardRedirectPath(formData, "task", id));
}

export async function updateGoalStatusQuickAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const status = getEditableGoalStatus(readValue(formData, "status") as GoalStoredStatus);

  if (!id || !status) {
    throw new Error("ID e status da meta sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "goal",
    entityId: id,
    action: "status_update",
    payload: { status, source: "dashboard_quick_action" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  redirect(buildDashboardRedirectPath(formData, "goal", id));
}

export async function updateMeetingStatusQuickAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const status = readValue(formData, "status");

  if (!id || !status) {
    throw new Error("ID e status da reuniao sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("meetings")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) {
    if (error.message.toLowerCase().includes("status")) {
      throw new Error(
        "A coluna meetings.status ainda nao existe. Rode o SQL atualizado de SUPABASE_MEETINGS_TASKS_SETUP.md.",
      );
    }
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: id,
    action: "status_update",
    payload: { status, source: "dashboard_quick_action" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  redirect(buildDashboardRedirectPath(formData, "meeting", id));
}
