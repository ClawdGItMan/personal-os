import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/callback");
  // Public pages viewable without a session — e.g. the privacy policy linked from
  // the WHOOP/Google OAuth consent screens (an external user must be able to read
  // it). Unlike auth routes, these do NOT bounce a logged-in user to /dashboard.
  const isPublicRoute = pathname === "/privacy";
  // Vercel Cron sync endpoints (e.g. /api/whoop/sync, /api/google-calendar/sync,
  // and any future integration's */sync). Vercel invokes these with an
  // `Authorization: Bearer $CRON_SECRET` header and NO Supabase session cookie,
  // so the session check below would 307-redirect them to /login. Because Vercel
  // Cron does not follow redirects, the scheduled sync would never run. We let
  // these fall through to their own route handler, which enforces a constant-time
  // CRON_SECRET Bearer check (returns 401 on any non-matching request). The
  // startsWith("/api/") + endsWith("/sync") shape auto-covers future crons
  // (Strava / Apple Health / Plaid), so this class of bug cannot silently recur.
  const isCronSyncRoute =
    pathname.startsWith("/api/") && pathname.endsWith("/sync");

  if (!user && !isAuthRoute && !isPublicRoute && !isCronSyncRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
