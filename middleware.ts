import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Stride is a separate, local-first workspace. Its integration routes enforce
  // their own browser-session and OAuth checks and do not use Personal OS auth.
  if (request.nextUrl.pathname === "/stride" || request.nextUrl.pathname.startsWith("/api/stride/")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
