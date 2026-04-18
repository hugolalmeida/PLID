"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMeetingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const title = readValue(formData, "title");
  const date = readValue(formData, "date");
  const notes = readValue(formData, "notes");

  if (!title || !date) {
    throw new Error("Titulo e data sao obrigatorios.");
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      title,
      date,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/meetings");
  revalidatePath("/tasks");
  redirect(`/meetings/${data.id}/registro`);
}

export async function updateMeetingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const title = readValue(formData, "title");
  const date = readValue(formData, "date");
  const notes = readValue(formData, "notes");

  if (!id || !title || !date) {
    throw new Error("ID, titulo e data sao obrigatorios.");
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      title,
      date,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/meetings");
  revalidatePath("/tasks");
}

export async function deleteMeetingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");

  if (!id) {
    throw new Error("ID obrigatorio.");
  }

  const { error } = await supabase.from("meetings").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/meetings");
  revalidatePath("/tasks");
}
