/**
 * ClickUp import script — Stage 2 of the ClickUp → dashboard import.
 *
 * Invocation:
 *   npm run seed:clickup-import                   # dry-run by default
 *   npm run seed:clickup-import -- --apply        # real writes
 *   npm run seed:clickup-import -- --limit 3      # first 3 tasks only
 *   npm run seed:clickup-import -- --list LISTID  # single ClickUp list
 *
 * SAFETY DEFAULTS:
 *   - Defaults to `--dry-run` (no DB writes). You must pass `--apply` to
 *     actually write. This is the inverse of `db:seed` because imports are
 *     higher-risk (variable data, potential duplicates).
 *   - Per-row transactions: one failed row does NOT roll back earlier rows.
 *     Each row's deal + contact + deal_people + audit is one atomic tx;
 *     failures are logged and the loop continues.
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Reads CLICKUP_API_TOKEN from .env.local (fail-fast if missing).
 *   2. Walks every WF list (operator decision: "Import every WF list").
 *   3. Maps each task → `CreateDealInput` using per-list field maps.
 *   4. For each task, calls `createDealCore(input, user)` which:
 *        - Generates a fresh file_no only if ClickUp's FILE # is empty
 *        - Upserts contact by email, creates deal_people main_contact row
 *        - Writes audit row for deal + contact + deal_people
 *      (behavior bit-for-bit identical to the createDeal server action)
 *   5. Writes a supplementary audit row tagged `clickup_import` so the
 *     provenance is visible forever.
 *
 * WHAT THIS SCRIPT DOES NOT DO:
 *   - Reconcile: it ADDS, doesn't UPDATE. Re-running will create duplicate
 *     deals. For idempotency we'd need a `clickup_task_id` column on deals
 *     (future work — call it D-19).
 *   - Infer stage beyond the default: all imports land on the dashboard's
 *     `pre_screen_qualification` stage. Carrie advances manually.
 *   - Map custom fields other than FILE #, contact name, contact email.
 *     The other 50+ ClickUp fields per task are outside the current deal
 *     schema; P4+ may bring them in via a dedicated clickup-notes pipeline.
 *
 * FIELD MAPPING (operator-approved):
 *   ClickUp list name          → dashboard track_code
 *   ClickUp task.name          → deal.title
 *   ClickUp custom "FILE #"    → deal.file_no (fallback to fileNoGenerator)
 *   ClickUp custom "Buyer Name" / "Seller Name" / task first assignee
 *                              → deal.main_contact_name (first non-empty)
 *   ClickUp custom "Email" / "Buyer Email" / "Seller Email" / assignee email
 *                              → deal.main_contact_email (first non-empty)
 *   ClickUp task.date_created  → deal.created_at (preserved via direct INSERT
 *                                 is NOT currently supported — D-19 future work)
 *
 * Operator identity:
 *   Deals are created as the user whose email is in IMPORT_OPERATOR_EMAIL
 *   (env var) OR falls back to the first user in the users table. This
 *   preserves GLBA audit attribution (D-05): the audit log shows a real
 *   person, not a synthetic system user. The supplementary audit row's
 *   `source: "clickup_import"` tag distinguishes import from manual entry.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const CLICKUP_API = "https://api.clickup.com/api/v2";

// ─── CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = !APPLY;
const FROM_FILE = args.includes("--from-file"); // read discovery JSON instead of hitting API
function argStr(name: string): string | null {
  const i = args.indexOf(name);
  return i !== -1 ? (args[i + 1] ?? null) : null;
}
function argNum(name: string, fallback: number): number {
  const v = argStr(name);
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const LIMIT = argNum("--limit", Infinity);
const LIST_FILTER = argStr("--list"); // single list id
const OPERATOR_EMAIL_OVERRIDE = argStr("--operator-email");

// ─── Type aliases for ClickUp payloads we consume ───────────────────────
type CUField = {
  id: string;
  name: string;
  type: string;
  value?: unknown;
};
type CUTask = {
  id: string;
  name: string;
  status?: { status: string };
  date_created?: string;
  date_updated?: string;
  assignees?: Array<{ id: number; email?: string; username?: string }>;
  custom_fields?: CUField[];
  url?: string;
};
type CUList = { id: string; name: string };

// ─── List → track mapping (operator-approved) ───────────────────────────
// Keys are ClickUp list names; values are dashboard track_code (must match
// db/seed/tracks.ts — TE, FL, DP, PO, EC, SL, BL, GI). We strip the emoji
// prefix on lookup, so the mapping matches against the cleaned name.
const LIST_TO_TRACK: Record<string, string> = {
  "MAIN WORKFLOW": "GI", // general inbox / catch-all
  "FUNDING/LENDING WF": "FL",
  "TITLE & ESCROW WORKFLOW": "TE",
  "EDUCATION & CONSULTING WF": "EC",
  "STRATEGY SESSION/DEAL STRUCTURING WF": "DP", // deal desk / pipeline
  "PARTNERSHIP WORKFLOW": "PO", // partner ops
  "GENERAL /NOT SURE WF": "GI",
  "INTAKE WORKFLOW": "GI",
  // "Partner Profiles" and "STM Partner's Profile" are NOT deals — skipped.
};
const EMOJI_PREFIX_RE = /^[^\w]+\s*/u; // strip leading emoji / punctuation

