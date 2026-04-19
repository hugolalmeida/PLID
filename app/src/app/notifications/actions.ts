"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  runNotificationsSweep,
  sendQueuedNotifications,
} from "@/lib/notifications/service";

export async function runNotificationsSweepAction() {
  const supabase = await createSupabaseServerClient();
  await runNotificationsSweep(supabase);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function sendQueuedNotificationsAction() {
  const supabase = await createSupabaseServerClient();
  await sendQueuedNotifications(supabase);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function runSweepAndSendNotificationsAction() {
  const supabase = await createSupabaseServerClient();
  await runNotificationsSweep(supabase);
  await sendQueuedNotifications(supabase);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
