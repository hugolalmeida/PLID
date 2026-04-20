import { type SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export type WorkspaceContextResult = {
  enabled: boolean;
  setupMessage?: string;
  currentWorkspaceId: string | null;
  options: WorkspaceOption[];
};

type ProfileWorkspaceRow = {
  current_workspace_id: string | null;
};

type MembershipQueryRow = {
  workspace_id: string;
  role: WorkspaceRole;
  workspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export async function getUserWorkspaceContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceContextResult> {
  const profileResult = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", userId)
    .maybeSingle<ProfileWorkspaceRow>();

  const membershipsResult = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspace:workspaces(id, name, slug)")
    .eq("user_id", userId)
    .returns<MembershipQueryRow[]>();

  if (membershipsResult.error) {
    const message = membershipsResult.error.message.toLowerCase();
    const missingSetup =
      message.includes("workspace_members") ||
      message.includes("workspaces") ||
      message.includes("does not exist");

    return {
      enabled: false,
      setupMessage: missingSetup
        ? "Workspaces ainda nao configurados. Rode o SQL do arquivo SUPABASE_WORKSPACES_SETUP.md."
        : membershipsResult.error.message,
      currentWorkspaceId: null,
      options: [],
    };
  }

  const options = (membershipsResult.data || [])
    .filter((item) => item.workspace)
    .map((item) => ({
      id: item.workspace_id,
      name: item.workspace?.name || "Workspace",
      slug: item.workspace?.slug || "",
      role: item.role,
    }));

  const profileWorkspaceId = profileResult.data?.current_workspace_id || null;
  const currentWorkspaceId =
    (profileWorkspaceId && options.some((option) => option.id === profileWorkspaceId)
      ? profileWorkspaceId
      : options[0]?.id) || null;

  return {
    enabled: true,
    currentWorkspaceId,
    options,
  };
}

