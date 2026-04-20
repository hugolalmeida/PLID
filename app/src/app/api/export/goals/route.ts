import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCsv } from "@/lib/export/csv";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  owner_person_id: string;
  period_start: string;
  period_end: string;
  target_value: number;
  current_value: number;
  status: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getCurrentWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const [goalsResult, organizationsResult, peopleResult] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, title, description, organization_id, owner_person_id, period_start, period_end, target_value, current_value, status",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .returns<GoalRow[]>(),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .returns<Array<{ id: string; name: string }>>(),
    supabase
      .from("people")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .returns<Array<{ id: string; name: string }>>(),
  ]);

  const firstError = goalsResult.error || organizationsResult.error || peopleResult.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const orgMap = new Map((organizationsResult.data || []).map((o) => [o.id, o.name]));
  const peopleMap = new Map((peopleResult.data || []).map((p) => [p.id, p.name]));

  const rows: unknown[][] = [
    [
      "ID",
      "Titulo",
      "Descricao",
      "Organizacao",
      "Responsavel",
      "Inicio",
      "Fim",
      "Meta",
      "Atual",
      "Status",
    ],
  ];

  for (const goal of goalsResult.data || []) {
    rows.push([
      goal.id,
      goal.title,
      goal.description || "",
      orgMap.get(goal.organization_id) || "",
      peopleMap.get(goal.owner_person_id) || "",
      goal.period_start,
      goal.period_end,
      goal.target_value,
      goal.current_value,
      goal.status,
    ]);
  }

  const csv = buildCsv(rows);
  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metas-${dateTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
