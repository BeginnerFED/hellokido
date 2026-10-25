-- =====================================================================
-- Money period (2026-10-25)
--
-- Additive only. The workshop settles everything from one day of the month to the same day of
-- the next ("10'undan 10'una"); every money view opens on the period that holds today.
--   * app_settings 'money_period_start_day': the first day of a period, 1 to 28 (1 = calendar
--     months, the behaviour so far). Admins may update settings but not add keys, so the key is
--     added here.
-- =====================================================================

insert into public.app_settings (key, value) values
  ('money_period_start_day', '1'::jsonb)
on conflict (key) do nothing;
