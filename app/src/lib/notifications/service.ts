import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailWithGmail } from "@/lib/google/gmail";

type TaskForNotification = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  due_date: string;
  owner_person_id: string;
  created_by: string | null;
  workspace_id: string;
};

type NotificationType = "due_reminder_2d" | "overdue_status_2d";
type NotificationStatus = "queued" | "sent" | "failed" | "skipped";

type NotificationLogQueued = {
  id: string;
  task_id: string;
  type: NotificationType;
  recipient_email: string | null;
  workspace_id: string | null;
  payload: Record<string, string | number | boolean | null> | null;
  status: NotificationStatus;
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_COOLDOWN_MINUTES = 30;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function subjectByType(type: NotificationType) {
  if (type === "due_reminder_2d") {
    return "[PLID] Lembrete: atividade vence em 2 dias";
  }
  return "[PLID] Atraso: atividade sem conclusao ha 2 dias";
}

function buildBody(log: NotificationLogQueued) {
  const title = String(log.payload?.task_title || `Task ${log.task_id.slice(0, 8)}`);
  const reason = String(log.payload?.reason || "Notificacao do sistema");
  return [
    "Ola,",
    "",
    "Voce recebeu uma notificacao automatica do PLID.",
    "",
    `Atividade: ${title}`,
    `Motivo: ${reason}`,
    "",
    "Acesse o sistema para acompanhar e atualizar o status.",
    "",
    "PLID",
  ].join("\n");
}

function getAttempts(log: NotificationLogQueued) {
  const raw = log.payload?.dispatch_attempts;
  const parsed = typeof raw === "number" ? raw : Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLastAttemptDate(log: NotificationLogQueued) {
  const raw = log.payload?.last_attempt_at;
  if (!raw || typeof raw !== "string") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canRetry(log: NotificationLogQueued, now: Date) {
  if (log.status !== "failed") return true;
  const attempts = getAttempts(log);
  if (attempts >= MAX_RETRY_ATTEMPTS) return false;
  const lastAttempt = getLastAttemptDate(log);
  if (!lastAttempt) return true;
  const elapsedMinutes = (now.getTime() - lastAttempt.getTime()) / 60000;
  return elapsedMinutes >= RETRY_COOLDOWN_MINUTES;
}

export async function runNotificationsSweep(
  supabase: SupabaseClient,
  workspaceId?: string | null,
  now = new Date(),
) {
  const twoDaysAhead = new Date(now);
  twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);

  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, status, due_date, owner_person_id, created_by, workspace_id")
    .neq("status", "done");
  if (workspaceId) {
    tasksQuery = tasksQuery.eq("workspace_id", workspaceId);
  }

  let peopleQuery = supabase.from("people").select("id, email");
  if (workspaceId) {
    peopleQuery = peopleQuery.eq("workspace_id", workspaceId);
  }

  let logsQuery = supabase
    .from("notifications_log")
    .select("task_id, type, sent_at")
    .gte("sent_at", `${isoDate(now)}T00:00:00.000Z`);
  if (workspaceId) {
    logsQuery = logsQuery.eq("workspace_id", workspaceId);
  }

  const [tasksResult, peopleResult, profilesResult, logsResult] = await Promise.all([
    tasksQuery.returns<TaskForNotification[]>(),
    peopleQuery.returns<{ id: string; email: string | null }[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
    logsQuery.returns<{ task_id: string; type: NotificationType; sent_at: string }[]>(),
  ]);

  if (tasksResult.error?.message?.includes("created_by")) {
    throw new Error(
      "Coluna tasks.created_by ausente. Rode o SQL atualizado em SUPABASE_MEETINGS_TASKS_SETUP.md.",
    );
  }
  const firstError =
    tasksResult.error || peopleResult.error || profilesResult.error || logsResult.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const tasks = tasksResult.data || [];
  const people = peopleResult.data || [];
  const profiles = profilesResult.data || [];
  const logs = logsResult.data || [];
  const emailByPerson = new Map(people.map((person) => [person.id, person.email]));
  const nameByProfile = new Map(
    profiles.map((profile) => [profile.id, profile.full_name || profile.id.slice(0, 8)]),
  );
  const emailByProfile = new Map(profiles.map((profile) => [profile.id, profile.email]));

  const today = isoDate(now);
  const dueDateTarget = isoDate(twoDaysAhead);
  const overdueTwoDaysTarget = isoDate(twoDaysAgo);

  const existsRecent = (taskId: string, type: NotificationType, sinceIso: string) =>
    logs.some((log) => log.task_id === taskId && log.type === type && log.sent_at >= sinceIso);

  const inserts: Array<{
    task_id: string;
    workspace_id: string;
    type: NotificationType;
    recipient_email: string | null;
    sent_at: string;
    status: string;
    payload: Record<string, string | number | boolean | null>;
  }> = [];

  tasks.forEach((task) => {
    const ownerRecipient = emailByPerson.get(task.owner_person_id) || null;
    const creatorLabel = task.created_by
      ? nameByProfile.get(task.created_by) || task.created_by.slice(0, 8)
      : "criador_nao_definido";
    const creatorRecipient = task.created_by ? (emailByProfile.get(task.created_by) ?? null) : null;

    if (
      task.due_date === dueDateTarget &&
      !existsRecent(task.id, "due_reminder_2d", `${today}T00:00:00.000Z`)
    ) {
      inserts.push({
        task_id: task.id,
        workspace_id: task.workspace_id,
        type: "due_reminder_2d",
        recipient_email: ownerRecipient,
        sent_at: now.toISOString(),
        status: "queued",
        payload: {
          reason: "Tarefa com prazo em 2 dias",
          task_title: task.title,
          dispatch_attempts: 0,
        },
      });
    }

    if (
      task.due_date === overdueTwoDaysTarget &&
      !existsRecent(task.id, "overdue_status_2d", `${today}T00:00:00.000Z`)
    ) {
      inserts.push({
        task_id: task.id,
        workspace_id: task.workspace_id,
        type: "overdue_status_2d",
        recipient_email: creatorRecipient,
        sent_at: now.toISOString(),
        status: "queued",
        payload: {
          reason: "Tarefa vencida ha 2 dias sem conclusao",
          task_title: task.title,
          recipient_profile: creatorLabel,
          recipient_user_id: task.created_by || "nao_definido",
          dispatch_attempts: 0,
        },
      });
    }
  });

  if (inserts.length) {
    const { error: insertError } = await supabase.from("notifications_log").insert(inserts);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return { inserted: inserts.length };
}

export async function sendQueuedNotifications(
  supabase: SupabaseClient,
  workspaceId?: string | null,
) {
  const now = new Date();
  let queuedQuery = supabase
    .from("notifications_log")
    .select("id, task_id, type, recipient_email, workspace_id, payload, status")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (workspaceId) {
    queuedQuery = queuedQuery.eq("workspace_id", workspaceId);
  }

  const { data, error } = await queuedQuery.returns<NotificationLogQueued[]>();

  if (error) {
    throw new Error(error.message);
  }

  const queued = data || [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const log of queued) {
    if (!canRetry(log, now)) {
      skipped += 1;
      continue;
    }

    const attempts = getAttempts(log) + 1;

    if (!log.recipient_email) {
      let skippedUpdate = supabase
        .from("notifications_log")
        .update({
          status: "skipped",
          payload: {
            ...(log.payload || {}),
            dispatch_note: "Sem recipient_email para envio",
            dispatch_attempts: attempts,
            last_attempt_at: now.toISOString(),
          },
        })
        .eq("id", log.id);
      if (log.workspace_id) {
        skippedUpdate = skippedUpdate.eq("workspace_id", log.workspace_id);
      }
      const { error: skippedError } = await skippedUpdate;

      if (skippedError) {
        throw new Error(skippedError.message);
      }
      skipped += 1;
      continue;
    }

    try {
      const sentEmail = await sendEmailWithGmail({
        to: log.recipient_email,
        subject: subjectByType(log.type),
        body: buildBody(log),
      });

      let sentUpdate = supabase
        .from("notifications_log")
        .update({
          status: "sent",
          sent_at: now.toISOString(),
          payload: {
            ...(log.payload || {}),
            dispatch_attempts: attempts,
            last_attempt_at: now.toISOString(),
            gmail_message_id: sentEmail.messageId || null,
            dispatch_error: null,
          },
        })
        .eq("id", log.id);
      if (log.workspace_id) {
        sentUpdate = sentUpdate.eq("workspace_id", log.workspace_id);
      }
      const { error: sentError } = await sentUpdate;

      if (sentError) {
        throw new Error(sentError.message);
      }
      sent += 1;
    } catch (dispatchError) {
      const errorMessage =
        dispatchError instanceof Error ? dispatchError.message.slice(0, 300) : "Erro desconhecido";

      let failedUpdate = supabase
        .from("notifications_log")
        .update({
          status: "failed",
          payload: {
            ...(log.payload || {}),
            dispatch_attempts: attempts,
            last_attempt_at: now.toISOString(),
            dispatch_error: errorMessage,
          },
        })
        .eq("id", log.id);
      if (log.workspace_id) {
        failedUpdate = failedUpdate.eq("workspace_id", log.workspace_id);
      }
      const { error: failedError } = await failedUpdate;

      if (failedError) {
        throw new Error(failedError.message);
      }
      failed += 1;
    }
  }

  return { queued: queued.length, sent, failed, skipped };
}
