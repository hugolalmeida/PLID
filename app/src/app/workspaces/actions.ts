"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createWorkspaceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawName = String(formData.get("name") || "").trim();
  if (!rawName) {
    redirect(
      "/workspaces?create=error&message=Informe%20um%20nome%20para%20o%20workspace.",
    );
  }

  const existingWorkspaceByName = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(name)")
    .eq("user_id", user.id)
    .returns<Array<{ workspace: { name: string } | null }>>();

  if (existingWorkspaceByName.error) {
    redirect(
      `/workspaces?create=error&message=${encodeURIComponent(existingWorkspaceByName.error.message)}`,
    );
  }

  const normalizedRawName = rawName.toLowerCase();
  const alreadyExists = (existingWorkspaceByName.data || []).some(
    (row) => row.workspace?.name?.toLowerCase() === normalizedRawName,
  );

  if (alreadyExists) {
    redirect(
      "/workspaces?create=error&message=Ja%20existe%20um%20workspace%20com%20este%20nome.",
    );
  }

  const baseSlug = slugify(rawName) || `workspace-${Date.now().toString(36)}`;
  let createdWorkspaceId: string | null = null;
  let insertErrorMessage = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.floor(Math.random() * 900 + 100)}`;
    const slug = `${baseSlug}${suffix}`;
    const candidateWorkspaceId = crypto.randomUUID();

    const insertResult = await supabase.from("workspaces").insert({
      id: candidateWorkspaceId,
      name: rawName,
      slug,
      created_by: user.id,
    });

    if (!insertResult.error) {
      createdWorkspaceId = candidateWorkspaceId;
      break;
    }

    if (insertResult.error?.code !== "23505") {
      insertErrorMessage = insertResult.error?.message || "Falha ao criar workspace.";
      break;
    }
  }

  if (!createdWorkspaceId) {
    const message =
      insertErrorMessage ||
      "Nao foi possivel criar o workspace. Se for a primeira vez, rode o SQL SUPABASE_WORKSPACES_SETUP.md.";
    redirect(`/workspaces?create=error&message=${encodeURIComponent(message)}`);
  }

  const membershipResult = await supabase.from("workspace_members").insert({
    workspace_id: createdWorkspaceId,
    user_id: user.id,
    role: "owner",
  });

  if (membershipResult.error) {
    await supabase.from("workspaces").delete().eq("id", createdWorkspaceId);
    redirect(
      `/workspaces?create=error&message=${encodeURIComponent(
        membershipResult.error.message,
      )}`,
    );
  }

  const profileRoleResult = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: "presidencia" | "secretaria" | "lider" | "visualizador" }>();

  if (!profileRoleResult.error && profileRoleResult.data?.role === "visualizador") {
    await supabase
      .from("profiles")
      .update({ role: "lider" })
      .eq("id", user.id);
  }

  const profileUpdateResult = await supabase
    .from("profiles")
    .update({ current_workspace_id: createdWorkspaceId })
    .eq("id", user.id);

  if (profileUpdateResult.error) {
    redirect(
      `/workspaces?create=error&message=${encodeURIComponent(
        profileUpdateResult.error.message,
      )}`,
    );
  }

  revalidatePath("/workspaces");
  revalidatePath("/dashboard");
  redirect("/workspaces?create=success&message=Workspace%20criado%20com%20sucesso.");
}

export async function switchWorkspaceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Workspace%20invalido.");
  }

  const membershipCheck = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ workspace_id: string }>();

  if (membershipCheck.error || !membershipCheck.data) {
    const message = membershipCheck.error?.message || "Voce nao faz parte deste workspace.";
    redirect(`/workspaces?create=error&message=${encodeURIComponent(message)}`);
  }

  const updateResult = await supabase
    .from("profiles")
    .update({ current_workspace_id: workspaceId })
    .eq("id", user.id);

  if (updateResult.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(updateResult.error.message)}`);
  }

  revalidatePath("/workspaces");
  revalidatePath("/dashboard");
  revalidatePath("/organizations");
  revalidatePath("/roles");
  revalidatePath("/people");
  revalidatePath("/tasks");
  revalidatePath("/meetings");
  revalidatePath("/goals");
  revalidatePath("/organograma");
  redirect("/workspaces?create=success&message=Workspace%20ativo%20atualizado.");
}

export async function updateWorkspaceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const rawName = String(formData.get("name") || "").trim();

  if (!workspaceId || !rawName) {
    redirect("/workspaces?create=error&message=Workspace%20ou%20nome%20invalido.");
  }

  const membershipCheck = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "owner" | "admin" | "member" | "viewer" }>();

  if (
    membershipCheck.error ||
    !membershipCheck.data ||
    (membershipCheck.data.role !== "owner" && membershipCheck.data.role !== "admin")
  ) {
    redirect(
      "/workspaces?create=error&message=Voce%20nao%20tem%20permissao%20para%20editar%20este%20workspace.",
    );
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: rawName })
    .eq("id", workspaceId);

  if (error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/workspaces");
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/workspaces?create=success&message=Workspace%20atualizado%20com%20sucesso.");
}

