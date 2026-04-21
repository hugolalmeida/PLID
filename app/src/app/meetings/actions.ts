"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";
import { getWorkspaceCalendarIntegration } from "@/lib/workspaces/integrations";
import {
  deleteGoogleCalendarEvent,
  syncMeetingToGoogleCalendar,
} from "@/lib/google/calendar";
import { sendEmailWithGmail } from "@/lib/google/gmail";

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

function canSendEmailNotifications() {
  return (
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN)
  );
}

function normalizeOrganizationIds(formData: FormData) {
  const values = formData.getAll("organization_ids");
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

async function replaceMeetingOrganizations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  workspaceId: string,
  meetingId: string,
  organizationIds: string[],
) {
  const deleteResult = await supabase
    .from("meeting_organizations")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("workspace_id", workspaceId);

  if (deleteResult.error) {
    if (deleteResult.error.message.toLowerCase().includes("meeting_organizations")) {
      return { setupMissing: true as const };
    }
    throw new Error(deleteResult.error.message);
  }

  if (!organizationIds.length) return { setupMissing: false as const };

  const insertRows = organizationIds.map((organizationId) => ({
    workspace_id: workspaceId,
    meeting_id: meetingId,
    organization_id: organizationId,
  }));

  const insertResult = await supabase.from("meeting_organizations").insert(insertRows);
  if (insertResult.error) {
    if (insertResult.error.message.toLowerCase().includes("meeting_organizations")) {
      return { setupMissing: true as const };
    }
    throw new Error(insertResult.error.message);
  }

  return { setupMissing: false as const };
}

async function sendMeetingNotificationsToOrganizations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    workspaceId: string;
    meetingId: string;
    title: string;
    date: string;
    notes: string | null;
    organizationIds: string[];
  },
) {
  if (!input.organizationIds.length || !canSendEmailNotifications()) {
    if (input.organizationIds.length) {
      await insertMeetingNotificationLog(supabase, {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        recipientEmail: null,
        recipientPersonId: null,
        status: "skipped",
        payload: {
          reason: "Credenciais Google ausentes para envio de e-mail",
          organization_ids: input.organizationIds.join(","),
        },
      });
    }
    return;
  }

  const organizationsResult = await supabase
    .from("organizations")
    .select("id, name")
    .eq("workspace_id", input.workspaceId)
    .in("id", input.organizationIds)
    .returns<Array<{ id: string; name: string }>>();

  if (organizationsResult.error) {
    console.error("[meetings:notify] organizations query failed", organizationsResult.error.message);
    return;
  }

  const organizations = organizationsResult.data || [];
  if (!organizations.length) return;

  const rolesResult = await supabase
    .from("roles")
    .select("id, organization_id")
    .eq("workspace_id", input.workspaceId)
    .in(
      "organization_id",
      organizations.map((organization) => organization.id),
    )
    .returns<Array<{ id: string; organization_id: string }>>();

  if (rolesResult.error) {
    console.error("[meetings:notify] roles query failed", rolesResult.error.message);
    return;
  }

  const roles = rolesResult.data || [];
  if (!roles.length) return;

  const personRolesResult = await supabase
    .from("person_roles")
    .select("person_id, role_id")
    .eq("workspace_id", input.workspaceId)
    .in(
      "role_id",
      roles.map((role) => role.id),
    )
    .returns<Array<{ person_id: string; role_id: string }>>();

  if (personRolesResult.error) {
    console.error("[meetings:notify] person_roles query failed", personRolesResult.error.message);
    return;
  }

  const personRoles = personRolesResult.data || [];
  if (!personRoles.length) return;

  const personIds = Array.from(new Set(personRoles.map((row) => row.person_id)));
  const peopleResult = await supabase
    .from("people")
    .select("id, name, email, active")
    .eq("workspace_id", input.workspaceId)
    .eq("active", true)
    .in("id", personIds)
    .returns<Array<{ id: string; name: string; email: string | null; active: boolean }>>();

  if (peopleResult.error) {
    console.error("[meetings:notify] people query failed", peopleResult.error.message);
    return;
  }

  const people = peopleResult.data || [];
  const uniquePeopleByEmail = new Map<string, { id: string; name: string; email: string }>();
  for (const person of people) {
    const email = person.email?.trim().toLowerCase();
    if (!email) continue;
    if (!uniquePeopleByEmail.has(email)) {
      uniquePeopleByEmail.set(email, {
        id: person.id,
        name: person.name,
        email,
      });
    }
  }

  if (!uniquePeopleByEmail.size) return;

  const dateBr = new Date(`${input.date}T12:00:00`).toLocaleDateString("pt-BR");
  const organizationsLabel = organizations.map((organization) => organization.name).join(", ");

  for (const recipient of uniquePeopleByEmail.values()) {
    const body = [
      `Ola, ${recipient.name}.`,
      "",
      "Voce foi incluido(a) em uma reuniao do PLID.",
      "",
      `Reuniao: ${input.title}`,
      `Data: ${dateBr}`,
      `Organizacoes: ${organizationsLabel}`,
      input.notes ? `Notas: ${input.notes}` : "",
      "",
      "Acesse o sistema para mais detalhes e registro.",
      "",
      "PLID",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const dispatch = await sendEmailWithGmail({
        to: recipient.email,
        subject: `[PLID] Convite de reuniao: ${input.title}`,
        body,
      });
      await insertMeetingNotificationLog(supabase, {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        recipientEmail: recipient.email,
        recipientPersonId: recipient.id,
        status: "sent",
        payload: {
          reason: "Convite de reuniao enviado",
          meeting_title: input.title,
          organization_ids: input.organizationIds.join(","),
          gmail_message_id: dispatch.messageId,
        },
      });
    } catch (error) {
      const dispatchError =
        error instanceof Error ? error.message.slice(0, 300) : "Erro desconhecido";
      await insertMeetingNotificationLog(supabase, {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        recipientEmail: recipient.email,
        recipientPersonId: recipient.id,
        status: "failed",
        payload: {
          reason: "Falha ao enviar convite de reuniao",
          meeting_title: input.title,
          organization_ids: input.organizationIds.join(","),
          dispatch_error: dispatchError,
        },
      });
      console.error("[meetings:notify] email send failed", {
        meetingId: input.meetingId,
        recipient: recipient.email,
        error,
      });
    }
  }
}

