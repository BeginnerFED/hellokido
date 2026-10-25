-- =====================================================================
-- Evening reminder from the server (2026-10-25)
--
-- Before: each phone planned its own 18:00 notification from the count it saw the last time
-- Today was opened, so a phone that stayed closed said a stale number and still nagged after a
-- colleague had sent everything. Now the database does it:
--   * push_devices: the Expo push token of every admin phone, written and removed only through
--     register_push_device / unregister_push_device.
--   * app_settings 'evening_reminder': on or off and the time (Istanbul), editable in Settings.
--   * send_evening_reminder(): run by pg_cron every 15 minutes. In the hour after the set time it
--     counts tomorrow's seats whose family has not been reminded yet and, when there are any,
--     sends that exact number to every admin phone once that day (Expo push service, via pg_net).
--   * evening_reminder_runs: one row per day that was sent, with the tokens; the next run reads
--     Expo's answer and forgets phones that no longer exist.
-- No access for anon; admins reach the tables only through the functions.
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

create table public.push_devices (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[^\]]+\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  locale text not null default 'tr' check (locale in ('tr', 'en', 'uk')),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.push_devices is 'Admin phones that receive the evening reminder. Written only by register_push_device / unregister_push_device.';

create table public.evening_reminder_runs (
  day date primary key,
  sent_at timestamptz not null default now(),
  families integer not null check (families > 0),
  tokens text[] not null,
  request_id bigint,
  checked boolean not null default false
);

comment on table public.evening_reminder_runs is 'Days the evening reminder went out (Istanbul dates), and to which phones.';

alter table public.push_devices enable row level security;
alter table public.evening_reminder_runs enable row level security;

revoke all on public.push_devices from public, anon, authenticated;
revoke all on public.evening_reminder_runs from public, anon, authenticated;
grant all on public.push_devices to service_role;
grant all on public.evening_reminder_runs to service_role;

insert into public.app_settings (key, value) values
  ('evening_reminder', jsonb_build_object('enabled', true, 'time', '16:00'))
on conflict (key) do nothing;

