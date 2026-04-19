import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_update"
  | "sync";

type AuditLogInput = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  payload?: Record<string, unknown> | null;
};

export async function logAuditEvent(
  supabase: SupabaseClient,
  input: AuditLogInput,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let actorName: string | null = null;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; email: string | null }>();

      actorName = profile?.full_name?.trim() || profile?.email?.trim() || null;
    }

    const payloadWithActor = {
      ...(input.payload || {}),
      _actor_name: actorName,
    };

    const { error } = await supabase.from("audit_logs").insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_user_id: user?.id || null,
      payload: payloadWithActor,
    });

    if (error) {
      console.error("[audit] insert failed", error.message);
    }
  } catch (error) {
    console.error("[audit] unexpected error", error);
  }
}
