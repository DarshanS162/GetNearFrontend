-- ============================================================================
-- Migration: 000_init_extensions_and_functions
-- Purpose: Enable required PostgreSQL extensions and shared trigger utilities.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMENT ON EXTENSION "pgcrypto" IS 'Provides gen_random_uuid() for UUID primary key generation.';

-- Reusable trigger function to auto-update updated_at on row modification.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
    'Trigger function that sets updated_at to current timestamp before UPDATE.';
