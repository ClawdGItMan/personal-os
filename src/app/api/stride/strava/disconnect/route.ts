import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieOptions, sameOrigin, stravaCookie } from "@/lib/stride/server";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  (await cookies()).set(stravaCookie, "", { ...cookieOptions, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