function lookupTrack(listName: string): string | null {
  const cleaned = listName.replace(EMOJI_PREFIX_RE, "").trim();
  return LIST_TO_TRACK[cleaned] ?? null;
}

// ─── Custom-field helpers ───────────────────────────────────────────────
function getField(task: CUTask, fieldName: string): string | null {
  const f = task.custom_fields?.find(
    (x) => x.name.toLowerCase() === fieldName.toLowerCase(),
  );
  if (!f) return null;
  const v = f.value;
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null; // drop_down values, arrays etc. — not used in the deal schema
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return null;
}

// ─── Task → CreateDealInput mapping ─────────────────────────────────────
type MappedDeal = {
  trackCode: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  mainContactName: string | null;
  mainContactEmail: string | null;
  propertyAddress: string | null;
  fileNoFromClickup: string | null; // for audit tagging; actual use see below
  sourceTaskId: string;
  sourceTaskUrl: string | null;
  sourceListName: string;
};

function mapTask(task: CUTask, list: CUList, trackCode: string): MappedDeal {
  // Contact name: task-level assignees → Buyer Name → Seller Name → null
  const assigneeName = task.assignees?.[0]?.username ?? null;
  const mainContactName = firstNonEmpty(
    getField(task, "Buyer Name"),
    getField(task, "Seller Name"),
    assigneeName,
  );

  // Contact email: assignee email → Buyer Email → Seller Email → generic Email
  const assigneeEmail = task.assignees?.[0]?.email ?? null;
  const mainContactEmail = firstNonEmpty(
    assigneeEmail,
    getField(task, "Buyer Email"),
    getField(task, "Seller Email"),
    getField(task, "Email"),
  );

  return {
    trackCode,
    priority: "MEDIUM", // default; Carrie re-prioritizes post-import
    title: task.name.trim() || "(untitled ClickUp task)",
    mainContactName,
    mainContactEmail,
    propertyAddress: getField(task, "Property Address"),
    fileNoFromClickup: getField(task, "FILE #"),
    sourceTaskId: task.id,
    sourceTaskUrl: task.url ?? null,
    sourceListName: list.name,
  };
}

