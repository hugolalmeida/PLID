"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
