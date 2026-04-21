import { type SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";

export function canWriteWorkspaceRole(role: WorkspaceMemberRole | null) {
  return role === "owner" || role === "admin" || role === "member";
}

export async function getWorkspaceRoleForUser(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null,
) {
  if (!workspaceId) return null;

  const membership = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle<{ role: WorkspaceMemberRole }>();

  if (membership.error) {
    throw new Error(membership.error.message);
  }

  return membership.data?.role || null;
}
