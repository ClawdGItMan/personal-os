import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Personal OS",
  description: "How Personal OS handles data from connected services like WHOOP and Google.",
};

const EFFECTIVE_DATE = "June 8, 2026";
const CONTACT = "max@elosolutions.org";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      "Personal OS is a private, single-user personal dashboard operated by an individual (Max Allaire) for personal use. It is not a commercial product and has no other users. This policy explains what data it accesses from services you connect, how that data is used, and how you can remove it.",
    ],
  },
  {
    title: "What data we access",
    body: [
      "Personal OS only accesses data from a third-party service after you explicitly authorize it through that service's OAuth consent screen. With your authorization it reads:",
      "• WHOOP — your daily recovery score, sleep performance and duration, day strain, heart-rate variability (HRV), resting heart rate, and workout summaries (sport, start/end time, duration, strain, average and max heart rate, and energy). Read-only access; Personal OS never writes to WHOOP.",
      "• Google Calendar — your calendar event details, read-only (if connected).",
      "It also stores information you enter yourself in the dashboard (for example weight, training sessions, and notes).",
    ],
  },
  {
    title: "How we use it",
    body: [
      "Your data is used for one purpose: to display your own information back to you inside your personal dashboard. It is never sold, rented, or shared with third parties, and it is never used for advertising or for building profiles.",
    ],
  },
  {
    title: "Storage & security",
    body: [
      "Data is stored in a private PostgreSQL database (Supabase) and the application is hosted on Vercel. OAuth access and refresh tokens are encrypted at rest using AES-256-GCM before they are stored, and are never displayed or logged. Access to the database is restricted to the account owner.",
      "Data is processed only by the infrastructure providers required to run the application — Supabase (database) and Vercel (hosting) — under their respective terms; it is not disclosed to anyone else.",
    ],
  },
  {
    title: "Revoking access & deleting data",
    body: [
      "You can disconnect WHOOP at any time from the Settings page in Personal OS, which deletes the stored WHOOP tokens and stops all syncing. You can also revoke Personal OS's access directly from your WHOOP account at any time.",
      `To request deletion of any health data already stored, email ${CONTACT} and it will be removed.`,
    ],
  },
  {
    title: "Your rights",
    body: [
      `You may request access to, correction of, or deletion of your data at any time by contacting ${CONTACT}.`,
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "This policy may be updated from time to time. The effective date above reflects the most recent version.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[color:var(--os-bg)] px-6 py-16 text-[color:var(--os-fg-2)]">
      <article className="mx-auto max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--os-fg-4)]">
          Personal OS
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-newsreader)] text-3xl text-[color:var(--os-fg-1)]">
          Privacy Policy
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--os-fg-3)]">
                {section.title}
              </h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-[color:var(--os-fg-2)]">
                {section.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-[color:var(--os-line-1)] pt-6 text-sm text-[color:var(--os-fg-3)]">
          Questions or data-deletion requests:{" "}
          <a
            href={`mailto:${CONTACT}`}
            className="text-[color:var(--os-accent)] underline underline-offset-2"
          >
            {CONTACT}
          </a>
        </p>
      </article>
    </main>
  );
}