async function insertMeetingNotificationLog(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    workspaceId: string;
    meetingId: string;
    recipientEmail: string | null;
    recipientPersonId: string | null;
    status: "queued" | "sent" | "failed" | "skipped";
    payload: Record<string, string | number | boolean | null>;
  },
) {
  const result = await supabase.from("meeting_notifications_log").insert({
    workspace_id: input.workspaceId,
    meeting_id: input.meetingId,
    recipient_email: input.recipientEmail,
    recipient_person_id: input.recipientPersonId,
    status: input.status,
    sent_at: new Date().toISOString(),
    payload: input.payload,
  });

  if (result.error) {
    const missingSetup = result.error.message.toLowerCase().includes("meeting_notifications_log");
    if (missingSetup) {
      console.error(
        "[meetings:notify] log table missing. Run SUPABASE_MEETING_NOTIFICATIONS_LOG_SETUP.md",
      );
      return;
    }
    console.error("[meetings:notify] log insert failed", result.error.message);
  }
}

type MeetingForSync = {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
};

async function syncMeetingCalendarInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  meetingId: string,
  workspaceId: string,
  integration: { calendarId: string; timeZone: string | null },
) {
  const meetingWithStatusResult = await supabase
    .from("meetings")
    .select("id, title, date, notes, status")
    .eq("id", meetingId)
    .eq("workspace_id", workspaceId)
    .single<MeetingForSync>();

  let meetingResult = meetingWithStatusResult;
  if (
    meetingWithStatusResult.error &&
    meetingWithStatusResult.error.message.toLowerCase().includes("status")
  ) {
    const meetingFallbackResult = await supabase
      .from("meetings")
      .select("id, title, date, notes")
      .eq("id", meetingId)
      .eq("workspace_id", workspaceId)
      .single<Omit<MeetingForSync, "status">>();

    if (meetingFallbackResult.error) {
      throw new Error(meetingFallbackResult.error.message);
    }

    meetingResult = {
      data: { ...meetingFallbackResult.data, status: "todo" as const },
      error: null,
    } as typeof meetingResult;
  }

  if (meetingResult.error) {
    throw new Error(meetingResult.error.message);
  }

  const existingResult = await supabase
    .from("meeting_calendar_events")
    .select("google_event_id, calendar_id")
    .eq("meeting_id", meetingId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ google_event_id: string; calendar_id: string }>();

  if (
    existingResult.error &&
    !existingResult.error.message.toLowerCase().includes("meeting_calendar_events")
  ) {
    throw new Error(existingResult.error.message);
  }

  const meeting = meetingResult.data;
  const status = meeting.status || "todo";
  const synced = await syncMeetingToGoogleCalendar(
    {
      title: meeting.title,
      notes: meeting.notes,
      date: meeting.date,
      status,
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

  const upsertResult = await supabase.from("meeting_calendar_events").upsert(
    {
      meeting_id: meetingId,
      workspace_id: workspaceId,
      google_event_id: synced.googleEventId,
      calendar_id: synced.calendarId,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" },
  );

  if (upsertResult.error) {
    if (upsertResult.error.message.toLowerCase().includes("meeting_calendar_events")) {
      throw new Error(
        "Tabela meeting_calendar_events nao encontrada. Rode o SQL SUPABASE_MEETING_CALENDAR_EVENTS_SETUP.md.",
      );
    }
    throw new Error(upsertResult.error.message);
  }
}

async function tryAutoSyncMeetingCalendar(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  meetingId: string,
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
    await syncMeetingCalendarInternal(supabase, meetingId, workspaceId, {
      calendarId: integration.calendarId,
      timeZone: integration.timeZone,
    });
  } catch (error) {
    console.error("[meetings:auto-sync] failed", error);
  }
}

export async function createMeetingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const title = readValue(formData, "title");
  const date = readValue(formData, "date");
  const notes = readValue(formData, "notes");
  const status = readValue(formData, "status") || "todo";
  const organizationIds = normalizeOrganizationIds(formData);

  if (!title || !date) {
    redirect("/meetings?create=error&message=Titulo%20e%20data%20sao%20obrigatorios.");
  }
  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  let { data, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspaceId,
      title,
      date,
      notes: notes || null,
      status,
    })
    .select("id")
    .single();

  if (error && error.message.toLowerCase().includes("status")) {
    const fallback = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        title,
        date,
        notes: notes || null,
      })
      .select("id")
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    redirect(`/meetings?create=error&message=${encodeURIComponent(error.message)}`);
  }

  const relationUpdate = await replaceMeetingOrganizations(
    supabase,
    workspaceId,
    data.id,
    organizationIds,
  );

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: data.id,
    action: "create",
    payload: { title, date, notes: notes || null, status, organizationIds },
  });

  await tryAutoSyncMeetingCalendar(supabase, data.id, workspaceId);
  if (!relationUpdate.setupMissing) {
    await sendMeetingNotificationsToOrganizations(supabase, {
      workspaceId,
      meetingId: data.id,
      title,
      date,
      notes: notes || null,
      organizationIds,
    });
  }

  revalidatePath("/meetings");
  revalidatePath("/tasks");
  redirect("/meetings?create=success&message=Reuniao%20criada%20com%20sucesso.");
}

