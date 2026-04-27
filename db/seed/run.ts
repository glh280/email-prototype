/**
 * Idempotent seeder for the tracks + stages lookup tables.
 *
 * Invocation:   npm run db:seed
 *
 * Semantics:
 *   1. Upsert all 8 tracks (DEAL-01) keyed by `code` — `onConflictDoUpdate`
 *      rewrites label / default_priority / sort_order / active on re-run.
 *   2. Read back `code → id` map for tracks.
 *   3. Resolve each stage seed's trackCode to a real track_id (null stays null
 *      for universal stages).
 *   4. Upsert all 25 stages (STAGE-01) keyed by `code`.
 *
 * Idempotent by construction: re-running the script after data tweaks UPDATEs
 * rows in place; re-running with no tweaks is a no-op (same values rewritten).
 *
 * Why dotenv loads + dynamic import:
 *   `@/lib/db` imports `@/lib/env`, which runs Zod validation at module-load
 *   time. ESM import hoisting would run that validation BEFORE any top-level
 *   `config()` call, so we load dotenv first and then use a dynamic `import()`
 *   to pull the DB + schema modules only after the env is populated.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  // Dynamic imports — must run AFTER dotenv so @/lib/env sees the values.
  const { sql } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { tracks, stages } = await import("@/db/schema");
  const { TRACK_SEEDS } = await import("./tracks");
  const { STAGE_SEEDS } = await import("./stages");

  // 1. Upsert tracks keyed by code.
  await db
    .insert(tracks)
    .values(TRACK_SEEDS)
    .onConflictDoUpdate({
      target: tracks.code,
      set: {
        label: sql`excluded.label`,
        defaultPriority: sql`excluded.default_priority`,
        sortOrder: sql`excluded.sort_order`,
        active: sql`excluded.active`,
      },
    });

  // 2. Read back code → id for tracks so we can resolve stage FKs.
  const trackRows = await db
    .select({ id: tracks.id, code: tracks.code })
    .from(tracks);
  const trackIdByCode = new Map(trackRows.map((r) => [r.code, r.id] as const));

  // 3. Resolve each stage seed's trackCode → trackId.
  const stageInserts = STAGE_SEEDS.map((s) => {
    const trackId =
      s.trackCode === null ? null : trackIdByCode.get(s.trackCode) ?? null;

    if (s.trackCode !== null && trackId === null) {
      throw new Error(
        `Seed invariant violated: stage '${s.code}' references trackCode '${s.trackCode}' which was not found after upserting tracks.`,
      );
    }

    return {
      code: s.code,
      label: s.label,
      trackId,
      sortOrder: s.sortOrder,
      isTerminal: s.isTerminal ?? false,
    };
  });

  // 4. Upsert stages keyed by code.
  await db
    .insert(stages)
    .values(stageInserts)
    .onConflictDoUpdate({
      target: stages.code,
      set: {
        label: sql`excluded.label`,
        trackId: sql`excluded.track_id`,
        sortOrder: sql`excluded.sort_order`,
        isTerminal: sql`excluded.is_terminal`,
      },
    });

  console.log(`Seeded ${TRACK_SEEDS.length} tracks, ${STAGE_SEEDS.length} stages.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
