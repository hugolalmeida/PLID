import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  runNotificationsSweep,
  sendQueuedNotifications,
} from "@/lib/notifications/service";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "missing_server_secret" as const };
  }

  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const matched = bearerToken === secret;

  return matched ? { ok: true as const } : { ok: false, reason: "invalid_secret" as const };
}

async function handler(request: NextRequest) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    if (auth.reason === "missing_server_secret") {
      return NextResponse.json(
        { ok: false, error: "CRON_SECRET nao carregado no servidor." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "unauthorized: secret invalido." },
      { status: 401 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const sweep = await runNotificationsSweep(supabase);
    const dispatch = await sendQueuedNotifications(supabase);

    return NextResponse.json({
      ok: true,
      sweep,
      dispatch,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
