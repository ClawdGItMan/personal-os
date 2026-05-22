// Demo data for Max's Personal OS
// Realistic + aspirational

window.MOS_DATA = {
  operator: {
    name: "Max",
    last: "Allaire",
    initials: "MA",
    role: "Founder",
    location: "New York City",
    focus: "Finding the idea.",
    streak: 47,
    timezone: "EDT · UTC-4",
  },

  finance: {
    netWorth: 2_148_320,
    change30d: 8.42,
    daily: 1_240,
    dailyPct: 0.06,
    monthly: 167_410,
    monthlyPct: 8.42,
    // sparkline points (28 days)
    spark: [0.42,0.40,0.43,0.45,0.44,0.47,0.46,0.49,0.51,0.50,0.53,0.55,0.54,0.57,0.61,0.63,0.62,0.65,0.69,0.72,0.71,0.74,0.78,0.81,0.83,0.87,0.91,0.94],
    accounts: [
      { name: "Chase Checking",        type: "BANK",   value: 48_220, delta: "+1.2%" },
      { name: "Wealthfront Cash",      type: "HYSA",   value: 122_900, delta: "+0.4%" },
      { name: "Robinhood Brokerage",   type: "EQUITY", value: 614_330, delta: "+12.8%" },
      { name: "Fidelity Roth IRA",     type: "RETIRE", value: 184_710, delta: "+9.1%" },
      { name: "Coinbase",              type: "CRYPTO", value: 312_440, delta: "+22.6%" },
      { name: "Schwab Index",          type: "EQUITY", value: 718_200, delta: "+5.7%" },
      { name: "Angel: Decagon",        type: "PRIVATE",value: 75_000, delta: "0%" },
      { name: "Treasury Direct",       type: "T-BILLS",value: 72_520, delta: "+0.1%" },
    ],
  },

  tasks: [
    { id: 1, title: "Talk to 3 founders re: agent infra",  tags: ["RESEARCH", "PRIORITY"], star: true,  done: false },
    { id: 2, title: "Draft v3 of the consumer thesis memo", tags: ["WRITING"], star: true, done: false },
    { id: 3, title: "Push next product update",            tags: ["PERSONAL"], star: true, done: false },
    { id: 4, title: "Reply: Lily, Hugo, Tomás",            tags: ["INBOX"], star: false, done: true },
    { id: 5, title: "Wire $20k to Schwab",                 tags: ["FINANCE"], star: false, done: false },
    { id: 6, title: "Pickleball — 6:30 court 3",           tags: ["LIFE"], star: false, done: false },
  ],

  habits: [
    { id: "gym",    name: "Gym",              sub: "FITNESS",            done: true,  streak: 28 },
    { id: "supps",  name: "Supplements",      sub: "HEALTH · 0/3",       done: false, streak: 12 },
    { id: "deep",   name: "Deep work",        sub: "OUTPUT · 0/4",       done: false, streak: 9 },
    { id: "read",   name: "Read 20 pages",    sub: "MIND · 0/1",         done: true,  streak: 41 },
    { id: "write",  name: "Write 500 words",  sub: "OUTPUT · 0/1",       done: false, streak: 6 },
    { id: "sleep",  name: "Wind down · 10pm", sub: "EVENING · 0/1",      done: false, streak: 3 },
  ],

  calendar: {
    month: "MAY 2026",
    week: [
      { dow: "MON", num: 18, has: true  },
      { dow: "TUE", num: 19, has: true  },
      { dow: "WED", num: 20, has: true  },
      { dow: "THU", num: 21, has: true, today: true, active: true },
      { dow: "FRI", num: 22, has: true  },
      { dow: "SAT", num: 23, has: false },
      { dow: "SUN", num: 24, has: true  },
    ],
    events: [
      { section: "MORNING",   time: "07:00",          title: "Wake · cold plunge",     sub: "RITUAL",      loc: "" },
      { section: null,        time: "08:30 –\n09:30", title: "Train · push day",       sub: "EQUINOX · 19TH",  loc: "GYM" },
      { section: null,        time: "10:00 –\n11:00", title: "1:1 · Sarah K",          sub: "INVESTOR · PROSPECT", loc: "MEET" },
      { section: null,        time: "11:30 –\n12:30", title: "Deep work · thesis v3",  sub: "BRAIN",        loc: "FOCUS" },
      { section: "NOW · 14:32", time: "14:00 –\n15:30", title: "Deep work · agent infra teardown", sub: "BRAIN · PRIORITY",     loc: "DESK", now: true },
      { section: null,        time: "16:00 –\n16:30", title: "Standup · Helix portfolio",        sub: "OPS",            loc: "MEET" },
      { section: "EVENING",   time: "18:30 –\n20:00", title: "Pickleball · Court 3",   sub: "WITH NICO",    loc: "PIER 36" },
      { section: null,        time: "21:00",          title: "Wind-down · journal",    sub: "RITUAL",       loc: "" },
    ],
  },

  nutrition: {
    kcal: 1842,
    kcalGoal: 2400,
    protein: 168,
    carbs: 142,
    fat: 64,
    meals: [
      { time: "07:15", name: "Greek yogurt · honey · walnuts", kcal: 420 },
      { time: "10:30", name: "Cold brew · oat",                kcal: 90 },
      { time: "13:00", name: "Chicken · rice · broccoli",      kcal: 720 },
      { time: "16:00", name: "Whey · banana",                  kcal: 312 },
    ],
  },

  health: {
    sleepScore: 88,
    sleepHrs: "7h 42m",
    hrv: 76,
    rhr: 51,
    recovery: 82,
    strain: 14.6,
    weight: 178.4,
    bodyFat: 11.2,
    steps: 8214,
    biomarkers: {
      vo2: 52.4,
      glucose: 88,
      bp: "118 / 74",
    },
  },

  workout: {
    name: "Push · A",
    week: "WEEK 6 · BLOCK 2",
    lifts: [
      { name: "Bench press",         set: "1", reps: "5", weight: "225 lb", pr: true },
      { name: "Bench press",         set: "2", reps: "5", weight: "245 lb", pr: false },
      { name: "Bench press",         set: "3", reps: "3", weight: "265 lb", pr: true },
      { name: "Overhead press",      set: "1", reps: "8", weight: "135 lb", pr: false },
      { name: "Overhead press",      set: "2", reps: "8", weight: "145 lb", pr: false },
      { name: "Incline DB press",    set: "1", reps: "10", weight: "75 lb", pr: false },
      { name: "Triceps rope ext.",   set: "1", reps: "12", weight: "55 lb", pr: false },
      { name: "Lat raises",          set: "1", reps: "15", weight: "20 lb", pr: false },
    ],
  },

  social: [
    { plat: "X",        count: "48,210", delta: "+312",  pct: "+0.7%" },
    { plat: "LINKEDIN", count: "9,820",  delta: "+44",   pct: "+0.5%" },
    { plat: "SUBSTACK", count: "3,420",  delta: "+18",   pct: "+0.5%" },
    { plat: "GITHUB",   count: "1,140",  delta: "+6",    pct: "+0.5%" },
    { plat: "IG",       count: "12,640", delta: "+89",   pct: "+0.7%" },
  ],

  agent: {
    // Conversation thread — Telegram-fed messages + agent replies
    messages: [
      { id: 1, role: "you",   time: "06:48", source: "TELEGRAM", text: "weighed in 178.4 this morning",
        chips: [] },
      { id: 2, role: "agent", time: "06:48", source: "MAX OS",
        text: "Logged. Down 1.2 lb in 7 days, on track for 175 by Jun 4.",
        chips: [{ label: "View trend", kind: "sage" }] },
      { id: 3, role: "you",   time: "08:12", source: "TELEGRAM",
        text: "wired the SAFE to Helix. 75k. Sarah handled it." },
      { id: 4, role: "agent", time: "08:13", source: "MAX OS",
        text: "Got it. Created investment record \"Decagon · $75k SAFE\" under Angel, marked Sarah as point of contact. Pulled the docs into Drive.",
        chips: [
          { label: "Investment", kind: "ember" },
          { label: "Saved to Drive", kind: "" },
        ] },
      { id: 5, role: "agent", time: "12:30", source: "MAX OS",
        text: "Quick check: you've been on the laptop for 4h 12m. Push day is at 18:30 unless you want me to move it earlier?",
        chips: [
          { label: "Move to 17:00", kind: "sage" },
          { label: "Keep it", kind: "" },
        ] },
      { id: 6, role: "you",   time: "13:08", source: "TELEGRAM",
        text: "keep it. add — talk to 3 founders re agent infra. priority." },
      { id: 7, role: "agent", time: "13:08", source: "MAX OS",
        text: "Added to Today, starred. Want me to pull 3 candidates from your CRM?",
        chips: [
          { label: "Yes, pull 3", kind: "sage" },
          { label: "Later", kind: "" },
        ] },
      { id: 8, role: "you",   time: "14:21", source: "TELEGRAM",
        text: "yes" },
      { id: 9, role: "agent", time: "14:22", source: "MAX OS",
        text: "Suggested: Hugo Park (Lattice), Tomás Reis (independent, ex-OpenAI), Lily Wen (Series A founder, agent stack). All last spoke 2+ weeks ago.",
        chips: [
          { label: "Draft intros", kind: "ember" },
          { label: "Tomorrow", kind: "" },
        ] },
    ],
    // Inline suggestions for the agent panel
    suggestions: [
      "How am I tracking vs goals?",
      "Summarize today",
      "What did I move this week?",
    ],
  },
};
