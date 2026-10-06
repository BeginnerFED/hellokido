-- =====================================================================
-- HelloKido — Tam veritabanı şeması
-- =====================================================================
-- Bu dosya canlı Supabase projesinin (jdiqfxvndliopckbyhfj) 6 Ekim 2026 tarihli
-- yapısından üretilmiştir. Boş bir Supabase projesinde SQL Editor'de baştan sona
-- çalıştırıldığında uygulamanın ihtiyaç duyduğu her şeyi kurar:
--   tablolar, kısıtlar, indeksler, fonksiyonlar, trigger'lar, RLS politikaları, yetkiler.
--
-- VERİ İÇERMEZ — sadece yapı. Yeni kurulum sıfır kayıtla başlar.
--
-- Değişikliklerin asıl kaynağı Supabase'deki migration geçmişidir (Database > Migrations);
-- bu dosya onun aynasıdır. Veritabanının yapısı değiştiğinde yeniden üretilmelidir.
--
-- Kurulumdan sonra yapılması gerekenler:
--   1) Authentication > Users bölümünden yönetici kullanıcısı oluştur
--   2) O kullanıcıyı yönetici listesine ekle (eklenmezse panel "erişim yok" der):
--        insert into public.app_admins (user_id) select id from auth.users where email = 'ornek@hellokido.com';
--   3) Authentication ayarlarında yeni kullanıcı kaydını ("Allow new users to sign up") kapat
--   4) Uygulamanın .env dosyasına proje URL'i ve anon key'i yaz
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EKLENTİLER
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 2. TABLOLAR
-- ---------------------------------------------------------------------

-- Öğrenci kayıtları. Güncel paket durumu bu satırda tutulur; ilk kayıt bilgileri
-- initial_* kolonlarına trigger ile yazılır. Kayıt silinmez, arşivlenir (is_active = false).
CREATE TABLE public.registrations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  registration_code text DEFAULT ('REG-'::text || substr(md5((random())::text), 1, 8)),
  student_id uuid DEFAULT extensions.uuid_generate_v4(),
  student_name text NOT NULL,
  student_age text NOT NULL,
  parent_id uuid DEFAULT extensions.uuid_generate_v4(),
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  package_id uuid DEFAULT extensions.uuid_generate_v4(),
  package_type text NOT NULL,
  package_start_date timestamp with time zone NOT NULL,
  package_end_date timestamp with time zone NOT NULL,
  payment_id uuid DEFAULT extensions.uuid_generate_v4(),
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  payment_amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  extension_count integer DEFAULT 0,
  last_extension_date timestamp with time zone,
  initial_package_type text,
  initial_start_date timestamp with time zone,
  initial_end_date timestamp with time zone,
  initial_payment_method text,
  initial_payment_amount numeric,
  initial_notes text,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_registration_code_key UNIQUE (registration_code),
  CONSTRAINT unique_parent_phone UNIQUE (parent_phone),
  CONSTRAINT registrations_period_order CHECK ((package_end_date >= package_start_date)),
  CONSTRAINT valid_package_type CHECK ((package_type = ANY (ARRAY['tek-seferlik'::text, 'hafta-1'::text, 'hafta-2'::text, 'hafta-3'::text, 'hafta-4'::text, '3ay-hafta-1'::text, '3ay-hafta-2'::text, 'ucretsiz'::text]))),
  CONSTRAINT valid_payment_method CHECK ((payment_method = ANY (ARRAY['banka'::text, 'nakit'::text, 'kart'::text, 'belirlenmedi'::text]))),
  CONSTRAINT valid_payment_status CHECK ((payment_status = ANY (ARRAY['odendi'::text, 'beklemede'::text, 'ucretsiz'::text])))
);

-- Dersler / etkinlikler
CREATE TABLE public.events (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  event_code text DEFAULT ('EVT-'::text || substr(md5((random())::text), 1, 8)),
  event_date timestamp with time zone NOT NULL,
  age_group text NOT NULL,
  event_type text NOT NULL,
  custom_description text,
  max_capacity integer DEFAULT 10 NOT NULL,
  current_capacity integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_event_code_key UNIQUE (event_code),
  CONSTRAINT valid_age_group CHECK ((age_group = ANY (ARRAY['12-18 Aylık'::text, '16-24 Aylık'::text, '18-24 Aylık'::text, '24-36 Aylık'::text, '30+ Aylık'::text, '3+ Yaş'::text]))),
  CONSTRAINT valid_capacity CHECK ((current_capacity <= max_capacity)),
  CONSTRAINT valid_event_type CHECK ((event_type = ANY (ARRAY['ingilizce'::text, 'duyusal'::text, 'ozel'::text])))
);

-- Öğrenci ↔ ders bağı. Her satır aynı zamanda paket kullanım defteridir:
-- status 'attended' ya da 'no_show' ise öğrencinin ders hakkından bir ders düşer.
CREATE TABLE public.event_participants (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  cancellation_reason text,
  cancellation_date timestamp with time zone,
  is_makeup boolean DEFAULT false,
  makeup_for_id uuid,
  makeup_notes text,
  postponed_to_id uuid,
  postponed_from_id uuid,
  postponed_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_participants_pkey PRIMARY KEY (id),
  CONSTRAINT unique_event_participant UNIQUE (event_id, registration_id),
  CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['scheduled'::text, 'attended'::text, 'no_show'::text, 'cancelled'::text, 'makeup'::text, 'postponed'::text])))
);

-- Paket uzatma geçmişi. previous_* kolonları uzatmayla kapanan dönemi tarif eder
-- (kullanılmayan derslerin yeni döneme devri bunlardan hesaplanır).
CREATE TABLE public.extension_history (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  registration_id uuid NOT NULL,
  previous_end_date timestamp with time zone NOT NULL,
  new_end_date timestamp with time zone NOT NULL,
  extension_date timestamp with time zone DEFAULT now(),
  previous_package_type text NOT NULL,
  new_package_type text NOT NULL,
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  payment_amount numeric,
  payment_date timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  new_start_date timestamp with time zone,
  previous_start_date timestamp with time zone,
  previous_carried_lessons integer,
  CONSTRAINT extension_history_pkey PRIMARY KEY (id),
  CONSTRAINT extension_history_period_order CHECK (((new_start_date IS NULL) OR (new_end_date >= new_start_date))),
  CONSTRAINT valid_extension_package_type CHECK ((new_package_type = ANY (ARRAY['tek-seferlik'::text, 'hafta-1'::text, 'hafta-2'::text, 'hafta-3'::text, 'hafta-4'::text, '3ay-hafta-1'::text, '3ay-hafta-2'::text]))),
  CONSTRAINT valid_extension_payment_method CHECK ((payment_method = ANY (ARRAY['banka'::text, 'nakit'::text, 'kart'::text, 'belirlenmedi'::text]))),
  CONSTRAINT valid_extension_payment_status CHECK ((payment_status = ANY (ARRAY['odendi'::text, 'beklemede'::text])))
);

