export type RunKind =
  "Easy run" | "Tempo run" | "Intervals" | "Long run" | "Recovery run";
export type Run = {
  id: string;
  title: string;
  date: string;
  distance: number;
  duration: number;
  heartRate: number | null;
  elevation: number;
  effort: number | null;
  pain: boolean;
  notes: string;
  kind: RunKind;
  source: "Manual" | "Strava" | "Apple Health" | "Demo";
};
export type Profile = {
  name: string;
  raceName: string;
  raceDate: string;
  goalTime: string;
  weeklyKm: number;
  days: number;
};
export type CheckIn = {
  date: string;
  energy: number;
  soreness: number;
  sleep: number;
  pain: boolean;
};
export type Session = {
  id: string;
  date: string;
  kind: RunKind | "Strength" | "Rest day" | "Race day";
  title: string;
  distance: number;
  description: string;
  minutes: number;
};
export type Adjustment = {
  id: string;
  date: string;
  title: string;
  reason: string;
  sessionId: string;
  sessionDate: string;
  before: string;
  after: Pick<
    Session,
    "kind" | "title" | "distance" | "description" | "minutes"
  >;
  status: "pending" | "accepted" | "dismissed";
};
export type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mode?: "local" | "ai";
};
export type Meal = {
  id: string;
  name: string;
  carbs: number;
  protein: number;
  date: string;
};
export type StrideState = {
  version: 1;
  demo: boolean;
  profile: Profile;
  runs: Run[];
  checkins: CheckIn[];
  adjustments: Adjustment[];
  overrides: Record<string, Adjustment["after"]>;
  strength: string[];
  water: Record<string, number>;
  meals: Meal[];
  messages: Message[];
  cloudCoach: boolean;
  healthImportedAt: string | null;
};
export type View =
  | "Overview"
  | "Training plan"
  | "Activities"
  | "AI coach"
  | "Nutrition"
  | "Strength & recovery"
  | "Connections"
  | "Settings";
