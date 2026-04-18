"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateMeetingRecordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = readValue(formData, "id");
  const minutes = readValue(formData, "minutes");

  if (!id) {
    throw new Error("ID da reuniao obrigatorio.");
  }

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
}

