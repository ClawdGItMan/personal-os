alter table public.health_snapshots
  add column sleep_start timestamptz,
  add column sleep_end timestamptz,
  add column sleep_deep_min integer,
  add column sleep_rem_min integer,
  add column sleep_light_min integer,
  add column sleep_awake_min integer;
