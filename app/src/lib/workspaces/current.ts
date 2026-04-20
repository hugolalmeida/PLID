import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileWorkspaceRow = {
  current_workspace_id: string | null;
};

type MembershipRow = {
  workspace_id: string;
};

type ProfileBootstrapRow = {
  full_name: string | null;
  email: string | null;
  role: "presidencia" | "secretaria" | "lider" | "visualizador";
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function createInitialWorkspaceIfNeeded(
  supabase: SupabaseClient,
  userId: string,
) {
  const profileResult = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .maybeSingle<ProfileBootstrapRow>();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  const baseName =
    profileResult.data?.full_name?.trim() ||
    profileResult.data?.email?.split("@")[0] ||
    "Meu Workspace";
  const baseSlug = slugify(baseName) || `workspace-${Date.now().toString(36)}`;

  let createdWorkspaceId: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.floor(Math.random() * 900 + 100)}`;
    const slug = `${baseSlug}${suffix}`;
    const candidateWorkspaceId = crypto.randomUUID();

    const insertWorkspace = await supabase.from("workspaces").insert({
      id: candidateWorkspaceId,
      name: baseName,
      slug,
      created_by: userId,
    });

    if (!insertWorkspace.error) {
      createdWorkspaceId = candidateWorkspaceId;
      break;
    }

    if (insertWorkspace.error.code !== "23505") {
      throw new Error(insertWorkspace.error.message);
    }
  }

  if (!createdWorkspaceId) {
    return null;
  }

  const membershipResult = await supabase.from("workspace_members").insert({
    workspace_id: createdWorkspaceId,
    user_id: userId,
    role: "owner",
  });

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  const updateProfile = await supabase
    .from("profiles")
    .update({ current_workspace_id: createdWorkspaceId })
    .eq("id", userId);

  if (updateProfile.error) {
    throw new Error(updateProfile.error.message);
  }

  if (profileResult.data?.role === "visualizador") {
    const elevateRoleResult = await supabase
      .from("profiles")
      .update({ role: "lider" })
      .eq("id", userId);
    if (elevateRoleResult.error) {
      throw new Error(elevateRoleResult.error.message);
    }
  }

  return createdWorkspaceId;
}

export async function getCurrentWorkspaceId(
  supabase: SupabaseClient,
  userId: string,
) {
  const profileResult = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", userId)
    .maybeSingle<ProfileWorkspaceRow>();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (profileResult.data?.current_workspace_id) {
    return profileResult.data.current_workspace_id;
  }

  const membershipResult = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  const fallbackWorkspaceId = membershipResult.data?.workspace_id || null;
  if (!fallbackWorkspaceId) {
    return createInitialWorkspaceIfNeeded(supabase, userId);
  }

  const updateResult = await supabase
    .from("profiles")
    .update({ current_workspace_id: fallbackWorkspaceId })
    .eq("id", userId);

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }

  return fallbackWorkspaceId;
}
