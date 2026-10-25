-- =====================================================================
-- Flexible money and catalogs (2026-10-24)
--
-- Additive only. The current app keeps working against this schema unchanged:
--   * financial_records, registrations, extension_history and their functions are not touched.
--     The package payment flows keep their single ledger and its copy-sync logic.
--   * Payments outside the package flow (part payments, instalments, income that is not a
--     child's package) go to the new table income_entries.
--   * expenses.expense_type moves from a fixed CHECK list to the expense_categories catalog;
--     every existing code is seeded first, so no row changes.
-- Every new table: RLS for admins only, audit trigger, no access for anon.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Settings shared by the web panel and the phone app
-- ---------------------------------------------------------------------
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is 'Panel-wide settings (one row per key).';

insert into public.app_settings (key, value) values
  ('card_settlement_days', '30'::jsonb),  -- card payments reach the bank this many days later
  ('card_commission_rate', '0'::jsonb);   -- POS commission in percent, taken before the bank

-- ---------------------------------------------------------------------
-- 2. Package catalog: names in three languages, order, suggested price, on/off.
--    Codes stay the fixed list the lesson rules know (lessonUsage.js and the CHECKs on
--    registrations / extension_history); lessons and family mirror those rules and are not
--    edited from the panel.
-- ---------------------------------------------------------------------
create table public.package_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_tr text not null check (btrim(name_tr) <> ''),
  name_en text not null check (btrim(name_en) <> ''),
  name_uk text not null check (btrim(name_uk) <> ''),
  lessons integer check (lessons is null or lessons > 0),
  family text not null check (family in ('single', 'monthly', 'quarter', 'quarter_half', 'free')),
  default_price numeric check (default_price is null or default_price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.package_types is 'Package catalog for the panel. Codes and lessons must match lessonUsage.js.';

insert into public.package_types (code, name_tr, name_en, name_uk, lessons, family, sort_order) values
  ('tek-seferlik',      'Tek seferlik katılım',     'One-time visit',               'Разове відвідування',            1,    'single',       10),
  ('hafta-1',           'Haftada 1 gün',            '1 day a week',                 '1 день на тиждень',              4,    'monthly',      20),
  ('hafta-2',           'Haftada 2 gün',            '2 days a week',                '2 дні на тиждень',               8,    'monthly',      30),
  ('hafta-3',           'Haftada 3 gün',            '3 days a week',                '3 дні на тиждень',               12,   'monthly',      40),
  ('hafta-4',           'Haftada 4 gün',            '4 days a week',                '4 дні на тиждень',               16,   'monthly',      50),
  ('3ay-hafta-1',       '3 aylık - 12 atölye',      '3 months - 12 workshops',      '3 місяці - 12 занять',           12,   'quarter',      60),
  ('3ay-hafta-2',       '3 aylık - 24 atölye',      '3 months - 24 workshops',      '3 місяці - 24 заняття',          24,   'quarter',      70),
  ('3ay-yarim-hafta-1', '3 aylık yarım - 6 atölye', '3 months, half - 6 workshops', '3 місяці, половина - 6 занять',  6,    'quarter_half', 80),
  ('3ay-yarim-hafta-2', '3 aylık yarım - 12 atölye','3 months, half - 12 workshops','3 місяці, половина - 12 занять', 12,   'quarter_half', 90),
  ('ucretsiz',          'Ücretsiz katılım',         'Free',                         'Безкоштовно',                    null, 'free',         100);

-- ---------------------------------------------------------------------
-- 3. Expense categories (was a fixed CHECK list)
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name_tr text not null check (btrim(name_tr) <> ''),
  name_en text not null check (btrim(name_en) <> ''),
  name_uk text not null check (btrim(name_uk) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_categories is 'Expense categories. System rows can be renamed or hidden, never deleted.';

insert into public.expense_categories (code, name_tr, name_en, name_uk, sort_order, is_system) values
  ('kira',     'Kira',     'Rent',        'Оренда',         10,  true),
  ('elektrik', 'Elektrik', 'Electricity', 'Електроенергія', 20,  true),
  ('su',       'Su',       'Water',       'Вода',           30,  true),
  ('dogalgaz', 'Doğalgaz', 'Natural gas', 'Газ',            40,  true),
  ('internet', 'İnternet', 'Internet',    'Інтернет',       50,  true),
  ('maas',     'Maaş',     'Salary',      'Зарплата',       60,  true),
  ('malzeme',  'Malzeme',  'Materials',   'Матеріали',      70,  true),
  ('mutfak',   'Mutfak',   'Kitchen',     'Кухня',          80,  true),
  ('reklam',   'Reklam',   'Advertising', 'Реклама',        90,  true),
  ('filament', 'Filament', 'Filament',    'Філамент',       100, true),
  ('diger',    'Diğer',    'Other',       'Інше',           999, true);

alter table public.expenses drop constraint valid_expense_type;
alter table public.expenses
  add constraint expenses_expense_type_fkey foreign key (expense_type) references public.expense_categories (code);

-- expenses.updated_at was only ever written by the client
create trigger update_expenses_updated_at before update on public.expenses
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 4. Recurring expenses (rent, salaries, bills): a template the panel offers every month
-- ---------------------------------------------------------------------
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  expense_type text not null references public.expense_categories (code),
  amount numeric check (amount is null or amount > 0),  -- null: the amount changes every month (bills)
  payment_method text not null check (payment_method in ('banka', 'nakit', 'kart')),
  day_of_month integer not null check (day_of_month between 1 and 31),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recurring_expenses is 'Monthly expense templates. An expense made from one keeps its id in expenses.recurring_expense_id.';

alter table public.expenses
  add column recurring_expense_id uuid references public.recurring_expenses (id) on delete set null;

create index idx_expenses_recurring_expense_id on public.expenses using btree (recurring_expense_id);

-- ---------------------------------------------------------------------
-- 5. Income categories (income that is not a child's package)
-- ---------------------------------------------------------------------
create table public.income_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name_tr text not null check (btrim(name_tr) <> ''),
  name_en text not null check (btrim(name_en) <> ''),
  name_uk text not null check (btrim(name_uk) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.income_categories (code, name_tr, name_en, name_uk, sort_order, is_system) values
  ('etkinlik',   'Etkinlik',    'Event',          'Захід',           10,  true),
  ('dogum-gunu', 'Doğum günü',  'Birthday party', 'День народження', 20,  true),
  ('satis',      'Satış',       'Sales',          'Продаж',          30,  true),
  ('diger',      'Diğer',       'Other',          'Інше',            999, true);

-- ---------------------------------------------------------------------
-- 6. Income entries outside the package flow
--    kind 'child': a part payment, instalment or extra fee from a child's family. It never
--                  changes the package, its period or its lessons.
--    kind 'other': income that belongs to no child (events, parties, sales).
--    A pending entry carries the expected amount and, if known, the due date.
-- ---------------------------------------------------------------------
create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('child', 'other')),
  registration_id uuid references public.registrations (id) on delete restrict,
  category text references public.income_categories (code),
  description text,
  amount numeric not null check (amount > 0),
  payment_status text not null default 'odendi' check (payment_status in ('odendi', 'beklemede')),
  payment_method text not null check (payment_method in ('banka', 'nakit', 'kart', 'belirlenmedi')),
  payment_date timestamptz,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_entries_paid_has_date check (payment_status <> 'odendi' or payment_date is not null),
  constraint income_entries_paid_has_method check (payment_status <> 'odendi' or payment_method <> 'belirlenmedi'),
  constraint income_entries_child_has_registration check (kind <> 'child' or registration_id is not null),
  constraint income_entries_other_has_category check (kind <> 'other' or category is not null)
);

comment on table public.income_entries is 'Income outside the package flow. Package payments stay in financial_records.';

create index idx_income_entries_payment_date on public.income_entries using btree (payment_date);
create index idx_income_entries_registration_id on public.income_entries using btree (registration_id);
create index idx_income_entries_status on public.income_entries using btree (payment_status);

-- ---------------------------------------------------------------------
-- 7. updated_at, audit, RLS and grants for the new tables
-- ---------------------------------------------------------------------
create trigger update_app_settings_updated_at before update on public.app_settings
  for each row execute function public.update_updated_at_column();
create trigger update_package_types_updated_at before update on public.package_types
  for each row execute function public.update_updated_at_column();
create trigger update_expense_categories_updated_at before update on public.expense_categories
  for each row execute function public.update_updated_at_column();
create trigger update_recurring_expenses_updated_at before update on public.recurring_expenses
  for each row execute function public.update_updated_at_column();
create trigger update_income_categories_updated_at before update on public.income_categories
  for each row execute function public.update_updated_at_column();
create trigger update_income_entries_updated_at before update on public.income_entries
  for each row execute function public.update_updated_at_column();

create trigger audit_app_settings after insert or delete or update on public.app_settings
  for each row execute function public.log_row_change();
create trigger audit_package_types after insert or delete or update on public.package_types
  for each row execute function public.log_row_change();
create trigger audit_expense_categories after insert or delete or update on public.expense_categories
  for each row execute function public.log_row_change();
create trigger audit_recurring_expenses after insert or delete or update on public.recurring_expenses
  for each row execute function public.log_row_change();
create trigger audit_income_categories after insert or delete or update on public.income_categories
  for each row execute function public.log_row_change();
create trigger audit_income_entries after insert or delete or update on public.income_entries
  for each row execute function public.log_row_change();

alter table public.app_settings enable row level security;
alter table public.package_types enable row level security;
alter table public.expense_categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.income_categories enable row level security;
alter table public.income_entries enable row level security;

-- Settings and the package catalog: read and update only (rows are fixed)
create policy "Admins read settings" on public.app_settings for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins update settings" on public.app_settings for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));

create policy "Admins read packages" on public.package_types for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins update packages" on public.package_types for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));

-- Categories: system rows are never deleted (and a category in use is kept by its foreign keys)
create policy "Admins read expense categories" on public.expense_categories for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add expense categories" on public.expense_categories for insert to authenticated
  with check ((select public.is_admin() as is_admin) and not is_system);
create policy "Admins update expense categories" on public.expense_categories for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
create policy "Admins delete own expense categories" on public.expense_categories for delete to authenticated
  using ((select public.is_admin() as is_admin) and not is_system);

create policy "Admins read income categories" on public.income_categories for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add income categories" on public.income_categories for insert to authenticated
  with check ((select public.is_admin() as is_admin) and not is_system);
create policy "Admins update income categories" on public.income_categories for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
create policy "Admins delete own income categories" on public.income_categories for delete to authenticated
  using ((select public.is_admin() as is_admin) and not is_system);

create policy "Admins read recurring expenses" on public.recurring_expenses for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add recurring expenses" on public.recurring_expenses for insert to authenticated
  with check ((select public.is_admin() as is_admin));
create policy "Admins update recurring expenses" on public.recurring_expenses for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
create policy "Admins delete recurring expenses" on public.recurring_expenses for delete to authenticated
  using ((select public.is_admin() as is_admin));

create policy "Admins read income entries" on public.income_entries for select to authenticated
  using ((select public.is_admin() as is_admin));
create policy "Admins add income entries" on public.income_entries for insert to authenticated
  with check ((select public.is_admin() as is_admin));
create policy "Admins update income entries" on public.income_entries for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
create policy "Admins delete income entries" on public.income_entries for delete to authenticated
  using ((select public.is_admin() as is_admin));

revoke all on public.app_settings from public, anon, authenticated;
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

revoke all on public.package_types from public, anon, authenticated;
grant select, update on public.package_types to authenticated;
grant all on public.package_types to service_role;

revoke all on public.expense_categories from public, anon, authenticated;
grant select, insert, update, delete on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;

revoke all on public.recurring_expenses from public, anon, authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant all on public.recurring_expenses to service_role;

revoke all on public.income_categories from public, anon, authenticated;
grant select, insert, update, delete on public.income_categories to authenticated;
grant all on public.income_categories to service_role;

revoke all on public.income_entries from public, anon, authenticated;
grant select, insert, update, delete on public.income_entries to authenticated;
grant all on public.income_entries to service_role;

notify pgrst, 'reload schema';
