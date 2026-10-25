-- =====================================================================
-- Message templates and the reminder log (2026-10-25)
--
-- Additive only; the current app keeps working against this schema unchanged.
--   * message_templates: the WhatsApp texts parents receive, editable in Settings › Messages.
--     One default per kind (lesson reminder, payment, package end); the admin can add more,
--     including free-standing ones (kind 'custom') sent from a child's page.
--   * app_settings 'workshop': the facts every message may use (place, map link, duration).
--   * reminder_log: who opened which reminder for which child, shared by every admin and
--     device. A lesson reminder carries the seat it was for, so tomorrow's list shows it as sent
--     on every screen.
-- RLS for admins only, no access for anon.
-- =====================================================================

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('lesson', 'payment', 'package_end', 'custom')),
  title text not null check (btrim(title) <> '' and char_length(title) <= 80),
  body text not null check (btrim(body) <> '' and char_length(body) <= 4000),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_custom_not_default check (kind <> 'custom' or not is_default)
);

comment on table public.message_templates is 'WhatsApp texts for parents. Variables in braces, e.g. {veli}, are filled in by the app.';

-- One default per kind; switching the default is one update in set_default_message_template
create unique index message_templates_one_default on public.message_templates (kind) where is_default;

insert into public.message_templates (kind, title, body, is_default, sort_order) values
('lesson', 'Ders hatırlatma', $$Merhaba {veli}
Çocuğunuzun etkinliğimizde bize katılacak olmasından büyük mutluluk duyuyoruz! İşte rezervasyonunuzla ilgili detaylar:
* Etkinlik Tarihi: {tarih} ({gün})
* Saat: {saat}
* Etkinlik: {ders}
* Yer: {yer}
* Adres: {konum}
* Süre: {süre}
Etkinlik sırasında çocuklarınızı güvende tutmak için gerekli tüm önlemleri aldık. Lütfen çocuğunuzun rahat kıyafetlerle gelmesini sağlayın ve yanlarına bir su şişesi ve küçük bir atıştırmalık getirmeyi unutmayın. Yedek kıyafet yada aktivite önlüğü getirmenizi tavsiye ederiz.
Rezervasyonunuzun iptali için lütfen bir gün önceden bizi bilgilendiriniz. Rezervasyonunuza saatinde gelmenizi rica ederiz.
Eğer herhangi bir sorunuz varsa, lütfen bize ulaşmaktan çekinmeyin.
Sizleri ve çocuğunuzu atölyemizde görmek için sabırsızlanıyoruz!
Sevgilerle,
HelloKido Oyun Atölyesi$$, true, 10),
('payment', 'Ödeme hatırlatma', $$Merhabalar {veli}. {çocuk} için ödeme beklemekteyiz. Bilginize sunarız.$$, true, 20),
('package_end', 'Paket bitişi', $$Merhabalar {veli}. {çocuk} adlı öğrencinizin paket süresi {bitiş} tarihinde {bitiş durumu}. Bilginize sunarız.$$, true, 30);

insert into public.app_settings (key, value) values
  ('workshop', jsonb_build_object(
    'place', 'Ritim İstanbul B blok Kat:1 Ofis 237',
    'map', 'https://maps.app.goo.gl/rb2m4migY24gA8GMA',
    'duration', '75-90 dk'
  ))
on conflict (key) do nothing;

create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('lesson', 'payment', 'package_end', 'custom')),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  participant_id uuid references public.event_participants (id) on delete cascade,
  template_id uuid references public.message_templates (id) on delete set null,
  sent_by uuid default auth.uid(),
  sent_at timestamptz not null default now(),
  constraint reminder_log_lesson_has_seat check (kind <> 'lesson' or participant_id is not null)
);

comment on table public.reminder_log is 'Reminders opened in WhatsApp from the panel or the phone app.';

create index idx_reminder_log_registration on public.reminder_log using btree (registration_id, sent_at desc);
create index idx_reminder_log_participant on public.reminder_log using btree (participant_id);

-- Makes one template the default of its kind in a single step
create or replace function public.set_default_message_template(template_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  template_kind text;
begin
  select kind into template_kind from public.message_templates where id = template_id for update;
  if template_kind is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if template_kind = 'custom' then
    raise exception 'custom_cannot_be_default' using errcode = '22023';
  end if;
  update public.message_templates set is_default = false where kind = template_kind and is_default and id <> template_id;
  update public.message_templates set is_default = true where id = template_id;
end;
$$;

revoke all on function public.set_default_message_template(uuid) from public, anon;
grant execute on function public.set_default_message_template(uuid) to authenticated;

create trigger update_message_templates_updated_at before update on public.message_templates
  for each row execute function public.update_updated_at_column();
create trigger audit_message_templates after insert or delete or update on public.message_templates
  for each row execute function public.log_row_change();

alter table public.message_templates enable row level security;
alter table public.reminder_log enable row level security;

create policy "Admins read message templates" on public.message_templates for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add message templates" on public.message_templates for insert to authenticated
  with check ((select public.is_admin() as is_admin));
create policy "Admins update message templates" on public.message_templates for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
-- A default stays until another template of its kind takes its place
create policy "Admins delete message templates" on public.message_templates for delete to authenticated
  using ((select public.is_admin() as is_admin) and not is_default);

create policy "Admins read reminder log" on public.reminder_log for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add to reminder log" on public.reminder_log for insert to authenticated
  with check ((select public.is_admin() as is_admin));
create policy "Admins delete from reminder log" on public.reminder_log for delete to authenticated
  using ((select public.is_admin() as is_admin));

revoke all on public.message_templates from public, anon, authenticated;
grant select, insert, update, delete on public.message_templates to authenticated;
grant all on public.message_templates to service_role;

revoke all on public.reminder_log from public, anon, authenticated;
grant select, insert, delete on public.reminder_log to authenticated;
grant all on public.reminder_log to service_role;

notify pgrst, 'reload schema';