-- Gelir kayıtları (ilk ödeme + uzatma ödemeleri). Ödeme tutarlarının tek kaynağıdır.
CREATE TABLE public.financial_records (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  registration_id uuid NOT NULL,
  transaction_type text NOT NULL,
  transaction_date timestamp with time zone DEFAULT now(),
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  extension_history_id uuid,
  CONSTRAINT financial_records_pkey PRIMARY KEY (id),
  CONSTRAINT paid_has_payment_date CHECK (((payment_status <> 'odendi'::text) OR (payment_date IS NOT NULL))),
  CONSTRAINT valid_financial_payment_method CHECK ((payment_method = ANY (ARRAY['banka'::text, 'nakit'::text, 'kart'::text, 'belirlenmedi'::text]))),
  CONSTRAINT valid_financial_payment_status CHECK ((payment_status = ANY (ARRAY['odendi'::text, 'beklemede'::text]))),
  CONSTRAINT valid_transaction_type CHECK ((transaction_type = ANY (ARRAY['initial_payment'::text, 'extension_payment'::text])))
);

-- Giderler
CREATE TABLE public.expenses (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  expense_type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  notes text,
  expense_date timestamp with time zone DEFAULT now(),
  payment_method text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT valid_expense_type CHECK ((expense_type = ANY (ARRAY['kira'::text, 'elektrik'::text, 'su'::text, 'dogalgaz'::text, 'internet'::text, 'maas'::text, 'malzeme'::text, 'mutfak'::text, 'reklam'::text, 'filament'::text, 'diger'::text]))),
  CONSTRAINT valid_payment_method CHECK ((payment_method = ANY (ARRAY['banka'::text, 'nakit'::text, 'kart'::text])))
);

-- Bekleme listesi
CREATE TABLE public.waitlist (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  student_name text NOT NULL,
  student_age text NOT NULL,
  package_type text NOT NULL,
  contact_date date DEFAULT now() NOT NULL,
  status text DEFAULT 'beklemede'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_package_type_check CHECK ((package_type = ANY (ARRAY['belirsiz'::text, 'tek-seferlik'::text, 'hafta-1'::text, 'hafta-2'::text, 'hafta-3'::text, 'hafta-4'::text, '3ay-hafta-1'::text, '3ay-hafta-2'::text]))),
  CONSTRAINT waitlist_status_check CHECK ((status = ANY (ARRAY['beklemede'::text, 'iletisime-gecildi'::text])))
);

-- Notlar
CREATE TABLE public.notes (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  title text NOT NULL,
  content text,
  is_favorite boolean DEFAULT false,
  color text DEFAULT '#ffffff'::text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notes_pkey PRIMARY KEY (id)
);

-- Haftalık konular. week_start her zaman bir PAZARTESİ olmalıdır.
CREATE TABLE public.weekly_themes (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  week_start date NOT NULL,
  theme text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weekly_themes_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_themes_week_start_key UNIQUE (week_start),
  CONSTRAINT weekly_themes_week_start_check CHECK ((EXTRACT(isodow FROM week_start) = (1)::numeric))
);

-- Yönetici listesi. Panele yalnızca bu tablodaki kullanıcılar erişebilir (bkz. is_admin).
-- Tabloya doğrudan erişim yoktur; list_admins / grant_admin / revoke_admin fonksiyonları kullanılır.
CREATE TABLE public.app_admins (
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  CONSTRAINT app_admins_pkey PRIMARY KEY (user_id)
);

-- Değişiklik kaydı: para ve yoklama tablolarındaki her ekleme, güncelleme ve silme
-- (bkz. log_row_change). Yalnızca yöneticiler okuyabilir; kimse değiştiremez ya da silemez.
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  table_name text NOT NULL,
  row_id uuid,
  operation text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------
-- 3. YABANCI ANAHTARLAR
-- ---------------------------------------------------------------------
-- Para ve yoklama kayıtları olan bir öğrenci kaydı silinemez (ON DELETE RESTRICT).

ALTER TABLE public.app_admins
  ADD CONSTRAINT app_admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_admins
  ADD CONSTRAINT app_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_makeup_for_id_fkey FOREIGN KEY (makeup_for_id) REFERENCES public.event_participants(id);
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_postponed_from_id_fkey FOREIGN KEY (postponed_from_id) REFERENCES public.event_participants(id);
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_postponed_to_id_fkey FOREIGN KEY (postponed_to_id) REFERENCES public.event_participants(id);
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE RESTRICT;
ALTER TABLE public.extension_history
  ADD CONSTRAINT extension_history_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_records
  ADD CONSTRAINT financial_records_extension_history_id_fkey FOREIGN KEY (extension_history_id) REFERENCES public.extension_history(id) ON DELETE SET NULL;
ALTER TABLE public.financial_records
  ADD CONSTRAINT financial_records_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 4. İNDEKSLER
