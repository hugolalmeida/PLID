"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncTaskToGoogleCalendar } from "@/lib/google/calendar";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { getWorkspaceCalendarIntegration } from "@/lib/workspaces/integrations";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function canAutoSyncCalendar() {
  return (
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN)
  );
}

type TaskForSync = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  owner_person_id: string;
  organization_id: string;
  meeting_id: string | null;
};

async function syncTaskCalendarInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskId: string,
  workspaceId: string,
  integration: { calendarId: string; timeZone: string | null },
) {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, due_time, owner_person_id, organization_id, meeting_id",
    )
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single<TaskForSync>();

  if (taskError) {
    throw new Error(taskError.message);
  }

  const [ownerResult, organizationResult, meetingResult, existingResult] =
    await Promise.all([
      supabase
        .from("people")
        .select("name, email")
        .eq("id", task.owner_person_id)
        .eq("workspace_id", workspaceId)
        .single<{ name: string; email: string | null }>(),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", task.organization_id)
        .eq("workspace_id", workspaceId)
        .single<{ name: string }>(),
      task.meeting_id
        ? supabase
            .from("meetings")
            .select("title")
            .eq("id", task.meeting_id)
            .eq("workspace_id", workspaceId)
            .maybeSingle<{ title: string }>()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("calendar_events")
        .select("google_event_id, calendar_id")
        .eq("task_id", taskId)
        .eq("workspace_id", workspaceId)
        .maybeSingle<{ google_event_id: string; calendar_id: string }>(),
    ]);

  if (ownerResult.error || organizationResult.error || meetingResult.error) {
    throw new Error(
      ownerResult.error?.message ||
        organizationResult.error?.message ||
        meetingResult.error?.message ||
        "Erro ao carregar dados da tarefa.",
    );
  }

  const owner = ownerResult.data;
  const organization = organizationResult.data;

  if (!owner || !organization) {
    throw new Error("Dados de responsavel ou organizacao nao encontrados.");
  }

  const synced = await syncTaskToGoogleCalendar(
    {
      title: task.title,
      description: task.description,
      dueDate: task.due_date,
      dueTime: task.due_time,
      ownerName: owner.name,
      ownerEmail: owner.email,
      organizationName: organization.name,
      meetingTitle: meetingResult.data?.title || null,
    },
    existingResult.data
      ? {
          googleEventId: existingResult.data.google_event_id,
          calendarId: existingResult.data.calendar_id,
        }
      : null,
    {
      calendarId: integration.calendarId,
      timeZone: integration.timeZone,
    },
  );

  const { error: upsertError } = await supabase.from("calendar_events").upsert(
    {
      task_id: taskId,
      workspace_id: workspaceId,
      google_event_id: synced.googleEventId,
      calendar_id: synced.calendarId,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

async function tryAutoSyncTaskCalendar(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskId: string,
  workspaceId: string,
) {
  if (!canAutoSyncCalendar()) {
    return;
  }
  const integration = await getWorkspaceCalendarIntegration(supabase, workspaceId);
  if (!integration.enabled || !integration.calendarId) {
    return;
  }

  try {
    await syncTaskCalendarInternal(supabase, taskId, workspaceId, {
      calendarId: integration.calendarId,
      timeZone: integration.timeZone,
    });
  } catch (error) {
    // Nao bloqueia create/update da tarefa quando Google falhar.
    console.error("[tasks:auto-sync] failed", error);
  }
}

export async function createTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const organizationId = readValue(formData, "organization_id");
  const status = readValue(formData, "status");
  const dueDate = readValue(formData, "due_date");
  const dueTime = readValue(formData, "due_time");
  const meetingId = readValue(formData, "meeting_id");

  if (!user) {
    redirect("/tasks?create=error&message=Usuario%20nao%20autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  if (!title || !ownerPersonId || !organizationId || !status || !dueDate) {
    redirect(
      "/tasks?create=error&message=Titulo%2C%20responsavel%2C%20organizacao%2C%20status%20e%20prazo%20sao%20obrigatorios.",
    );
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      title,
      description: description || null,
      owner_person_id: ownerPersonId,
      organization_id: organizationId,
      status,
      due_date: dueDate,
      due_time: dueTime || null,
      meeting_id: meetingId || null,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(`/tasks?create=error&message=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, {
    entityType: "task",
    entityId: data.id,
    action: "create",
    payload: {
      title,
      ownerPersonId,
      organizationId,
      status,
      dueDate,
      dueTime: dueTime || null,
      meetingId: meetingId || null,
    },
  });

  await tryAutoSyncTaskCalendar(supabase, data.id, workspaceId);

  revalidatePath("/tasks");
  redirect("/tasks?create=success&message=Atividade%20criada%20com%20sucesso.");
}

export async function updateTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const organizationId = readValue(formData, "organization_id");
  const status = readValue(formData, "status");
  const dueDate = readValue(formData, "due_date");
  const dueTime = readValue(formData, "due_time");
  const meetingId = readValue(formData, "meeting_id");
  const returnPath = readValue(formData, "return_path");

  if (!id || !title || !ownerPersonId || !organizationId || !status || !dueDate) {
    throw new Error("Campos obrigatorios nao preenchidos.");
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
    .update({
      title,
      description: description || null,
      owner_person_id: ownerPersonId,
      organization_id: organizationId,
      status,
      due_date: dueDate,
      due_time: dueTime || null,
      meeting_id: meetingId || null,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "task",
    entityId: id,
    action: "update",
    payload: {
      title,
      ownerPersonId,
      organizationId,
      status,
      dueDate,
      dueTime: dueTime || null,
      meetingId: meetingId || null,
    },
  });

  await tryAutoSyncTaskCalendar(supabase, id, workspaceId);

  revalidatePath("/tasks");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deleteTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
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
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "task",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/tasks");
}

export async function syncTaskCalendarAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const taskId = readValue(formData, "task_id");

  if (!taskId) {
    throw new Error("ID da tarefa obrigatorio.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }
  if (!canAutoSyncCalendar()) {
    redirect(
      "/tasks?create=error&message=Credenciais%20Google%20incompletas%20no%20servidor.%20Verifique%20o%20.env.local.",
    );
  }
  const integration = await getWorkspaceCalendarIntegration(supabase, workspaceId);
  if (!integration.enabled) {
    redirect(
      `/tasks?create=error&message=${encodeURIComponent(
        integration.setupMessage ||
          "Integracao por workspace ainda nao configurada. Rode o SQL de setup.",
      )}`,
    );
  }
  if (!integration.calendarId) {
    redirect(
      "/tasks?create=error&message=Calendar%20ID%20nao%20configurado%20para%20este%20workspace.%20Acesse%20Workspaces%20e%20preencha%20a%20integracao.",
    );
  }

  await syncTaskCalendarInternal(supabase, taskId, workspaceId, {
    calendarId: integration.calendarId,
    timeZone: integration.timeZone,
  });
  await logAuditEvent(supabase, {
    entityType: "task",
    entityId: taskId,
    action: "sync",
    payload: { target: "google_calendar" },
  });

  revalidatePath("/tasks");
}
