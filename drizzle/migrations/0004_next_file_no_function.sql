-- Phase 1 Plan 03 — file_no auto-generation (DEAL-02a, D-02)
-- Per-year Postgres sequence, lazy-created on first call.
-- Counter is global across states within a year (TX-2026-0005, CA-2026-0006 are sequential).

CREATE OR REPLACE FUNCTION next_file_no(state_code text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
    seq_name text := 'deals_file_no_' || current_year::text || '_seq';
    next_n bigint;
    normalized_state text;
BEGIN
    -- Normalize state: null/empty → 'XX'; otherwise uppercase 2 chars
    IF state_code IS NULL OR length(trim(state_code)) = 0 THEN
        normalized_state := 'XX';
    ELSE
        normalized_state := upper(trim(state_code));
    END IF;

    -- Lazy-create the year's sequence (idempotent)
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);

    -- Atomically get next value
    EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_n;

    RETURN normalized_state || '-' || current_year::text || '-' || lpad(next_n::text, 4, '0');
END;
$$;
