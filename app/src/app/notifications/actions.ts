"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import {
  runNotificationsSweep,
  sendQueuedNotifications,
} from "@/lib/notifications/service";

export async function runNotificationsSweepAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  await runNotificationsSweep(supabase, workspaceId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function sendQueuedNotificationsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  await sendQueuedNotifications(supabase, workspaceId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function runSweepAndSendNotificationsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  await runNotificationsSweep(supabase, workspaceId);
  await sendQueuedNotifications(supabase, workspaceId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
