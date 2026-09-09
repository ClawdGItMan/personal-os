import { NextResponse } from "next/server";
import { readStravaTokens, stravaConfigured } from "@/lib/stride/server";
export async function GET() {
  return NextResponse.json(
    {
      stravaConfigured: stravaConfigured(),
      stravaConnected: Boolean(await readStravaTokens()),
      aiConfigured:
        Boolean(process.env.OPENAI_API_KEY) &&
        process.env.NODE_ENV === "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