-- ---------------------------------------------------------------------
CREATE INDEX audit_log_changed_at_idx ON public.audit_log USING btree (changed_at DESC);
CREATE INDEX audit_log_row_idx ON public.audit_log USING btree (table_name, row_id, changed_at DESC);
CREATE INDEX idx_event_participants_event_id ON public.event_participants USING btree (event_id);
CREATE INDEX idx_event_participants_is_makeup ON public.event_participants USING btree (is_makeup);
CREATE INDEX idx_event_participants_makeup_for_id ON public.event_participants USING btree (makeup_for_id);
CREATE INDEX idx_event_participants_postponed_from_id ON public.event_participants USING btree (postponed_from_id);
CREATE INDEX idx_event_participants_postponed_to_id ON public.event_participants USING btree (postponed_to_id);
CREATE INDEX idx_event_participants_registration_id ON public.event_participants USING btree (registration_id);
CREATE INDEX idx_event_participants_status ON public.event_participants USING btree (status);
CREATE INDEX idx_events_age_group ON public.events USING btree (age_group);
CREATE INDEX idx_events_event_date ON public.events USING btree (event_date);
CREATE INDEX idx_events_event_type ON public.events USING btree (event_type);
CREATE INDEX idx_events_is_active ON public.events USING btree (is_active);
CREATE INDEX idx_extension_history_created_at ON public.extension_history USING btree (created_at);
CREATE INDEX idx_extension_history_extension_date ON public.extension_history USING btree (extension_date);
CREATE INDEX idx_extension_history_new_package_type ON public.extension_history USING btree (new_package_type);
CREATE INDEX idx_extension_history_new_start_date ON public.extension_history USING btree (new_start_date);
CREATE INDEX idx_extension_history_payment_date ON public.extension_history USING btree (payment_date);
CREATE INDEX idx_extension_history_registration_id ON public.extension_history USING btree (registration_id);
CREATE INDEX idx_financial_records_created_at ON public.financial_records USING btree (created_at);
CREATE INDEX idx_financial_records_extension_history_id ON public.financial_records USING btree (extension_history_id);
CREATE INDEX idx_financial_records_payment_date ON public.financial_records USING btree (payment_date);
CREATE INDEX idx_financial_records_payment_status ON public.financial_records USING btree (payment_status);
CREATE INDEX idx_financial_records_registration_id ON public.financial_records USING btree (registration_id);
CREATE INDEX idx_financial_records_transaction_date ON public.financial_records USING btree (transaction_date);
CREATE INDEX idx_financial_records_transaction_type ON public.financial_records USING btree (transaction_type);
CREATE INDEX idx_registrations_created_at ON public.registrations USING btree (created_at);
CREATE INDEX idx_registrations_is_active ON public.registrations USING btree (is_active);
CREATE INDEX idx_registrations_parent_phone ON public.registrations USING btree (parent_phone);
CREATE INDEX idx_registrations_payment_date ON public.registrations USING btree (payment_date);
CREATE INDEX idx_registrations_payment_status ON public.registrations USING btree (payment_status);
CREATE INDEX idx_registrations_student_name ON public.registrations USING btree (student_name);

