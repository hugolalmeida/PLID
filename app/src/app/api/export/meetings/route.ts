import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCsv } from "@/lib/export/csv";

type MeetingRow = {
  id: string;
  title: string;
  date: string;
  status: string | null;
  notes: string | null;
  minutes: string | null;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let { data, error } = await supabase
    .from("meetings")
    .select("id, title, date, status, notes, minutes")
    .order("date", { ascending: false })
    .returns<MeetingRow[]>();

  if (error && error.message.toLowerCase().includes("status")) {
    const fallback = await supabase
      .from("meetings")
      .select("id, title, date, notes, minutes")
      .order("date", { ascending: false })
      .returns<Array<Omit<MeetingRow, "status">>>();

    data = (fallback.data || []).map((item) => ({ ...item, status: null }));
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: unknown[][] = [
    ["ID", "Titulo", "Data", "Status", "Notas", "Registro/Documento"],
  ];

  for (const meeting of data || []) {
    rows.push([
      meeting.id,
      meeting.title,
      meeting.date,
      meeting.status || "",
      meeting.notes || "",
      meeting.minutes || "",
    ]);
  }

  const csv = buildCsv(rows);
  const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reunioes-${dateTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

