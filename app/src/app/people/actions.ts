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

function readBoolean(formData: FormData, key: string) {
  return readValue(formData, key) === "true";
}

function buildFeedbackPath(
  basePath: string | undefined,
  status: "success" | "error",
  message: string,
) {
  const safeBase = basePath && basePath.startsWith("/") ? basePath : "/people";
  const url = new URL(safeBase, "http://localhost");
  url.searchParams.set("create", status);
  url.searchParams.set("message", message);
  return `${url.pathname}${url.search}`;
}

export async function createPersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");

  if (!name) {
    redirect("/people?create=error&message=Nome%20obrigatorio.");
  }
  if (!user) {
    redirect("/login");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Selecione%20ou%20crie%20um%20workspace.");
  }

  const { data: createdPerson, error } = await supabase
    .from("people")
    .insert({
      workspace_id: workspaceId,
      name,
      email: email || null,
      phone: phone || null,
      active,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !createdPerson) {
    redirect(`/people?create=error&message=${encodeURIComponent(error?.message || "Erro ao criar pessoa.")}`);
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: createdPerson.id,
    action: "create",
    payload: {
      name,
      email: email || null,
      phone: phone || null,
      active,
      roleId: roleId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    },
  });

  if (roleId) {
    const { error: linkError } = await supabase.from("person_roles").insert({
      workspace_id: workspaceId,
      person_id: createdPerson.id,
      role_id: roleId,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (linkError) {
      revalidatePath("/people");
      redirect(
        `/people?create=error&message=${encodeURIComponent(
          `Pessoa criada, mas o vinculo inicial de cargo falhou: ${linkError.message}`,
        )}`,
      );
    }
  }

  revalidatePath("/people");
  redirect("/people?create=success&message=Pessoa%20criada%20com%20sucesso.");
}

export async function updatePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const name = readValue(formData, "name");
  const email = readValue(formData, "email");
  const phone = readValue(formData, "phone");
  const active = readBoolean(formData, "active");
  const roleId = readValue(formData, "role_id");
  const startDate = readValue(formData, "start_date");
  const endDate = readValue(formData, "end_date");
  const returnPath = readValue(formData, "return_path");

  if (!id || !name) {
    throw new Error("ID e nome sao obrigatorios.");
  }
  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    throw new Error("Workspace ativo nao encontrado.");
  }

  const { error } = await supabase
    .from("people")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      active,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  const existingLinks = await supabase
    .from("person_roles")
    .select("id, role_id, start_date, end_date")
    .eq("person_id", id)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .returns<
      Array<{
        id: string;
        role_id: string;
        start_date: string | null;
        end_date: string | null;
      }>
    >();

  if (existingLinks.error) {
    throw new Error(existingLinks.error.message);
  }

  const latest = (existingLinks.data || [])[0] || null;

  if (roleId) {
    if (latest) {
      const { error: updateLinkError } = await supabase
        .from("person_roles")
        .update({
          role_id: roleId,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .eq("id", latest.id)
        .eq("workspace_id", workspaceId);

      if (updateLinkError) {
        throw new Error(updateLinkError.message);
      }
    } else {
      const { error: insertLinkError } = await supabase.from("person_roles").insert({
        workspace_id: workspaceId,
        person_id: id,
        role_id: roleId,
        start_date: startDate || null,
        end_date: endDate || null,
      });

      if (insertLinkError) {
        throw new Error(insertLinkError.message);
      }
    }
  } else if (latest) {
    const { error: clearRoleError } = await supabase
      .from("person_roles")
      .delete()
      .eq("id", latest.id)
      .eq("workspace_id", workspaceId);

    if (clearRoleError) {
      throw new Error(clearRoleError.message);
    }
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: id,
    action: "update",
    payload: {
      name,
      email: email || null,
      phone: phone || null,
      active,
      roleId: roleId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    },
  });

  revalidatePath("/people");

  if (returnPath) {
    redirect(returnPath);
  }
}

export async function deletePersonAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = readValue(formData, "id");
  const returnPath = readValue(formData, "return_path");

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

  const [tasksOwnedResult, goalsOwnedResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("owner_person_id", id),
    supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("owner_person_id", id),
  ]);

  const checkError = tasksOwnedResult.error || goalsOwnedResult.error;
  if (checkError) {
    redirect(
      buildFeedbackPath(
        returnPath,
        "error",
        `Falha ao validar vinculos da pessoa: ${checkError.message}`,
      ),
    );
  }

  const tasksOwned = tasksOwnedResult.count || 0;
  const goalsOwned = goalsOwnedResult.count || 0;
  if (tasksOwned > 0 || goalsOwned > 0) {
    const blockedBy = [
      tasksOwned > 0 ? `${tasksOwned} atividade(s)` : null,
      goalsOwned > 0 ? `${goalsOwned} meta(s)` : null,
    ]
      .filter(Boolean)
      .join(" e ");

    redirect(
      buildFeedbackPath(
        returnPath,
        "error",
        `Nao foi possivel remover a pessoa: ela ainda esta vinculada a ${blockedBy}. Reatribua os responsaveis antes de excluir.`,
      ),
    );
  }

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    redirect(buildFeedbackPath(returnPath, "error", `Falha ao remover pessoa: ${error.message}`));
  }

  await logAuditEvent(supabase, {
    entityType: "person",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/people");

  if (returnPath) {
    redirect(buildFeedbackPath(returnPath, "success", "Pessoa removida com sucesso."));
  }

  redirect("/people?create=success&message=Pessoa%20removida%20com%20sucesso.");
}
