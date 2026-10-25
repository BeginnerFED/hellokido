-- =====================================================================
-- pg_net out of the public schema (2026-10-25)
--
-- evening_push created the extension in public, which the security advisor flags. It cannot be
-- moved in place, so it is made again in the extensions schema. Its functions stay in the net
-- schema (net.http_post), so send_evening_reminder is unchanged; nothing was sent yet.
-- =====================================================================

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
