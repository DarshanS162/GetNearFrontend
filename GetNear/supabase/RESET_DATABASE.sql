-- ============================================================================
-- RESET DATABASE (GetNear)
-- Wipes public schema + removes seeded admin auth users.
-- Then run APPLY_ALL_MIGRATIONS.sql
-- ============================================================================

-- 1) Remove seeded admin Auth users
DELETE FROM auth.identities
WHERE user_id IN (
    'a1000001-0001-4001-8001-000000000001'::uuid,
    'a1000002-0002-4002-8002-000000000002'::uuid
)
OR provider_id IN (
    '8668879497@admin.getnear.app',
    '9552489313@admin.getnear.app',
    '+918668879497',
    '+919552489313',
    '918668879497',
    '919552489313'
)
OR provider_id LIKE '%8668879497%'
OR provider_id LIKE '%9552489313%';

DELETE FROM auth.users
WHERE id IN (
    'a1000001-0001-4001-8001-000000000001'::uuid,
    'a1000002-0002-4002-8002-000000000002'::uuid
)
OR email IN (
    '8668879497@admin.getnear.app',
    '9552489313@admin.getnear.app'
)
OR right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) IN ('8668879497', '9552489313');

-- 2) Drop and recreate public schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Done. Next: run APPLY_ALL_MIGRATIONS.sql
