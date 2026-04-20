import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCsv } from "@/lib/export/csv";
import { getCurrentWorkspaceId } from "@/lib/workspaces/current";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  owner_person_id: string;
  organization_id: string;
  status: string;
  due_date: string;
  due_time: string | null;
  meeting_id: string | null;
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

  const [tasksResult, peopleResult, organizationsResult, meetingsResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, description, owner_person_id, organization_id, status, due_date, due_time, meeting_id",
        )
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true })
        .returns<TaskRow[]>(),
      supabase
        .from("people")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .returns<Array<{ id: string; name: string }>>(),
      supabase
        .from("organizations")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .returns<Array<{ id: string; name: string }>>(),
      supabase
        .from("meetings")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .returns<Array<{ id: string; title: string }>>(),
    ]);

  const firstError =
    tasksResult.error ||
    peopleResult.error ||
    organizationsResult.error ||
    meetingsResult.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const personMap = new Map((peopleResult.data || []).map((p) => [p.id, p.name]));
  const orgMap = new Map((organizationsResult.data || []).map((o) => [o.id, o.name]));
  const meetingMap = new Map((meetingsResult.data || []).map((m) => [m.id, m.title]));

  const rows: unknown[][] = [
    [
      "ID",
      "Titulo",
      "Descricao",
      "Responsavel",
      "Organizacao",
      "Status",
      "Prazo",
      "Horario",
      "Reuniao",
    ],
  ];

  for (const task of tasksResult.data || []) {
    rows.push([
      task.id,
      task.title,
      task.description || "",
      personMap.get(task.owner_person_id) || "",
      orgMap.get(task.organization_id) || "",
      task.status,
      task.due_date,
      task.due_time || "",
      task.meeting_id ? meetingMap.get(task.meeting_id) || "" : "",
    ]);
  }

  const csv = buildCsv(rows);
  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atividades-${dateTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