-- A phone signs up for the reminder after sign-in; a phone that changes hands moves with it
create or replace function public.register_push_device(device_token text, device_locale text, device_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  insert into public.push_devices (token, user_id, locale, platform)
  values (device_token, auth.uid(), case when device_locale in ('tr', 'en', 'uk') then device_locale else 'tr' end, device_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, locale = excluded.locale, platform = excluded.platform, updated_at = now();
end;
$$;

-- On sign-out, before the session ends
create or replace function public.unregister_push_device(device_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices where token = device_token and user_id = (select auth.uid());
$$;

revoke all on function public.register_push_device(text, text, text) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- The same test as toWhatsAppNumber (packages/core/src/rules/phone.js): only a seat whose parent
-- can be written to on WhatsApp has a reminder to send
create or replace function public.has_whatsapp_number(phone text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw text := btrim(coalesce(phone, ''));
  digits text := regexp_replace(raw, '\D', '', 'g');
begin
  if digits = '' then return false; end if;
  if left(raw, 1) = '+' then return length(digits) between 8 and 15; end if;
  if left(digits, 2) = '00' then digits := substr(digits, 3); end if;
  if length(digits) = 13 and left(digits, 3) = '900' then digits := '90' || substr(digits, 4); end if;
  return (length(digits) = 11 and left(digits, 1) = '0')
    or (length(digits) = 10 and left(digits, 1) <> '0')
    or (length(digits) = 12 and left(digits, 2) = '90')
    or (length(digits) between 11 and 15 and left(digits, 1) <> '0' and left(digits, 2) <> '90');
end;
$$;

-- Tomorrow's families still waiting for their reminder, counted like the Today screen does
create or replace function public.unreminded_seats(lesson_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.event_participants seat
  join public.events lesson on lesson.id = seat.event_id
  join public.registrations child on child.id = seat.registration_id
  where lesson.is_active
    and (lesson.event_date at time zone 'Europe/Istanbul')::date = lesson_day
    and seat.status = 'scheduled'
    and public.has_whatsapp_number(child.parent_phone)
    and not exists (select 1 from public.reminder_log sent where sent.participant_id = seat.id and sent.kind = 'lesson');
$$;

-- The words of the notification; the same texts as t.messages.evening in packages/core
create or replace function public.evening_reminder_text(locale text, families integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case locale
    when 'en' then jsonb_build_object(
      'title', 'Tomorrow’s lessons',
      'body', case when families = 1 then '1 family has not been reminded yet. Send them in order from Today.'
        else families || ' families have not been reminded yet. Send them in order from Today.' end)
    when 'uk' then jsonb_build_object(
      'title', 'Завтрашні заняття',
      'body', 'Ще ' || families || case
        when families % 10 = 1 and families % 100 <> 11 then ' родині'
        else ' родинам' end || ' не нагадали. Надішліть по черзі з екрана «Сьогодні».')
    else jsonb_build_object(
      'title', 'Yarınki dersler',
      'body', families || ' aileye daha hatırlatma gitmedi. Bugün ekranından sırayla gönderebilirsin.')
  end;
$$;

-- Reads Expo's answer to earlier sends and forgets phones Expo no longer knows
create or replace function public.forget_dead_push_devices()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  answer jsonb;
  tickets jsonb;
  i integer;
begin
  for run in select * from public.evening_reminder_runs where not checked and request_id is not null loop
    select case when status_code = 200 then content::jsonb end into answer from net._http_response where id = run.request_id;
    if not found then
      -- pg_net keeps answers for a few hours; an answer that never came is given up on
      if run.sent_at < now() - interval '5 hours' then
        update public.evening_reminder_runs set checked = true where day = run.day;
      end if;
      continue;
    end if;
    tickets := coalesce(answer -> 'data', '[]'::jsonb);
    if jsonb_typeof(tickets) = 'array' then
      for i in 0 .. jsonb_array_length(tickets) - 1 loop
        if tickets -> i -> 'details' ->> 'error' = 'DeviceNotRegistered' then
          delete from public.push_devices where token = run.tokens[i + 1];
        end if;
      end loop;
    end if;
    update public.evening_reminder_runs set checked = true where day = run.day;
  end loop;
end;
$$;

-- Run every 15 minutes; says what it did, which cron keeps in its run history
create or replace function public.send_evening_reminder()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting jsonb;
  local_now timestamp := now() at time zone 'Europe/Istanbul';
  today date := (now() at time zone 'Europe/Istanbul')::date;
  due timestamp;
  families integer;
  tokens text[];
  messages jsonb;
begin
  perform public.forget_dead_push_devices();

  select value into setting from public.app_settings where key = 'evening_reminder';
  if setting is null or setting ->> 'enabled' = 'false' then
    return 'off';
  end if;
  due := today + coalesce((setting ->> 'time')::time, time '16:00');
  -- The hour after the set time; a time moved to later the same day still gets its send
  if local_now < due or local_now >= due + interval '1 hour' then
    return 'not_due';
  end if;
  if exists (select 1 from public.evening_reminder_runs where day = today) then
    return 'already_sent';
  end if;

  families := public.unreminded_seats(today + 1);
  if families = 0 then
    return 'nothing_to_send';
  end if;

  select array_agg(device.token order by device.token),
         jsonb_agg(public.evening_reminder_text(device.locale, families) || jsonb_build_object(
           'to', device.token, 'sound', 'default', 'channelId', 'reminders', 'priority', 'high', 'data', jsonb_build_object('url', '/')
         ) order by device.token)
  into tokens, messages
  from public.push_devices device;
  if tokens is null then
    return 'no_devices';
  end if;

  insert into public.evening_reminder_runs (day, families, tokens) values (today, families, tokens) on conflict (day) do nothing;
  if not found then
    return 'already_sent';
  end if;
  update public.evening_reminder_runs
  set request_id = net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
  )
  where day = today;
  return 'sent ' || families || ' to ' || array_length(tokens, 1);
end;
$$;

revoke all on function public.has_whatsapp_number(text) from public, anon, authenticated;
revoke all on function public.unreminded_seats(date) from public, anon, authenticated;
revoke all on function public.evening_reminder_text(text, integer) from public, anon, authenticated;
revoke all on function public.forget_dead_push_devices() from public, anon, authenticated;
revoke all on function public.send_evening_reminder() from public, anon, authenticated;

select cron.schedule('evening-reminder', '*/15 * * * *', 'select public.send_evening_reminder()');

notify pgrst, 'reload schema';