-- ---------------------------------------------------------------------
-- 5. FONKSİYONLAR
-- ---------------------------------------------------------------------
-- Her fonksiyonun ardından kimlerin çağırabildiği belirtilir. Ziyaretçi (anon) hiçbirini çağıramaz.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$function$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_admin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir' using errcode = '42501';
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.assert_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.copy_week(p_source_start timestamp with time zone, p_weeks integer, p_excluded uuid[] DEFAULT '{}'::uuid[], p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_shift          interval;
  v_excluded       uuid[] := coalesce(p_excluded, '{}');
  v_dry_run        boolean := coalesce(p_dry_run, false);
  v_new_ids        uuid[] := '{}';
  v_skipped_slots  timestamptz[] := '{}';
  v_source         integer := 0;
  v_copied         integer := 0;
  v_seats          integer := 0;
  v_archived       integer := 0;
  v_new_date       timestamptz;
  v_new_id         uuid;
  v_active_count   integer;
  v_archived_count integer;
  r                record;
begin
  -- SECURITY INVOKER: okuma ve yazma yetkisi çağıranın RLS politikalarıyla denetlenir.
  -- Yönetici olmayan kullanıcıya boş sonuç yerine açık bir hata verilir.
  if coalesce((select auth.jwt()) ->> 'role', '') = 'authenticated' and not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir' using errcode = '42501';
  end if;

  if p_source_start is null or p_weeks is null or p_weeks = 0 or abs(p_weeks) > 104 then
    raise exception 'invalid_target_week';
  end if;

  -- Oturumun saat dilimi ayarından bağımsız olsun diye kaydırma saat cinsinden yapılır
  v_shift := make_interval(hours => p_weeks * 168);

  -- Aynı anda ikinci bir kopyalama başlarsa ilkinin bitmesini bekler ve onun eklediği
  -- dersleri "zaten var" olarak görür (hafta iki kez kopyalanmaz)
  if not v_dry_run then
    perform pg_advisory_xact_lock(hashtextextended('public.copy_week', 0));
  end if;

  for r in
    select e.id, e.event_date, e.age_group, e.event_type, e.custom_description, e.max_capacity
    from public.events e
    where e.is_active
      and e.event_date >= p_source_start
      and e.event_date < p_source_start + interval '168 hours'
    order by e.event_date, e.id
  loop
    v_source := v_source + 1;
    v_new_date := r.event_date + v_shift;

    if exists (
      select 1
      from public.events t
      where t.is_active
        and t.event_date > v_new_date - interval '60 minutes'
        and t.event_date < v_new_date + interval '60 minutes'
        and t.id <> all (v_new_ids)
    ) then
      v_skipped_slots := v_skipped_slots || v_new_date;
      continue;
    end if;

    select count(*) filter (where reg.is_active), count(*) filter (where not reg.is_active)
      into v_active_count, v_archived_count
    from public.event_participants ep
    join public.registrations reg on reg.id = ep.registration_id
    where ep.event_id = r.id
      and ep.registration_id <> all (v_excluded);

    if not v_dry_run then
      insert into public.events (event_date, age_group, event_type, custom_description, max_capacity, current_capacity)
      values (v_new_date, r.age_group, r.event_type, r.custom_description, r.max_capacity, 0)
      returning id into v_new_id;

      v_new_ids := v_new_ids || v_new_id;

      insert into public.event_participants (event_id, registration_id)
      select v_new_id, ep.registration_id
      from public.event_participants ep
      join public.registrations reg on reg.id = ep.registration_id
      where ep.event_id = r.id
        and reg.is_active
        and ep.registration_id <> all (v_excluded);
    end if;

    v_copied := v_copied + 1;
    v_seats := v_seats + v_active_count;
    v_archived := v_archived + v_archived_count;
  end loop;

  return jsonb_build_object(
    'source', v_source,
    'copied', v_copied,
    'skipped', coalesce(array_length(v_skipped_slots, 1), 0),
    'skipped_slots', to_jsonb(v_skipped_slots),
    'seats', v_seats,
    'archived_seats', v_archived
  );
end;
$function$;
REVOKE ALL ON FUNCTION public.copy_week(p_source_start timestamp with time zone, p_weeks integer, p_excluded uuid[], p_dry_run boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_week(p_source_start timestamp with time zone, p_weeks integer, p_excluded uuid[], p_dry_run boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_registration(p_data jsonb)
 RETURNS public.registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.registrations%rowtype;
  v_type text := p_data ->> 'package_type';
  v_status text := p_data ->> 'payment_status';
  v_method text := p_data ->> 'payment_method';
  v_amount numeric := (p_data ->> 'payment_amount')::numeric;
  v_payment_date timestamp with time zone := (p_data ->> 'payment_date')::timestamp with time zone;
  v_notes text := nullif(btrim(coalesce(p_data ->> 'notes', '')), '');
begin
  perform public.assert_admin();

  -- Ücretsiz katılım ve bekleyen ödemede ödeme ayrıntısı olmaz
  if v_type = 'ucretsiz' then
    v_status := 'ucretsiz'; v_method := 'belirlenmedi'; v_amount := 0; v_payment_date := null;
  elsif v_status = 'beklemede' then
    v_method := 'belirlenmedi'; v_amount := 0; v_payment_date := null;
  elsif v_status = 'odendi' then
    if v_amount is null or v_amount < 0 or v_payment_date is null or coalesce(v_method, 'belirlenmedi') = 'belirlenmedi' then
      raise exception 'invalid_payment' using errcode = '22023';
    end if;
  else
    raise exception 'invalid_payment_status' using errcode = '22023';
  end if;

  insert into public.registrations (
    student_name, student_age, parent_name, parent_phone,
    package_type, package_start_date, package_end_date,
    payment_status, payment_method, payment_amount, payment_date, notes, is_active
  ) values (
    btrim(p_data ->> 'student_name'), btrim(p_data ->> 'student_age'),
    btrim(p_data ->> 'parent_name'), btrim(p_data ->> 'parent_phone'),
    v_type,
    (p_data ->> 'package_start_date')::timestamp with time zone,
    (p_data ->> 'package_end_date')::timestamp with time zone,
    v_status, v_method, v_amount, v_payment_date, v_notes, true
  )
  returning * into v_reg;

  -- Ücretsiz katılımda ödeme kaydı oluşturulmaz
  if v_type <> 'ucretsiz' then
    insert into public.financial_records (
      registration_id, transaction_type, amount, payment_method, payment_status, payment_date, notes
    ) values (
      v_reg.id, 'initial_payment', v_amount, v_method, v_status, v_payment_date, v_notes
    );
  end if;

  return v_reg;
end;
$function$;
REVOKE ALL ON FUNCTION public.create_registration(p_data jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_registration(p_data jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_last_extension(p_extension_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reg registrations%rowtype;
  v_ext extension_history%rowtype;
  v_prev extension_history%rowtype;
  v_fin financial_records%rowtype;
  v_same_period boolean;
  v_keeps_start boolean;
  v_start timestamp with time zone;
  v_end timestamp with time zone;
begin
  -- SECURITY DEFINER olduğu için RLS'i aşar; yetkiyi burada denetle
  perform public.assert_admin();

  select r.* into v_reg
  from registrations r
  where r.id = (select e.registration_id from extension_history e where e.id = p_extension_id)
  for update;
  if not found then
    raise exception 'Extension not found: %', p_extension_id;
  end if;

  select * into v_ext from extension_history where id = p_extension_id;
  if not found then
    raise exception 'Extension not found: %', p_extension_id;
  end if;

  if (select e.id from extension_history e
      where e.registration_id = v_reg.id order by e.created_at desc, e.id desc limit 1) is distinct from p_extension_id then
    raise exception 'Only the latest extension can be deleted';
  end if;

  select * into v_prev
  from extension_history
  where registration_id = v_reg.id and id <> p_extension_id
  order by created_at desc, id desc
  limit 1;

  delete from financial_records where extension_history_id = p_extension_id;
  delete from extension_history where id = p_extension_id;

  select * into v_fin
  from financial_records
  where registration_id = v_reg.id
  order by created_at desc
  limit 1;

  v_same_period := coalesce(
    v_prev.new_start_date = v_ext.new_start_date and v_prev.new_end_date = v_ext.new_end_date,
    false
  );

  -- Silinen satır dönemi ileri bir güne taşımamış mıydı? (aynı dönem için ek ödeme)
  v_keeps_start := coalesce(
    (v_ext.previous_start_date at time zone 'Europe/Istanbul')::date >= (v_ext.new_start_date at time zone 'Europe/Istanbul')::date,
    false
  );

  v_start := coalesce(
    v_ext.previous_start_date,
    case when v_prev.id is not null then v_prev.new_start_date else v_reg.initial_start_date end,
    v_reg.package_start_date
  );

  v_end := v_ext.previous_end_date;
  if v_keeps_start
     and v_ext.previous_package_type <> 'tek-seferlik'
     and (v_end at time zone 'Europe/Istanbul')::date <= (v_start at time zone 'Europe/Istanbul')::date then
    v_end := v_reg.package_end_date;
  end if;

  update registrations set
    package_type        = case when v_same_period then package_type else v_ext.previous_package_type end,
    package_start_date  = case when v_same_period then package_start_date else least(v_start, v_end) end,
    package_end_date    = case when v_same_period then package_end_date else v_end end,
    extension_count     = (select count(*) from extension_history where registration_id = v_reg.id),
    last_extension_date = v_prev.created_at,
    payment_status      = coalesce(v_fin.payment_status, 'odendi'),
    payment_method      = coalesce(v_fin.payment_method, v_reg.initial_payment_method, 'belirlenmedi'),
    payment_amount      = coalesce(v_fin.amount, v_reg.initial_payment_amount, 0),
    payment_date        = v_fin.payment_date,
    notes               = case when v_prev.id is not null then v_prev.notes else v_reg.initial_notes end
  where id = v_reg.id;
end;
$function$;
REVOKE ALL ON FUNCTION public.delete_last_extension(p_extension_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_last_extension(p_extension_id uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.extend_registration(p_registration_id uuid, p_expected_extension_count integer, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text, p_previous_carried_lessons integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reg registrations%rowtype;
  v_extension_id uuid;
  v_method text := p_payment_method;
  v_amount numeric := p_payment_amount;
  v_payment_date timestamp with time zone := p_payment_date;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  -- SECURITY INVOKER: yetki, çağıranın RLS politikalarıyla (yalnızca yöneticiler) denetlenir
  select * into v_reg from registrations where id = p_registration_id for update;
  if not found then
    raise exception 'registration_not_found';
  end if;

  -- Ekrandaki kayıt bayatsa ya da form iki kez gönderildiyse
  if coalesce(v_reg.extension_count, 0) <> coalesce(p_expected_extension_count, 0) then
    raise exception 'stale_registration';
  end if;

  if v_reg.package_type = 'ucretsiz' or p_new_package_type = 'ucretsiz' then
    raise exception 'free_registration';
  end if;

  if v_reg.payment_status = 'beklemede' then
    raise exception 'pending_payment';
  end if;

  if p_new_end_date < p_new_start_date then
    raise exception 'invalid_period';
  end if;

  if p_payment_status = 'beklemede' then
    v_method := 'belirlenmedi'; v_amount := 0; v_payment_date := null;
  elsif p_payment_status = 'odendi' then
    if v_amount is null or v_amount < 0 or v_payment_date is null
       or coalesce(v_method, 'belirlenmedi') = 'belirlenmedi' then
      raise exception 'invalid_payment';
    end if;
  else
    raise exception 'invalid_payment_status';
  end if;

  update registrations set
    package_type        = p_new_package_type,
    package_start_date  = p_new_start_date,
    package_end_date    = p_new_end_date,
    payment_status      = p_payment_status,
    payment_method      = v_method,
    payment_amount      = v_amount,
    payment_date        = v_payment_date,
    notes               = v_notes,
    extension_count     = coalesce(v_reg.extension_count, 0) + 1,
    last_extension_date = now()
  where id = p_registration_id;

  insert into extension_history (
    registration_id,
    previous_end_date, previous_package_type, previous_start_date, previous_carried_lessons,
    new_start_date, new_end_date, new_package_type,
    payment_status, payment_method, payment_amount, payment_date, notes
  ) values (
    p_registration_id,
    v_reg.package_end_date, v_reg.package_type, v_reg.package_start_date,
    greatest(coalesce(p_previous_carried_lessons, 0), 0),
    p_new_start_date, p_new_end_date, p_new_package_type,
    p_payment_status, v_method, v_amount, v_payment_date, v_notes
  )
  returning id into v_extension_id;

  insert into financial_records (
    registration_id, extension_history_id, transaction_type,
    amount, payment_method, payment_status, payment_date, notes
  ) values (
    p_registration_id, v_extension_id, 'extension_payment',
    v_amount, v_method, p_payment_status, v_payment_date, v_notes
  );

  return v_extension_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.extend_registration(p_registration_id uuid, p_expected_extension_count integer, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text, p_previous_carried_lessons integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_registration(p_registration_id uuid, p_expected_extension_count integer, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text, p_previous_carried_lessons integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.grant_admin(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
begin
  perform public.assert_admin();
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.app_admins (user_id, created_by) values (v_user, (select auth.uid()))
  on conflict (user_id) do nothing;
  return v_user;
end;
$function$;
REVOKE ALL ON FUNCTION public.grant_admin(p_email text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin(p_email text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_admins()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, is_self boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_admin();
  return query
    select a.user_id, u.email::text, a.created_at, coalesce(a.user_id = (select auth.uid()), false)
    from public.app_admins a
    join auth.users u on u.id = a.user_id
    order by a.created_at, u.email;
end;
$function$;
REVOKE ALL ON FUNCTION public.list_admins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (table_name, row_id, operation, old_row)
    values (tg_table_name, old.id, tg_op, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    -- Hiçbir alanı değişmeyen güncelleme kaydedilmez
    if to_jsonb(old) is distinct from to_jsonb(new) then
      insert into public.audit_log (table_name, row_id, operation, old_row, new_row)
      values (tg_table_name, new.id, tg_op, to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  else
    insert into public.audit_log (table_name, row_id, operation, new_row)
    values (tg_table_name, new.id, tg_op, to_jsonb(new));
    return new;
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.log_row_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_row_change() TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_admin(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_admin();
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_revoke_self' using errcode = 'P0001';
  end if;
  delete from public.app_admins where user_id = p_user_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.revoke_admin(p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin(p_user_id uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_initial_registration_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    if new.extension_count = 0 then
        new.initial_package_type = new.package_type;
        new.initial_start_date = new.package_start_date;
        new.initial_end_date = new.package_end_date;
        new.initial_payment_method = new.payment_method;
        new.initial_payment_amount = new.payment_amount;
        new.initial_notes = new.notes;
    end if;
    return new;
end;
$function$;
-- public.save_initial_registration_data(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

CREATE OR REPLACE FUNCTION public.set_weekly_themes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
-- public.set_weekly_themes_updated_at(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

CREATE OR REPLACE FUNCTION public.update_event_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events
        SET current_capacity = current_capacity + 1
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events
        SET current_capacity = current_capacity - 1
        WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$function$;
-- public.update_event_capacity(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

CREATE OR REPLACE FUNCTION public.update_event_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;
-- public.update_event_updated_at(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

CREATE OR REPLACE FUNCTION public.update_extension(p_extension_id uuid, p_expected_updated_at timestamp with time zone, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.registrations%rowtype;
  v_fin_id uuid;
  v_method text := p_payment_method;
  v_amount numeric := p_payment_amount;
  v_payment_date timestamp with time zone := p_payment_date;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  perform public.assert_admin();

  select r.* into v_reg
  from public.registrations r
  where r.id = (select e.registration_id from public.extension_history e where e.id = p_extension_id)
  for update;
  if not found then
    raise exception 'extension_not_found';
  end if;

  if p_expected_updated_at is not null and v_reg.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_registration';
  end if;

  if (select e.id from public.extension_history e
      where e.registration_id = v_reg.id order by e.created_at desc, e.id desc limit 1) is distinct from p_extension_id then
    raise exception 'not_latest_extension';
  end if;

  if v_reg.package_type = 'ucretsiz' or p_new_package_type = 'ucretsiz' then
    raise exception 'free_registration';
  end if;

  if p_new_end_date < p_new_start_date then
    raise exception 'invalid_period';
  end if;

  if p_payment_status = 'beklemede' then
    v_method := 'belirlenmedi'; v_amount := 0; v_payment_date := null;
  elsif p_payment_status = 'odendi' then
    if v_amount is null or v_amount < 0 or v_payment_date is null
       or coalesce(v_method, 'belirlenmedi') = 'belirlenmedi' then
      raise exception 'invalid_payment';
    end if;
  else
    raise exception 'invalid_payment_status';
  end if;

  -- previous_* alanlarına dokunulmaz: kapanan dönemi (ve devir hesabını) onlar anlatır
  update public.extension_history set
    new_package_type = p_new_package_type,
    new_start_date = p_new_start_date,
    new_end_date = p_new_end_date,
    payment_status = p_payment_status,
    payment_method = v_method,
    payment_amount = v_amount,
    payment_date = v_payment_date,
    notes = v_notes
  where id = p_extension_id;

  update public.registrations set
    package_type = p_new_package_type,
    package_start_date = p_new_start_date,
    package_end_date = p_new_end_date,
    payment_status = p_payment_status,
    payment_method = v_method,
    payment_amount = v_amount,
    payment_date = v_payment_date,
    notes = v_notes
  where id = v_reg.id;

  select f.id into v_fin_id from public.financial_records f
  where f.extension_history_id = p_extension_id order by f.created_at desc limit 1;

  if v_fin_id is null then
    insert into public.financial_records (
      registration_id, extension_history_id, transaction_type, amount, payment_method, payment_status, payment_date, notes
    ) values (
      v_reg.id, p_extension_id, 'extension_payment', v_amount, v_method, p_payment_status, v_payment_date, v_notes
    );
  else
    update public.financial_records set
      amount = v_amount, payment_method = v_method, payment_status = p_payment_status,
      payment_date = v_payment_date, notes = v_notes
    where id = v_fin_id;
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.update_extension(p_extension_id uuid, p_expected_updated_at timestamp with time zone, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_extension(p_extension_id uuid, p_expected_updated_at timestamp with time zone, p_new_package_type text, p_new_start_date timestamp with time zone, p_new_end_date timestamp with time zone, p_payment_status text, p_payment_method text, p_payment_amount numeric, p_payment_date timestamp with time zone, p_notes text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_participant_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;
-- public.update_participant_updated_at(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

CREATE OR REPLACE FUNCTION public.update_registration(p_registration_id uuid, p_expected_updated_at timestamp with time zone, p_changes jsonb)
 RETURNS public.registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.registrations%rowtype;
  v_new public.registrations%rowtype;
  v_fin public.financial_records%rowtype;
  v_ext_id uuid;
  v_ext_created_at timestamp with time zone;
  v_key text;
  v_package_changed boolean;
  v_payment_changed boolean;
  v_notes_changed boolean;
begin
  perform public.assert_admin();

  select * into v_old from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'registration_not_found';
  end if;

  if p_expected_updated_at is not null and v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_registration';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
    if v_key not in ('student_name', 'student_age', 'parent_name', 'parent_phone', 'package_type',
                     'package_start_date', 'package_end_date', 'payment_status', 'payment_method',
                     'payment_amount', 'payment_date', 'notes') then
      raise exception 'unknown_field: %', v_key using errcode = '22023';
    end if;
  end loop;

  v_new := v_old;
  if p_changes ? 'student_name' then v_new.student_name := btrim(p_changes ->> 'student_name'); end if;
  if p_changes ? 'student_age' then v_new.student_age := btrim(p_changes ->> 'student_age'); end if;
  if p_changes ? 'parent_name' then v_new.parent_name := btrim(p_changes ->> 'parent_name'); end if;
  if p_changes ? 'parent_phone' then v_new.parent_phone := btrim(p_changes ->> 'parent_phone'); end if;
  if p_changes ? 'package_type' then v_new.package_type := p_changes ->> 'package_type'; end if;
  if p_changes ? 'package_start_date' then v_new.package_start_date := (p_changes ->> 'package_start_date')::timestamp with time zone; end if;
  if p_changes ? 'package_end_date' then v_new.package_end_date := (p_changes ->> 'package_end_date')::timestamp with time zone; end if;
  if p_changes ? 'payment_status' then v_new.payment_status := p_changes ->> 'payment_status'; end if;
  if p_changes ? 'payment_method' then v_new.payment_method := p_changes ->> 'payment_method'; end if;
  if p_changes ? 'payment_amount' then v_new.payment_amount := (p_changes ->> 'payment_amount')::numeric; end if;
  if p_changes ? 'payment_date' then v_new.payment_date := (p_changes ->> 'payment_date')::timestamp with time zone; end if;
  if p_changes ? 'notes' then v_new.notes := nullif(btrim(coalesce(p_changes ->> 'notes', '')), ''); end if;

  -- Ücretsiz katılım ve bekleyen ödemede ödeme ayrıntısı olmaz
  if v_new.package_type = 'ucretsiz' then
    v_new.payment_status := 'ucretsiz'; v_new.payment_method := 'belirlenmedi';
    v_new.payment_amount := 0; v_new.payment_date := null;
  elsif v_new.payment_status = 'beklemede' then
    v_new.payment_method := 'belirlenmedi'; v_new.payment_amount := 0; v_new.payment_date := null;
  elsif v_new.payment_status = 'odendi' then
    if v_new.payment_amount is null or v_new.payment_amount < 0 or coalesce(v_new.payment_method, 'belirlenmedi') = 'belirlenmedi' then
      raise exception 'invalid_payment' using errcode = '22023';
    end if;
  else
    raise exception 'invalid_payment_status' using errcode = '22023';
  end if;

  if v_new.package_end_date < v_new.package_start_date then
    raise exception 'invalid_period' using errcode = '22023';
  end if;

  v_package_changed := (v_new.package_type, v_new.package_start_date, v_new.package_end_date)
    is distinct from (v_old.package_type, v_old.package_start_date, v_old.package_end_date);
  v_payment_changed := (v_new.payment_status, v_new.payment_method, v_new.payment_amount, v_new.payment_date)
    is distinct from (v_old.payment_status, v_old.payment_method, v_old.payment_amount, v_old.payment_date);
  v_notes_changed := v_new.notes is distinct from v_old.notes;

  update public.registrations set
    student_name = v_new.student_name,
    student_age = v_new.student_age,
    parent_name = v_new.parent_name,
    parent_phone = v_new.parent_phone,
    package_type = v_new.package_type,
    package_start_date = v_new.package_start_date,
    package_end_date = v_new.package_end_date,
    payment_status = v_new.payment_status,
    payment_method = v_new.payment_method,
    payment_amount = v_new.payment_amount,
    payment_date = v_new.payment_date,
    notes = v_new.notes
  where id = p_registration_id;

  select e.id, e.created_at into v_ext_id, v_ext_created_at
  from public.extension_history e
  where e.registration_id = p_registration_id
  order by e.created_at desc, e.id desc
  limit 1;

  -- "İlk kayıt" bilgileri: hiç uzatma yoksa güncel tutulur. Ücretsize/ücretsizden dönüşümde
  -- dokunulmaz; o değerler tahsil edilmiş ilk ödemeyi anlatır.
  if v_ext_id is null and v_old.package_type <> 'ucretsiz' and v_new.package_type <> 'ucretsiz' then
    update public.registrations set
      initial_package_type = v_new.package_type,
      initial_start_date = v_new.package_start_date,
      initial_end_date = v_new.package_end_date,
      initial_payment_method = v_new.payment_method,
      initial_payment_amount = v_new.payment_amount,
      initial_notes = v_new.notes
    where id = p_registration_id;
  end if;

  -- Gelir defteri
  if v_new.package_type = 'ucretsiz' then
    -- Ücretsize dönüşüm: tahsil edilmiş ödemeler gerçek gelirdir, dokunulmaz;
    -- yalnızca hiç tahsil edilmemiş (beklemede, 0 ₺) satırlar kaldırılır.
    if v_old.package_type <> 'ucretsiz' then
      delete from public.financial_records
      where registration_id = p_registration_id and payment_status = 'beklemede' and coalesce(amount, 0) = 0;
    end if;

  elsif v_old.package_type = 'ucretsiz' then
    -- Ücretsizden ücretliye: bu yeni bir ödemedir; önceki tahsilatın üzerine yazılmaz.
    select * into v_fin from public.financial_records
    where registration_id = p_registration_id order by created_at desc limit 1;

    if v_fin.id is not null and v_fin.payment_status = 'beklemede' then
      update public.financial_records set
        amount = v_new.payment_amount, payment_method = v_new.payment_method,
        payment_status = v_new.payment_status, payment_date = v_new.payment_date, notes = v_new.notes
      where id = v_fin.id;
    else
      insert into public.financial_records (
        registration_id, transaction_type, amount, payment_method, payment_status, payment_date, notes
      ) values (
        p_registration_id,
        case when v_fin.id is null then 'initial_payment' else 'extension_payment' end,
        v_new.payment_amount, v_new.payment_method, v_new.payment_status, v_new.payment_date, v_new.notes
      );
    end if;

  elsif v_payment_changed or v_notes_changed then
    -- Düzeltilen ödeme, kaydın güncel ödemesidir: en son uzatmanın ödeme satırı (ya da ondan
    -- sonra eklenmiş bağsız bir ödeme: ücretsizden ücretliye dönüş); uzatma yoksa en yeni satır.
    -- Uzatmaya bağlı satır id ile bulunur ("en yeni satır" başka bir ödemeye ait olabilir).
    if v_ext_id is not null then
      select * into v_fin from public.financial_records
      where registration_id = p_registration_id
        and (extension_history_id = v_ext_id
             or (extension_history_id is null and created_at > v_ext_created_at))
      order by created_at desc limit 1;
    else
      select * into v_fin from public.financial_records
      where registration_id = p_registration_id order by created_at desc limit 1;
    end if;

    if v_fin.id is null then
      insert into public.financial_records (
        registration_id, extension_history_id, transaction_type, amount, payment_method, payment_status, payment_date, notes
      ) values (
        p_registration_id, v_ext_id,
        case when v_ext_id is null then 'initial_payment' else 'extension_payment' end,
        v_new.payment_amount, v_new.payment_method, v_new.payment_status, v_new.payment_date, v_new.notes
      );
    else
      update public.financial_records set
        amount = v_new.payment_amount, payment_method = v_new.payment_method,
        payment_status = v_new.payment_status, payment_date = v_new.payment_date, notes = v_new.notes
      where id = v_fin.id;
    end if;
  end if;

  -- En son uzatma satırı kayıtla aynı bilgiyi taşır; yoksa geçmiş ekranı, "uzatmayı düzenle"
  -- ve geri alma eski değerleri geri yazıyordu.
  if v_ext_id is not null and v_new.package_type <> 'ucretsiz' and v_old.package_type <> 'ucretsiz' then
    update public.extension_history set
      new_package_type = v_new.package_type,
      new_start_date = v_new.package_start_date,
      new_end_date = v_new.package_end_date,
      payment_status = v_new.payment_status,
      payment_method = v_new.payment_method,
      payment_amount = v_new.payment_amount,
      payment_date = v_new.payment_date,
      notes = v_new.notes
    where id = v_ext_id
      and (v_package_changed or v_payment_changed or v_notes_changed);
  end if;

  select * into v_new from public.registrations where id = p_registration_id;
  return v_new;
end;
$function$;
REVOKE ALL ON FUNCTION public.update_registration(p_registration_id uuid, p_expected_updated_at timestamp with time zone, p_changes jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_registration(p_registration_id uuid, p_expected_updated_at timestamp with time zone, p_changes jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;
-- public.update_updated_at_column(): varsayılan yetkiler (trigger fonksiyonu; doğrudan çağrılmaz)

-- ---------------------------------------------------------------------
-- 6. TRIGGER'LAR
-- ---------------------------------------------------------------------
CREATE TRIGGER audit_event_participants AFTER INSERT OR DELETE OR UPDATE ON public.event_participants FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER update_event_capacity AFTER INSERT OR DELETE ON public.event_participants FOR EACH ROW EXECUTE FUNCTION public.update_event_capacity();
CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON public.event_participants FOR EACH ROW EXECUTE FUNCTION public.update_participant_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_event_updated_at();
CREATE TRIGGER audit_expenses AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER audit_extension_history AFTER INSERT OR DELETE OR UPDATE ON public.extension_history FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER audit_financial_records AFTER INSERT OR DELETE OR UPDATE ON public.financial_records FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER audit_registrations AFTER INSERT OR DELETE OR UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER save_initial_registration_data BEFORE INSERT ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.save_initial_registration_data();
CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON public.waitlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER weekly_themes_set_updated_at BEFORE UPDATE ON public.weekly_themes FOR EACH ROW EXECUTE FUNCTION public.set_weekly_themes_updated_at();

-- ---------------------------------------------------------------------
-- 7. RLS (SATIR BAZLI GÜVENLİK)
-- ---------------------------------------------------------------------
-- Bütün tablolara yalnızca yöneticiler (app_admins) erişebilir. Tek istisna herkese açık
-- takvim sayfasıdır: oturumsuz ziyaretçi (anon) aktif dersleri, o derslerin doluluğunu ve
-- içinde bulunulan haftanın konusunu okuyabilir; hiçbir şey yazamaz.

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Yöneticiler değişiklik kaydını görebilir" ON public.audit_log FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Katılımcı silme politikası" ON public.event_participants FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Katılımcı ekleme politikası" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Katılımcı görüntüleme politikası" ON public.event_participants FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Ziyaretçi ders doluluğunu görebilir" ON public.event_participants FOR SELECT TO anon
  USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE (e.id = event_participants.event_id))));
CREATE POLICY "Katılımcı güncelleme politikası" ON public.event_participants FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Etkinlik silme politikası" ON public.events FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Etkinlik oluşturma politikası" ON public.events FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Etkinlik görüntüleme politikası" ON public.events FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Ziyaretçi aktif dersleri görebilir" ON public.events FOR SELECT TO anon
  USING ((is_active IS TRUE));
CREATE POLICY "Etkinlik güncelleme politikası" ON public.events FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Gider silme politikası" ON public.expenses FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Gider ekleme politikası" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Gider görüntüleme politikası" ON public.expenses FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Gider güncelleme politikası" ON public.expenses FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Uzatma geçmişi ekleme politikası" ON public.extension_history FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Uzatma geçmişi görüntüleme politikası" ON public.extension_history FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Uzatma geçmişi güncelleme politikası" ON public.extension_history FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Finansal kayıt ekleme politikası" ON public.financial_records FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Finansal kayıt görüntüleme politikası" ON public.financial_records FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Finansal kayıt güncelleme politikası" ON public.financial_records FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Authenticated users can delete notes" ON public.notes FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can insert notes" ON public.notes FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can view notes" ON public.notes FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can update notes" ON public.notes FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Kayıt ekleme politikası" ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Kayıt görüntüleme politikası" ON public.registrations FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Kayıt güncelleme politikası" ON public.registrations FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Authenticated users can delete waitlist" ON public.waitlist FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can insert waitlist" ON public.waitlist FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can view waitlist" ON public.waitlist FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Authenticated users can update waitlist" ON public.waitlist FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "Haftalık konu silme politikası" ON public.weekly_themes FOR DELETE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Haftalık konu ekleme politikası" ON public.weekly_themes FOR INSERT TO authenticated
  WITH CHECK (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Haftalık konu görüntüleme politikası" ON public.weekly_themes FOR SELECT TO authenticated
  USING (( SELECT public.is_admin() AS is_admin));
CREATE POLICY "Ziyaretçi yalnızca bu haftanın konusunu görebilir" ON public.weekly_themes FOR SELECT TO anon
  USING ((week_start = (date_trunc('week'::text, (now() AT TIME ZONE 'Europe/Istanbul'::text)))::date));
CREATE POLICY "Haftalık konu güncelleme politikası" ON public.weekly_themes FOR UPDATE TO authenticated
  USING (( SELECT public.is_admin() AS is_admin))
  WITH CHECK (( SELECT public.is_admin() AS is_admin));

-- ---------------------------------------------------------------------
-- 8. YETKİLER
-- ---------------------------------------------------------------------
-- RLS politikalarına ek olarak tablo/kolon düzeyindeki yetkiler. Ziyaretçi (anon) yalnızca
-- herkese açık takvimin okuduğu tablo ve kolonları görebilir.

REVOKE ALL ON public.registrations FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.registrations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.registrations TO service_role;
REVOKE ALL ON public.events FROM PUBLIC, anon, authenticated;
-- Herkese açık takvim yalnızca id, event_date, age_group, event_type kolonlarını okur.
-- Tüm kolonları okuyan eski sürüm yayından kalkınca bu yetki şu ikisiyle daraltılabilir:
--   REVOKE SELECT ON public.events FROM anon;
--   GRANT SELECT (id, event_date, age_group, event_type, is_active) ON public.events TO anon;
GRANT SELECT ON public.events TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.events TO service_role;
REVOKE ALL ON public.event_participants FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.event_participants TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.event_participants TO service_role;
GRANT SELECT (event_id, status) ON public.event_participants TO anon;
REVOKE ALL ON public.extension_history FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.extension_history TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.extension_history TO service_role;
REVOKE ALL ON public.financial_records FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.financial_records TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.financial_records TO service_role;
REVOKE ALL ON public.expenses FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.expenses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO service_role;
REVOKE ALL ON public.waitlist FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.waitlist TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.waitlist TO service_role;
REVOKE ALL ON public.notes FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.notes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notes TO service_role;
REVOKE ALL ON public.weekly_themes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.weekly_themes TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.weekly_themes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.weekly_themes TO service_role;
REVOKE ALL ON public.app_admins FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.app_admins TO service_role;
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_log TO service_role;

-- Bundan sonra oluşturulacak tablo, sayaç ve fonksiyonlar ziyaretçiye (anon) kendiliğinden
-- açılmasın; fonksiyonlar herkese (PUBLIC) kendiliğinden çalıştırılabilir olmasın.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