export async function updateMeetingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const title = readValue(formData, "title");
  const date = readValue(formData, "date");
  const notes = readValue(formData, "notes");
  const status = readValue(formData, "status") || "todo";
  const returnPath = readValue(formData, "return_path");
  const organizationIds = normalizeOrganizationIds(formData);

  if (!id || !title || !date) {
    throw new Error("ID, titulo e data sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  let { error } = await supabase
    .from("meetings")
    .update({
      title,
      date,
      notes: notes || null,
      status,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error && error.message.toLowerCase().includes("status")) {
    const fallback = await supabase
      .from("meetings")
      .update({
        title,
        date,
        notes: notes || null,
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  await replaceMeetingOrganizations(supabase, workspaceId, id, organizationIds);

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: id,
    action: "update",
    payload: { title, date, notes: notes || null, status, organizationIds },
  });

  await tryAutoSyncMeetingCalendar(supabase, id, workspaceId);

  revalidatePath("/meetings");
  revalidatePath("/tasks");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deleteMeetingAction(formData: FormData) {
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

  const existingEventResult = await supabase
    .from("meeting_calendar_events")
    .select("google_event_id, calendar_id")
    .eq("meeting_id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ google_event_id: string; calendar_id: string }>();

  const existingEvent = existingEventResult.error ? null : existingEventResult.data;

  if (existingEvent && canAutoSyncCalendar()) {
    const integration = await getWorkspaceCalendarIntegration(supabase, workspaceId);
    if (integration.enabled && integration.calendarId) {
      try {
        await deleteGoogleCalendarEvent({
          calendarId: existingEvent.calendar_id || integration.calendarId,
          googleEventId: existingEvent.google_event_id,
        });
      } catch (error) {
        console.error("[meetings:delete-sync] failed", error);
      }
    }
  }

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/meetings");
  revalidatePath("/tasks");
}

export async function syncMeetingCalendarAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meetingId = readValue(formData, "meeting_id");

  if (!meetingId) {
    throw new Error("ID da reuniao obrigatorio.");
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
      "/meetings?create=error&message=Credenciais%20Google%20incompletas%20no%20servidor.%20Verifique%20o%20.env.local.",
    );
  }

  const integration = await getWorkspaceCalendarIntegration(supabase, workspaceId);
  if (!integration.enabled) {
    redirect(
      `/meetings?create=error&message=${encodeURIComponent(
        integration.setupMessage ||
          "Integracao por workspace ainda nao configurada. Rode o SQL de setup.",
      )}`,
    );
  }
  if (!integration.calendarId) {
    redirect(
      "/meetings?create=error&message=Calendar%20ID%20nao%20configurado%20para%20este%20workspace.%20Acesse%20Workspaces%20e%20preencha%20a%20integracao.",
    );
  }

  await syncMeetingCalendarInternal(supabase, meetingId, workspaceId, {
    calendarId: integration.calendarId,
    timeZone: integration.timeZone,
  });

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: meetingId,
    action: "sync",
    payload: { target: "google_calendar" },
  });

  revalidatePath("/meetings");
}