// ─── HTTP helper ────────────────────────────────────────────────────────
async function cu<T>(path: string): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN missing from .env.local");
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `ClickUp ${res.status} on GET ${path}\n${(await res.text()).slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Safety guard: --from-file reads the sampled discovery JSON (capped at
  // --sample-size N per list, default 2), which is NOT the complete dataset.
  // It's fine for dry-runs to validate mapping shape, but a real --apply
  // must always hit the live API to ingest every task.
  if (FROM_FILE && APPLY) {
    throw new Error(
      "Refusing to --apply with --from-file: the discovery JSON is a SAMPLE (~2 tasks per list), not the full dataset. Drop --from-file for the real import.",
    );
  }

  console.log(
    `▶ ClickUp import — ${DRY_RUN ? "DRY RUN (no DB writes)" : "APPLY (writes enabled)"}`,
  );
  if (FROM_FILE) {
    console.log(
      `  ⚠ --from-file active: reading SAMPLED data from db/seed/.clickup-discovery.json`,
    );
    console.log(
      `    (expect fewer tasks than reality; run without --from-file for the full walk)`,
    );
  }
  if (LIST_FILTER) console.log(`  filter: list ${LIST_FILTER}`);
  if (LIMIT !== Infinity) console.log(`  limit: ${LIMIT} tasks`);
  console.log();

  // Source 1: load discovery JSON (fast path, no API hits) if --from-file
  // Source 2: walk API afresh (slower, reflects current ClickUp state)
  let tasksWithList: Array<{ task: CUTask; list: CUList }> = [];

  if (FROM_FILE) {
    const dump = JSON.parse(
      readFileSync(resolve("db/seed/.clickup-discovery.json"), "utf-8"),
    );
    for (const s of Object.values(dump.samples) as Array<{
      list: CUList;
      tasks: CUTask[];
    }>) {
      for (const t of s.tasks) tasksWithList.push({ task: t, list: s.list });
    }
    console.log(
      `• Loaded ${tasksWithList.length} tasks from discovery JSON (cached)`,
    );
  } else {
    // Fresh walk: all WF lists across the workspace
    const { teams } = await cu<{ teams: Array<{ id: string }> }>("/team");
    for (const team of teams) {
      const { spaces } = await cu<{ spaces: Array<{ id: string }> }>(
        `/team/${team.id}/space?archived=false`,
      );
      for (const space of spaces) {
        const { lists: folderless } = await cu<{ lists: CUList[] }>(
          `/space/${space.id}/list?archived=false`,
        );
        const { folders } = await cu<{ folders: Array<{ id: string }> }>(
          `/space/${space.id}/folder?archived=false`,
        );
        const folderLists: CUList[] = [];
        for (const f of folders) {
          const { lists } = await cu<{ lists: CUList[] }>(
            `/folder/${f.id}/list?archived=false`,
          );
          folderLists.push(...lists);
        }
        for (const list of [...folderless, ...folderLists]) {
          if (LIST_FILTER && list.id !== LIST_FILTER) continue;
          try {
            const { tasks } = await cu<{ tasks: CUTask[] }>(
              `/list/${list.id}/task?page=0&archived=false&subtasks=false&include_closed=true`,
            );
            for (const t of tasks) tasksWithList.push({ task: t, list });
          } catch (err) {
            console.log(
              `  ⚠ list ${list.id} (${list.name}): fetch failed — ${(err as Error).message}`,
            );
          }
        }
      }
    }
    console.log(`• Pulled ${tasksWithList.length} tasks from API`);
  }

  // Filter + map
  const skipped: Array<{ reason: string; task: CUTask; list: CUList }> = [];
  const mapped: MappedDeal[] = [];

  for (const { task, list } of tasksWithList) {
    if (list.name.toLowerCase().includes("partner profile")) {
      skipped.push({ reason: "not a deal list", task, list });
      continue;
    }
    const track = lookupTrack(list.name);
    if (!track) {
      skipped.push({ reason: `no track mapping for "${list.name}"`, task, list });
      continue;
    }
    mapped.push(mapTask(task, list, track));
  }

  const limited = mapped.slice(0, LIMIT);

  // ─── Dry-run table ─────────────────────────────────────────────────────
  console.log(`\n─── mapped ${limited.length} task(s) (showing all) ───`);
  console.log();
  const cols = ["#", "track", "listName", "title", "fileNo?", "contact", "email"];
  const rows: string[][] = [];
  for (let i = 0; i < limited.length; i++) {
    const d = limited[i];
    rows.push([
      String(i + 1).padStart(2),
      d.trackCode,
      d.sourceListName.slice(0, 24).padEnd(24),
      d.title.slice(0, 42).padEnd(42),
      (d.fileNoFromClickup ?? "(gen)").padEnd(14),
      (d.mainContactName ?? "-").slice(0, 24).padEnd(24),
      (d.mainContactEmail ?? "-").slice(0, 32),
    ]);
  }
  console.log(cols.join("  "));
  console.log("".padEnd(160, "─"));
  for (const r of rows) console.log(r.join("  "));

  if (skipped.length > 0) {
    console.log(`\n─── skipped ${skipped.length} task(s) ───`);
    const counts: Record<string, number> = {};
    for (const s of skipped) counts[s.reason] = (counts[s.reason] ?? 0) + 1;
    for (const [reason, n] of Object.entries(counts)) {
      console.log(`  ${n}  ${reason}`);
    }
  }

  if (DRY_RUN) {
    console.log(
      `\n═══ DRY RUN COMPLETE ═══
