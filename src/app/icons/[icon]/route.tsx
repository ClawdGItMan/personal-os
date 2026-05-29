import { ImageResponse } from "next/og";

// Only the four declared icons are valid routes (others → 404). Served at *.png paths
// so the existing middleware matcher passes them through unauthenticated.
export const dynamicParams = false;

const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "icon-180.png": { size: 180, maskable: false },
  "icon-192.png": { size: 192, maskable: false },
  "icon-192-maskable.png": { size: 192, maskable: true },
  "icon-512.png": { size: 512, maskable: false },
  "icon-512-maskable.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((icon) => ({ icon }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ icon: string }> }) {
  const { icon } = await params;
  const cfg = ICONS[icon];
  if (!cfg) return new Response("Not found", { status: 404 });

  // Maskable icons keep the glyph inside the central safe zone; the bg fills the canvas.
  const glyph = Math.round(cfg.size * (cfg.maskable ? 0.34 : 0.46));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E1014",
          color: "#8FA67A",
          fontFamily: "monospace",
          fontWeight: 700,
          fontSize: glyph,
          letterSpacing: "-0.04em",
        }}
      >
        OS
      </div>
    ),
    { width: cfg.size, height: cfg.size },
  );
}
