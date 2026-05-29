/** Operator identity, derived from the `profiles` row + auth user with fallbacks. */
export type Operator = {
  name: string;
  first: string;
  initials: string;
  role: string;
  location: string;
  focus: string;
  streak: number;
  timezone: string;
  email: string;
};
