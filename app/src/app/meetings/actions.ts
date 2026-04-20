"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: data.id,
    action: "create",
    payload: { title, date, notes: notes || null, status },
  });

  revalidatePath("/meetings");
  revalidatePath("/tasks");
  redirect(`/meetings/${data.id}/registro?create=success&message=Reuniao%20criada%20com%20sucesso.`);
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

  await logAuditEvent(supabase, {
    entityType: "meeting",
    entityId: id,
    action: "update",
    payload: { title, date, notes: notes || null, status },
  });

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