${limited.length} deal(s) would be created.
${skipped.length} task(s) would be skipped.
No DB writes were performed.

To apply: npm run seed:clickup-import -- --apply
To apply to prod: railway run --service npr-dashboard-prototype -- npm run seed:clickup-import -- --apply`,
    );
    return;
  }

  // ─── APPLY PATH ────────────────────────────────────────────────────────
  console.log(`\n▶ APPLYING — writing ${limited.length} deals to database`);

  // Dynamic imports (deferred past dotenv) to match db/seed/run.ts convention.
  const { db } = await import("@/lib/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { createDealCore } = await import("@/lib/deal-actions-core");
  const { writeAuditLog } = await import("@/lib/audit");

  // Resolve operator identity: --operator-email → IMPORT_OPERATOR_EMAIL → first user.
  const operatorEmail =
    OPERATOR_EMAIL_OVERRIDE ?? process.env.IMPORT_OPERATOR_EMAIL ?? null;
  let operator: { id: string; email: string } | null = null;
  if (operatorEmail) {
    const [u] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, operatorEmail))
      .limit(1);
    if (!u) throw new Error(`User not found by email: ${operatorEmail}`);
    operator = u;
  } else {
    const [u] = await db.select({ id: users.id, email: users.email }).from(users).limit(1);
    if (!u) {
      throw new Error(
        "No users in DB — seed a user first or pass --operator-email",
      );
    }
    operator = u;
    console.log(
      `  ⚠ No --operator-email given; using first user: ${operator.email}`,
    );
  }

  let created = 0;
  let failed = 0;
  for (let i = 0; i < limited.length; i++) {
    const d = limited[i];
    try {
      const { fileNo, dealId } = await createDealCore(
        {
          trackCode: d.trackCode as "TE" | "FL" | "DP" | "PO" | "EC" | "SL" | "BL" | "GI",
          priority: d.priority,
          title: d.title,
          mainContactName: d.mainContactName,
          mainContactEmail: d.mainContactEmail,
          propertyAddress: d.propertyAddress,
          titleCtc: false,
          lenderCtc: false,
        },
        operator,
      );
      // Supplementary provenance audit (not in createDealCore — this is
      // import-specific metadata).
      await db.transaction(async (tx) => {
        await writeAuditLog(tx, {
          tableName: "deals",
          recordId: dealId,
          operation: "update", // not "create" — the create was already audited
          beforeJson: null,
          afterJson: {
            source: "clickup_import",
            clickup_task_id: d.sourceTaskId,
            clickup_task_url: d.sourceTaskUrl,
            clickup_list_name: d.sourceListName,
            clickup_file_no: d.fileNoFromClickup, // preserved for reconciliation
          },
          user: operator!,
        });
      });
      console.log(`  ${(i + 1).toString().padStart(2)}. ✓ ${fileNo}  ${d.title.slice(0, 60)}`);
      created++;
    } catch (err) {
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ✗ FAILED ${d.title.slice(0, 60)} — ${(err as Error).message}`,
      );
      failed++;
    }
  }

  console.log(
    `\n═══ IMPORT COMPLETE ═══\n  created: ${created}\n  failed : ${failed}\n  skipped: ${skipped.length}\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Import aborted:", err);
    process.exit(1);
  });
