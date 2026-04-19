"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildMinutesFromSections({
  highlights,
  decisions,
  followUps,
}: {
  highlights: string;
  decisions: string;
  followUps: string;
}) {
  return [
    "Pontos importantes:",
    highlights || "-",
    "",
    "Decisoes:",
    decisions || "-",
    "",
    "Encaminhamentos:",
    followUps || "-",
  ].join("\n");
}

export async function updateMeetingRecordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const minutesRaw = readValue(formData, "minutes");
  const highlights = readValue(formData, "highlights");
  const decisions = readValue(formData, "decisions");
  const followUps = readValue(formData, "follow_ups");

  if (!id) {
    throw new Error("ID da reuniao obrigatorio.");
  }

  const minutes =
    highlights || decisions || followUps
      ? buildMinutesFromSections({ highlights, decisions, followUps })
      : minutesRaw;

  const { error } = await supabase
    .from("meetings")
    .update({
      minutes: minutes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}/registro`);
  redirect(`/meetings/${id}/registro?create=success&message=Registro%20salvo%20com%20sucesso.`);
}

export async function createMeetingTaskFromRecordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const meetingId = readValue(formData, "meeting_id");
  const title = readValue(formData, "title");
  const description = readValue(formData, "description");
  const ownerPersonId = readValue(formData, "owner_person_id");
  const organizationId = readValue(formData, "organization_id");
  const dueDate = readValue(formData, "due_date");
  const dueTime = readValue(formData, "due_time");

  if (!meetingId) {
    throw new Error("ID da reuniao obrigatorio.");
  }

  if (!title || !ownerPersonId || !organizationId || !dueDate) {
    redirect(
      `/meetings/${meetingId}/registro?create=error&message=Preencha%20titulo%2C%20responsavel%2C%20organizacao%20e%20prazo%20da%20atividade.`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/meetings/${meetingId}/registro?create=error&message=Usuario%20nao%20autenticado.`);
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    description: description || null,
    owner_person_id: ownerPersonId,
    organization_id: organizationId,
    status: "todo",
    due_date: dueDate,
    due_time: dueTime || null,
    meeting_id: meetingId,
    created_by: user.id,
  });

  if (error) {
    redirect(`/meetings/${meetingId}/registro?create=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/meetings/${meetingId}/registro`);
  redirect(`/meetings/${meetingId}/registro?create=success&message=Atividade%20criada%20e%20vinculada%20a%20reuniao.`);
}