export async function deleteWorkspaceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const confirmName = String(formData.get("confirm_name") || "").trim();

  if (!workspaceId) {
    redirect("/workspaces?create=error&message=Workspace%20invalido.");
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id, name, created_by")
    .eq("id", workspaceId)
    .maybeSingle<{ id: string; name: string; created_by: string | null }>();

  if (workspaceResult.error || !workspaceResult.data) {
    redirect("/workspaces?create=error&message=Workspace%20nao%20encontrado.");
  }

  if (confirmName !== workspaceResult.data.name) {
    redirect(
      "/workspaces?create=error&message=Confirmacao%20invalida.%20Digite%20o%20nome%20exato%20do%20workspace.",
    );
  }

  const membershipResult = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "owner" | "admin" | "member" | "viewer" }>();

  if (
    membershipResult.error ||
    !membershipResult.data ||
    membershipResult.data.role !== "owner"
  ) {
    redirect(
      "/workspaces?create=error&message=Somente%20owner%20pode%20remover%20workspace.",
    );
  }

  const allMemberships = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .returns<{ workspace_id: string }[]>();

  if (allMemberships.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(allMemberships.error.message)}`);
  }

  const options = allMemberships.data || [];
  if (options.length <= 1) {
    redirect(
      "/workspaces?create=error&message=Voce%20precisa%20ter%20ao%20menos%202%20workspaces%20para%20remover%20um.",
    );
  }

  const fallbackWorkspaceId =
    options.find((item) => item.workspace_id !== workspaceId)?.workspace_id || null;

  const profileUpdate = await supabase
    .from("profiles")
    .update({ current_workspace_id: fallbackWorkspaceId })
    .eq("id", user.id);

  if (profileUpdate.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(profileUpdate.error.message)}`);
  }

  const deleteResult = await supabase.rpc("delete_workspace_if_owner", {
    p_workspace_id: workspaceId,
    p_actor_user_id: user.id,
  });
  if (deleteResult.error) {
    redirect(
      `/workspaces?create=error&message=${encodeURIComponent(
        `${deleteResult.error.message}. Rode o SQL de RPC delete_workspace_if_owner no doc SUPABASE_WORKSPACES_SETUP.md.`,
      )}`,
    );
  }
  if (!deleteResult.data) {
    redirect(
      "/workspaces?create=error&message=Remocao%20nao%20confirmada.%20Somente%20owner%20pode%20remover%20workspace%20ou%20o%20workspace%20nao%20existe.",
    );
  }

  revalidatePath("/workspaces");
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/workspaces?create=success&message=Workspace%20removido%20com%20sucesso.");
}

