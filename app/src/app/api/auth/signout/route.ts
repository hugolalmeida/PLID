import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const target = next && next.startsWith("/") ? next : "/login";

  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
