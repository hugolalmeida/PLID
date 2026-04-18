"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncTaskToGoogleCalendar } from "@/lib/google/calendar";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const organizationId = readValue(formData, "organization_id");
  const status = readValue(formData, "status");
  const dueDate = readValue(formData, "due_date");
  const dueTime = readValue(formData, "due_time");
  const meetingId = readValue(formData, "meeting_id");

  if (!title || !ownerPersonId || !organizationId || !status || !dueDate) {
    throw new Error("Titulo, responsavel, organizacao, status e prazo sao obrigatorios.");
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    description: description || null,
    owner_person_id: ownerPersonId,
    organization_id: organizationId,
    status,
    due_date: dueDate,
    due_time: dueTime || null,
    meeting_id: meetingId || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function updateTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const organizationId = readValue(formData, "organization_id");
  const status = readValue(formData, "status");
  const dueDate = readValue(formData, "due_date");
  const dueTime = readValue(formData, "due_time");
  const meetingId = readValue(formData, "meeting_id");

  if (!id || !title || !ownerPersonId || !organizationId || !status || !dueDate) {
    throw new Error("Campos obrigatorios nao preenchidos.");
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
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function deleteTaskAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function syncTaskCalendarAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const taskId = readValue(formData, "task_id");

  if (!taskId) {
    throw new Error("ID da tarefa obrigatorio.");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, due_time, owner_person_id, organization_id, meeting_id",
    )
    .eq("id", taskId)
    .single<{
      id: string;
      title: string;
      description: string | null;
      due_date: string;
      due_time: string | null;
      owner_person_id: string;
      organization_id: string;
      meeting_id: string | null;
    }>();

  if (taskError) {
    throw new Error(taskError.message);
  }

  const [ownerResult, organizationResult, meetingResult, existingResult] =
    await Promise.all([
      supabase
        .from("people")
        .select("name, email")
        .eq("id", task.owner_person_id)
        .single<{ name: string; email: string | null }>(),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", task.organization_id)
        .single<{ name: string }>(),
      task.meeting_id
        ? supabase
            .from("meetings")
            .select("title")
            .eq("id", task.meeting_id)
            .maybeSingle<{ title: string }>()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("calendar_events")
        .select("google_event_id, calendar_id")
        .eq("task_id", taskId)
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
  );

  const { error: upsertError } = await supabase.from("calendar_events").upsert(
    {
      task_id: taskId,
      google_event_id: synced.googleEventId,
      calendar_id: synced.calendarId,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  revalidatePath("/tasks");
}
