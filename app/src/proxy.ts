import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const protectedRoutes = [
  "/dashboard",
  "/organograma",
  "/tasks",
  "/meetings",
  "/goals",
  "/notifications",
  "/auditoria",
  "/organizations",
  "/roles",
  "/people",
  "/workspaces",
];
const authRoutes = ["/login"];

function startsWithAny(pathname: string, routes: string[]) {
  return routes.some((route) => pathname.startsWith(route));
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && startsWithAny(pathname, protectedRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && startsWithAny(pathname, authRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/organograma/:path*",
    "/tasks/:path*",
    "/meetings/:path*",
    "/goals/:path*",
    "/notifications/:path*",
    "/auditoria/:path*",
    "/organizations/:path*",
    "/roles/:path*",
    "/people/:path*",
    "/workspaces/:path*",
    "/login",
  ],
};
