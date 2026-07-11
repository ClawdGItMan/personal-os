-- Seed fixture data for the simulator dev-login user (sim@maxos.dev).
-- Values mirror the locked ivy/porcelain design reference so simulator
-- screenshots are directly comparable to the spec. Idempotent-ish: wipes and
-- re-seeds this user's rows only. Run via Supabase MCP execute_sql (bypasses
-- RLS as postgres; all rows are scoped to the sim user's id).
DO $$
DECLARE
  uid uuid;
  today date;
  mstart date;
  h_train uuid;
  h_journal uuid;
  acct_cash uuid; acct_brok uuid; acct_btc uuid; acct_mort uuid;
  d int;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'sim@maxos.dev';
  IF uid IS NULL THEN RAISE EXCEPTION 'sim user missing'; END IF;
  today := (now() AT TIME ZONE 'America/New_York')::date;
  mstart := date_trunc('month', now() AT TIME ZONE 'America/New_York')::date;

  -- wipe this user's rows (fixture reset)
  DELETE FROM public.habit_logs WHERE user_id = uid;
  DELETE FROM public.habits WHERE user_id = uid;
  DELETE FROM public.tasks WHERE user_id = uid;
  DELETE FROM public.calendar_events WHERE user_id = uid;
  DELETE FROM public.journal_entries WHERE user_id = uid;
  DELETE FROM public.workouts WHERE user_id = uid;
  DELETE FROM public.health_snapshots WHERE user_id = uid;
  DELETE FROM public.transactions WHERE user_id = uid;
  DELETE FROM public.budgets WHERE user_id = uid;
  DELETE FROM public.finance_snapshots WHERE user_id = uid;
  DELETE FROM public.finance_accounts WHERE user_id = uid;
  DELETE FROM public.focus_sessions WHERE user_id = uid;
  DELETE FROM public.assistant_briefs WHERE user_id = uid;
  DELETE FROM public.agent_messages WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  INSERT INTO public.profiles (id, name, initials, role, timezone, theme)
  VALUES (uid, 'Max', 'MA', 'Founder', 'America/New_York', 'dark');

  -- 30 days of health history + today's design-reference snapshot
  FOR d IN 1..30 LOOP
    INSERT INTO public.health_snapshots (user_id, date, recovery_score, hrv, rhr, sleep_hours, sleep_score, strain, weight, source)
    VALUES (uid, today - d,
      55 + ((d * 7) % 35),                -- recovery 55..89
      56 + ((d * 3) % 12),                -- hrv 56..67
      47 + (d % 4),                       -- rhr 47..50
      6.3 + ((d % 5) * 0.5),              -- sleep 6.3..8.3
      70 + ((d * 5) % 25),                -- quality 70..94
      8 + (d % 9),                        -- strain
      182.0 + ((d % 7) * 0.35),           -- weight drift
      'whoop');
  END LOOP;
  INSERT INTO public.health_snapshots (user_id, date, recovery_score, hrv, rhr, sleep_hours, sleep_score, strain, weight,
    sleep_start, sleep_end, sleep_deep_min, sleep_rem_min, sleep_light_min, sleep_awake_min, source)
  VALUES (uid, today, 72, 64, 48, 7.2, 87, 10.4, 182.4,
    ((today - 1) + time '22:58') AT TIME ZONE 'America/New_York',
    (today + time '06:10') AT TIME ZONE 'America/New_York',
    72, 108, 252, 20, 'whoop');

  -- workouts: this week + history
  INSERT INTO public.workouts (user_id, source, external_id, sport, started_at, ended_at, duration_sec, strain, avg_hr, max_hr, energy_kj) VALUES
    (uid, 'whoop', 'sim-w-today', 'weightlifting', (today + time '11:00') AT TIME ZONE 'America/New_York', (today + time '11:52') AT TIME ZONE 'America/New_York', 3120, 12.5, 132, 171, 1450),
    (uid, 'whoop', 'sim-w-1', 'running',       ((today - 2) + time '07:15') AT TIME ZONE 'America/New_York', ((today - 2) + time '07:49') AT TIME ZONE 'America/New_York', 2040, 10.1, 148, 176, 1180),
    (uid, 'whoop', 'sim-w-2', 'weightlifting', ((today - 3) + time '11:05') AT TIME ZONE 'America/New_York', ((today - 3) + time '12:00') AT TIME ZONE 'America/New_York', 3300, 13.1, 129, 168, 1520),
    (uid, 'whoop', 'sim-w-3', 'weightlifting', ((today - 5) + time '17:30') AT TIME ZONE 'America/New_York', ((today - 5) + time '18:22') AT TIME ZONE 'America/New_York', 3120, 11.8, 127, 164, 1390),
    (uid, 'whoop', 'sim-w-4', 'running',       ((today - 9) + time '07:20') AT TIME ZONE 'America/New_York', ((today - 9) + time '07:55') AT TIME ZONE 'America/New_York', 2100, 9.8, 151, 179, 1210),
    (uid, 'whoop', 'sim-w-5', 'weightlifting', ((today - 10) + time '11:00') AT TIME ZONE 'America/New_York', ((today - 10) + time '11:58') AT TIME ZONE 'America/New_York', 3480, 12.9, 130, 169, 1500),
    (uid, 'whoop', 'sim-w-6', 'weightlifting', ((today - 12) + time '16:45') AT TIME ZONE 'America/New_York', ((today - 12) + time '17:40') AT TIME ZONE 'America/New_York', 3300, 12.2, 128, 166, 1460);

  -- calendar: today + tomorrow
  INSERT INTO public.calendar_events (user_id, title, sub, starts_at, ends_at, source, external_id) VALUES
    (uid, 'Standup', 'OPS', (today + time '09:30') AT TIME ZONE 'America/New_York', (today + time '09:45') AT TIME ZONE 'America/New_York', 'google_calendar', 'sim-e-1'),
    (uid, '1:1 · Sarah K', 'CAL', (today + time '10:00') AT TIME ZONE 'America/New_York', (today + time '10:30') AT TIME ZONE 'America/New_York', 'google_calendar', 'sim-e-2'),
    (uid, 'Sequoia call', 'CAL', (today + time '15:00') AT TIME ZONE 'America/New_York', (today + time '15:45') AT TIME ZONE 'America/New_York', 'google_calendar', 'sim-e-3'),
    (uid, 'Board prep', 'CAL', ((today + 1) + time '10:00') AT TIME ZONE 'America/New_York', ((today + 1) + time '11:00') AT TIME ZONE 'America/New_York', 'google_calendar', 'sim-e-4');

  -- tasks
  INSERT INTO public.tasks (user_id, title, done, priority, due_at) VALUES
    (uid, 'Review compliance checklist', false, 'high', (today + time '17:00') AT TIME ZONE 'America/New_York'),
    (uid, 'Send investor update', true, 'normal', (today + time '09:00') AT TIME ZONE 'America/New_York'),
    (uid, 'Renew passport', false, 'low', ((today + 3) + time '12:00') AT TIME ZONE 'America/New_York');

  -- habits + logs
  INSERT INTO public.habits (user_id, name, sub_label, position) VALUES (uid, 'Train', 'BODY', 0) RETURNING id INTO h_train;
  INSERT INTO public.habits (user_id, name, sub_label, position) VALUES (uid, 'Journal', 'FOCUS', 1) RETURNING id INTO h_journal;
  INSERT INTO public.habit_logs (user_id, habit_id, date, done) VALUES
    (uid, h_train, today, true), (uid, h_train, today - 1, true), (uid, h_train, today - 3, true), (uid, h_train, today - 5, true),
    (uid, h_journal, today - 1, true), (uid, h_journal, today - 2, true), (uid, h_journal, today - 4, true);

  -- journal
  INSERT INTO public.journal_entries (user_id, text, written_at) VALUES
    (uid, 'Deep work on the pricing model went well — two solid blocks before lunch.', ((today - 1) + time '21:30') AT TIME ZONE 'America/New_York'),
    (uid, 'Recovery green two days straight. Push day felt strong.', ((today - 2) + time '22:05') AT TIME ZONE 'America/New_York');

  -- finance: accounts, 30d snapshots, budget, transactions
  INSERT INTO public.finance_accounts (user_id, name, type, current_value) VALUES (uid, 'Chase Checking', 'BANK', 412000) RETURNING id INTO acct_cash;
  INSERT INTO public.finance_accounts (user_id, name, type, current_value) VALUES (uid, 'Brokerage', 'EQUITY', 2414000) RETURNING id INTO acct_brok;
  INSERT INTO public.finance_accounts (user_id, name, type, current_value) VALUES (uid, 'Bitcoin', 'CRYPTO', 106000) RETURNING id INTO acct_btc;
  INSERT INTO public.finance_accounts (user_id, name, type, current_value) VALUES (uid, 'Mortgage', 'BANK', -104000) RETURNING id INTO acct_mort;
  FOR d IN 0..29 LOOP
    INSERT INTO public.finance_snapshots (user_id, account_id, date, value) VALUES
      (uid, acct_cash, today - d, 412000 - (d * 180)),
      (uid, acct_brok, today - d, 2414000 - (d * 2100)),
      (uid, acct_btc,  today - d, 106000 - (d * 260) + ((d % 5) * 400)),
      (uid, acct_mort, today - d, -104000 - (d * 90));
  END LOOP;
  INSERT INTO public.budgets (user_id, month, amount) VALUES (uid, mstart, 12000);
  INSERT INTO public.transactions (user_id, account_id, occurred_at, name, amount, category, method) VALUES
    (uid, acct_cash, (today + time '11:42') AT TIME ZONE 'America/New_York', 'Acme Ltd · wire in', 12500, 'Income', 'WIRE'),
    (uid, acct_cash, (today + time '09:15') AT TIME ZONE 'America/New_York', 'Blue Bottle', -7.40, 'Coffee', 'CARD'),
    (uid, acct_cash, ((today - 1) + time '18:20') AT TIME ZONE 'America/New_York', 'Equinox', -210, 'Fitness', 'CARD'),
    (uid, acct_cash, ((today - 1) + time '03:05') AT TIME ZONE 'America/New_York', 'AWS', -1842, 'Infra', 'ACH'),
    (uid, acct_cash, (GREATEST(mstart, today - 4) + time '10:00') AT TIME ZONE 'America/New_York', 'Contractor · design', -1800, 'Team', 'ACH'),
    (uid, acct_cash, (GREATEST(mstart, today - 5) + time '08:00') AT TIME ZONE 'America/New_York', 'Rent', -2400, 'Housing', 'ACH'),
    (uid, acct_cash, (GREATEST(mstart, today - 6) + time '14:12') AT TIME ZONE 'America/New_York', 'United Airlines', -620, 'Travel', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 3) + time '12:40') AT TIME ZONE 'America/New_York', 'Whole Foods', -184.20, 'Food', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 2) + time '19:30') AT TIME ZONE 'America/New_York', 'Delta', -890, 'Travel', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 2) + time '13:00') AT TIME ZONE 'America/New_York', 'Amazon', -156, 'Shopping', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 1) + time '09:00') AT TIME ZONE 'America/New_York', 'Verizon', -95, 'Utilities', 'ACH'),
    (uid, acct_cash, (GREATEST(mstart, today - 3) + time '11:00') AT TIME ZONE 'America/New_York', 'Uber', -48.50, 'Transport', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 4) + time '13:30') AT TIME ZONE 'America/New_York', 'Chipotle', -34, 'Food', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 5) + time '16:00') AT TIME ZONE 'America/New_York', 'OpenAI', -20, 'Tools', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 6) + time '10:30') AT TIME ZONE 'America/New_York', 'Apple', -9.99, 'Tools', 'CARD'),
    (uid, acct_cash, (GREATEST(mstart, today - 1) + time '15:45') AT TIME ZONE 'America/New_York', 'Misc', -61, 'Other', 'CARD');

  -- focus sessions: 12-day streak, today completed morning block
  FOR d IN 0..11 LOOP
    INSERT INTO public.focus_sessions (user_id, started_at, ended_at, planned_minutes, label, source) VALUES
      (uid,
       ((today - d) + time '07:10') AT TIME ZONE 'America/New_York',
       ((today - d) + time '07:10') AT TIME ZONE 'America/New_York' + ((45 + (d * 7) % 50) || ' minutes')::interval,
       50, CASE WHEN d = 0 THEN 'Deep work — pricing model' ELSE 'Deep work' END, 'manual');
  END LOOP;
END $$;
SELECT 'seeded' AS status, count(*) AS txns FROM public.transactions t JOIN auth.users u ON u.id = t.user_id WHERE u.email = 'sim@maxos.dev';