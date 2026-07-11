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
  // Assistant API routes (chat/brief/act) authenticate via
  // `Authorization: Bearer <supabase access_token>` (mobile's auth model, not
  // the web app's session cookie — see `getUserClientFromBearer`), so there is
  // no session cookie for this middleware to see even on a legitimate,
  // authenticated request. Each route enforces its own 401. Exempting the
  // whole `/api/assistant/*` prefix (not just today's three routes) means
  // future assistant endpoints don't silently inherit the redirect bug.
  const isAssistantRoute = pathname.startsWith("/api/assistant/");

  if (!user && !isAuthRoute && !isPublicRoute && !isCronSyncRoute && !isAssistantRoute) {
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
