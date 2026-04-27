-- Migration 0007: Backfill deal_people rows from legacy deals.main_contact_* columns.
--
-- Phase 3 closes D-03: the P1 convenience text columns (deals.main_contact_name +
-- main_contact_email) are superseded by the contacts registry + deal_people model
-- from Plan 01. This migration is IDEMPOTENT — the unique constraints on
-- contacts.email (partial lower(email) WHERE email IS NOT NULL) and on
-- deal_people (deal_id, role) guarantee re-runs are no-ops.
--
-- LEGACY COLUMNS ARE PRESERVED. They will be dropped in a separate P10
-- calibration-week migration once Carrie has validated the backfill.

-- STEP 1: Create one contact per distinct main_contact_email in deals.
-- ON CONFLICT DO NOTHING — the partial unique index on lower(email) dedupes on re-run.
--
-- DISTINCT ON (lower(email)) picks one canonical row per email group.
-- The ORDER BY inside determines which deal's name + created_by wins the tie —
-- we use created_at ASC so the FIRST-SEEN deal's metadata becomes the contact
-- (most intuitive for operator review). created_by is a UUID (no MIN/aggregate
-- available on uuid in Postgres), so DISTINCT ON is the right primitive here.
INSERT INTO "contacts" (full_name, email, role_hint, created_by)
SELECT
  COALESCE(NULLIF(TRIM(d.main_contact_name), ''), split_part(d.main_contact_email, '@', 1)) AS full_name,
  lower(TRIM(d.main_contact_email))                                                         AS email,
  'main_contact (backfill)'                                                                  AS role_hint,
  d.created_by                                                                               AS created_by
FROM (
  SELECT DISTINCT ON (lower(TRIM(main_contact_email)))
    main_contact_name,
    main_contact_email,
    created_by
  FROM "deals"
  WHERE main_contact_email IS NOT NULL
    AND TRIM(main_contact_email) != ''
  ORDER BY lower(TRIM(main_contact_email)), created_at ASC
) d
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- STEP 2: Link each deal to its main_contact via deal_people.
-- The (deal_id, role) unique index makes this idempotent on re-run.
INSERT INTO "deal_people" (deal_id, contact_id, role, created_by)
SELECT
  d.id,
  c.id,
  'main_contact',
  d.created_by
FROM "deals" d
INNER JOIN "contacts" c
  ON lower(c.email) = lower(TRIM(d.main_contact_email))
WHERE d.main_contact_email IS NOT NULL
  AND TRIM(d.main_contact_email) != ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- STEP 3: Inline column comments to flag the legacy status for future maintainers.
COMMENT ON COLUMN "deals"."main_contact_name" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
--> statement-breakpoint
COMMENT ON COLUMN "deals"."main_contact_email" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