export async function addWorkspaceMemberAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") || "member").trim() as WorkspaceMemberRole;
  const allowedRoles: WorkspaceMemberRole[] = ["admin", "member", "viewer"];

  if (!workspaceId || !email || !allowedRoles.includes(role)) {
    redirect("/workspaces?create=error&message=Dados%20invalidos%20para%20compartilhar%20workspace.");
  }

  const actorMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (
    actorMembership.error ||
    !actorMembership.data ||
    (actorMembership.data.role !== "owner" && actorMembership.data.role !== "admin")
  ) {
    redirect(
      "/workspaces?create=error&message=Voce%20nao%20tem%20permissao%20para%20gerenciar%20membros.",
    );
  }

  const targetProfile = await supabase.rpc("find_profile_for_workspace_invite", {
    p_workspace_id: workspaceId,
    p_email: email,
  });

  if (targetProfile.error) {
    redirect(
      `/workspaces?create=error&message=${encodeURIComponent(
        `${targetProfile.error.message}. Rode o SQL de RPC de membros no doc SUPABASE_WORKSPACES_SETUP.md.`,
      )}`,
    );
  }

  const targetRow = Array.isArray(targetProfile.data)
    ? targetProfile.data[0]
    : null;

  if (!targetRow || !targetRow.id) {
    redirect(
      "/workspaces?create=error&message=Conta%20nao%20encontrada.%20Se%20foi%20criada%20direto%20no%20Supabase%2C%20sincronize%20profiles%20com%20auth.users%20ou%20faca%20login%20uma%20vez.",
    );
  }

  const insertMembership = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: targetRow.id,
    role,
  });

  if (insertMembership.error?.code === "23505") {
    redirect("/workspaces?create=error&message=Este%20usuario%20ja%20participa%20do%20workspace.");
  }
  if (insertMembership.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(insertMembership.error.message)}`);
  }

  if (!targetRow.current_workspace_id) {
    await supabase
      .from("profiles")
      .update({ current_workspace_id: workspaceId })
      .eq("id", targetRow.id);
  }

  revalidatePath("/workspaces");
  revalidatePath("/");
  redirect("/workspaces?create=success&message=Membro%20adicionado%20com%20sucesso.");
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const memberUserId = String(formData.get("member_user_id") || "").trim();
  const role = String(formData.get("role") || "").trim() as WorkspaceMemberRole;
  const allowedRoles: WorkspaceMemberRole[] = ["admin", "member", "viewer"];

  if (!workspaceId || !memberUserId || !allowedRoles.includes(role)) {
    redirect("/workspaces?create=error&message=Dados%20invalidos%20para%20atualizar%20membro.");
  }

  const actorMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (
    actorMembership.error ||
    !actorMembership.data ||
    (actorMembership.data.role !== "owner" && actorMembership.data.role !== "admin")
  ) {
    redirect(
      "/workspaces?create=error&message=Voce%20nao%20tem%20permissao%20para%20gerenciar%20membros.",
    );
  }

  const targetMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (targetMembership.error || !targetMembership.data) {
    redirect("/workspaces?create=error&message=Membro%20nao%20encontrado.");
  }

  if (targetMembership.data.role === "owner") {
    redirect("/workspaces?create=error&message=Nao%20e%20possivel%20alterar%20o%20owner%20por%20aqui.");
  }

  const updateMembership = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId);

  if (updateMembership.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(updateMembership.error.message)}`);
  }

  revalidatePath("/workspaces");
  redirect("/workspaces?create=success&message=Papel%20do%20membro%20atualizado.");
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const memberUserId = String(formData.get("member_user_id") || "").trim();

  if (!workspaceId || !memberUserId) {
    redirect("/workspaces?create=error&message=Dados%20invalidos%20para%20remover%20membro.");
  }

  const actorMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (
    actorMembership.error ||
    !actorMembership.data ||
    (actorMembership.data.role !== "owner" && actorMembership.data.role !== "admin")
  ) {
    redirect(
      "/workspaces?create=error&message=Voce%20nao%20tem%20permissao%20para%20gerenciar%20membros.",
    );
  }

  if (memberUserId === user.id && actorMembership.data.role === "owner") {
    redirect(
      "/workspaces?create=error&message=Owner%20nao%20pode%20se%20remover%20do%20workspace%20atual.",
    );
  }

  const targetMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (targetMembership.error || !targetMembership.data) {
    redirect("/workspaces?create=error&message=Membro%20nao%20encontrado.");
  }

  if (targetMembership.data.role === "owner") {
    redirect("/workspaces?create=error&message=Nao%20e%20possivel%20remover%20o%20owner%20por%20aqui.");
  }

  const removeMembership = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId);

  if (removeMembership.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(removeMembership.error.message)}`);
  }

  revalidatePath("/workspaces");
  redirect("/workspaces?create=success&message=Membro%20removido%20com%20sucesso.");
}

export async function transferWorkspaceOwnershipAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = String(formData.get("workspace_id") || "").trim();
  const targetUserId = String(formData.get("target_user_id") || "").trim();

  if (!workspaceId || !targetUserId) {
    redirect(
      "/workspaces?create=error&message=Dados%20invalidos%20para%20transferencia%20de%20ownership.",
    );
  }

  const actorMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (actorMembership.error || !actorMembership.data || actorMembership.data.role !== "owner") {
    redirect(
      "/workspaces?create=error&message=Somente%20owner%20pode%20transferir%20ownership.",
    );
  }

  if (targetUserId === user.id) {
    redirect("/workspaces?create=error&message=Escolha%20outro%20membro%20como%20novo%20owner.");
  }

  const targetMembership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (targetMembership.error || !targetMembership.data) {
    redirect("/workspaces?create=error&message=Membro%20de%20destino%20nao%20encontrado.");
  }

  const promoteTarget = await supabase
    .from("workspace_members")
    .update({ role: "owner" })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (promoteTarget.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(promoteTarget.error.message)}`);
  }

  const demoteActor = await supabase
    .from("workspace_members")
    .update({ role: "admin" })
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id);

  if (demoteActor.error) {
    redirect(`/workspaces?create=error&message=${encodeURIComponent(demoteActor.error.message)}`);
  }

  revalidatePath("/workspaces");
  redirect(
    "/workspaces?create=success&message=Ownership%20transferido%20com%20sucesso.%20Voce%20agora%20e%20admin.",
  );
}
