export type NavTab = {
  label: string;
  href: string;
  mobileLabel?: string;
  icon?: string;
};

/** Web 3-zone top nav — 6 tabs. */
export const WEB_TABS: NavTab[] = [
  { label: "HOME", href: "/dashboard" },
  { label: "FINANCE", href: "/finance" },
  { label: "HEALTH", href: "/health" },
  { label: "TRAIN", href: "/train" },
  { label: "SOCIAL", href: "/social" },
  { label: "JOURNAL", href: "/journal" },
];

/** Mobile bottom nav — 4 tabs (Home / Money / Body / Agent). */
export const MOBILE_TABS: NavTab[] = [
  { label: "HOME", mobileLabel: "Home", href: "/dashboard", icon: "◉" },
  { label: "FINANCE", mobileLabel: "Money", href: "/finance", icon: "$" },
  { label: "HEALTH", mobileLabel: "Body", href: "/health", icon: "♡" },
  { label: "AGENT", mobileLabel: "Agent", href: "/agent", icon: "✦" },
];
