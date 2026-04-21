import { type SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceCalendarIntegration = {
  enabled: boolean;
  setupMessage?: string;
  calendarId: string | null;
  timeZone: string | null;
};

type WorkspaceIntegrationRow = {
  google_calendar_id: string | null;
  google_calendar_timezone: string | null;
};

export async function getWorkspaceCalendarIntegration(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceCalendarIntegration> {
  const result = await supabase
    .from("workspace_integrations")
    .select("google_calendar_id, google_calendar_timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceIntegrationRow>();

  if (result.error) {
    const message = result.error.message.toLowerCase();
    const missingSetup =
      message.includes("workspace_integrations") || message.includes("does not exist");

    return {
      enabled: false,
      setupMessage: missingSetup
        ? "Integracoes por workspace ainda nao configuradas. Rode o SQL do arquivo SUPABASE_WORKSPACE_INTEGRATIONS_SETUP.md."
        : result.error.message,
      calendarId: null,
      timeZone: null,
    };
  }

  return {
    enabled: true,
    calendarId: result.data?.google_calendar_id || null,
    timeZone: result.data?.google_calendar_timezone || null,
  };
}
