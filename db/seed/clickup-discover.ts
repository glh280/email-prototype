/**
 * ClickUp discovery script — Stage 1 of the ClickUp → dashboard import.
 *
 * Invocation:   npm run seed:clickup-discover
 *
 * Intent:
 *   This is a READ-ONLY reconnaissance pass against the ClickUp REST API.
 *   It makes NO database writes. Its only side effect is writing a JSON
 *   dump to `db/seed/.clickup-discovery.json` (gitignored) so the operator
 *   can see:
 *     - which workspace / space / folder / list ClickUp considers "deals"
 *     - the shape of a task within each list (custom fields, statuses,
 *       assignees) so Stage 2's field-mapping decisions are grounded in
 *       real data, not guesses.
 *
 * Auth:
 *   Personal API Token in `CLICKUP_API_TOKEN` env var. Pasted into the
 *   `Authorization` header RAW (not `Bearer <token>`) — that's ClickUp's
 *   convention for personal tokens (OAuth tokens use Bearer).
 *   Ref: https://clickup.com/api/developer-portal/authentication/
 *
 * Rate-limit posture:
 *   ClickUp rate-limits at 100 req/min per token on Personal/Free tier.
 *   For a typical single-operator workspace the walk is:
 *     1 call   : /team                     (list workspaces)
 *     N_teams  : /team/{id}/space          (spaces per team)
 *     N_spaces : /space/{id}/folder        (folders per space)
 *     N_spaces : /space/{id}/list          (folderless lists per space)
 *     N_folders: /folder/{id}/list         (lists per folder)
 *     N_lists  : /list/{id}/task?page=0    (first page of tasks per list)
 *   For a small workspace (<50 lists total) this stays well under the cap.
 *   A small `--max-lists` knob caps the sample-tasks phase for huge workspaces.
 *
 * Data handling:
 *   The JSON dump may contain PII (task titles mentioning deals + clients,
 *   assignee emails, custom field values). Hence the gitignore rule for
 *   `db/seed/.clickup-*.json`. Do NOT commit the output.
 *
 * What this script does NOT do:
 *   - Write to the database (that's Stage 2, `clickup-import.ts`)
 *   - Map fields (that's the conversation AFTER this script runs)
 *   - Make any destructive ClickUp call (no POST/PUT/DELETE)
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const CLICKUP_API = "https://api.clickup.com/api/v2";
const OUTPUT_PATH = resolve("db/seed/.clickup-discovery.json");

// ─── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(name: string, fallback: number): number {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const v = parseInt(args[idx + 1] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
const MAX_LISTS_FOR_SAMPLES = argValue("--max-lists", 40);
const SAMPLE_SIZE = argValue("--sample-size", 2);

// ─── ClickUp API types (partial — only fields we need) ──────────────────
type Team = { id: string; name: string };
type Space = { id: string; name: string; archived?: boolean };
type Folder = { id: string; name: string; archived?: boolean };
type ClickUpList = {
  id: string;
  name: string;
  archived?: boolean;
  task_count?: number | null;
  folder?: { id: string; name: string } | null;
  space?: { id: string; name: string } | null;
};
type Task = {
  id: string;
  name: string;
  status?: { status: string; type: string };
  date_created?: string;
  date_updated?: string;
  assignees?: Array<{ id: number; email?: string; username?: string }>;
  custom_fields?: Array<{
    id: string;
    name: string;
    type: string;
    value?: unknown;
    type_config?: unknown;
  }>;
  url?: string;
};

// ─── HTTP helper with token auth, JSON parse, and error surfacing ───────
async function cu<T>(path: string): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error(
      "CLICKUP_API_TOKEN missing from .env.local — see .planning/VENDORS.md for token provisioning.",
    );
  }
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `ClickUp ${res.status} on GET ${path}\n${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

// ─── Discovery walk ─────────────────────────────────────────────────────
async function discover(): Promise<void> {
  console.log("▶ ClickUp discovery starting (read-only, no DB writes)\n");

  // 1. Teams (ClickUp's name for workspaces).
  const { teams } = await cu<{ teams: Team[] }>("/team");
  console.log(`• ${teams.length} workspace(s) found`);

  const tree: Array<{
    team: Team;
    spaces: Array<{
      space: Space;
      folders: Array<{ folder: Folder; lists: ClickUpList[] }>;
      folderlessLists: ClickUpList[];
    }>;
  }> = [];

  const allLists: ClickUpList[] = [];

  for (const team of teams) {
    console.log(`  ├─ workspace "${team.name}" (id ${team.id})`);

    // 2. Spaces.
    const { spaces } = await cu<{ spaces: Space[] }>(
      `/team/${team.id}/space?archived=false`,
    );
    const spaceBranches: (typeof tree)[number]["spaces"] = [];

    for (const space of spaces) {
      console.log(`  │  ├─ space "${space.name}" (id ${space.id})`);

      // 3a. Folders.
      const { folders } = await cu<{ folders: Folder[] }>(
        `/space/${space.id}/folder?archived=false`,
      );
      const folderBranches: Array<{
        folder: Folder;
        lists: ClickUpList[];
      }> = [];

      for (const folder of folders) {
        const { lists } = await cu<{ lists: ClickUpList[] }>(
          `/folder/${folder.id}/list?archived=false`,
        );
        folderBranches.push({ folder, lists });
        allLists.push(...lists);
        console.log(
          `  │  │  ├─ folder "${folder.name}" → ${lists.length} list(s)`,
        );
      }

      // 3b. Folderless lists (lists attached directly to the space).
      const { lists: folderlessLists } = await cu<{ lists: ClickUpList[] }>(
        `/space/${space.id}/list?archived=false`,
      );
      allLists.push(...folderlessLists);
      if (folderlessLists.length > 0) {
        console.log(
          `  │  │  └─ ${folderlessLists.length} folderless list(s)`,
        );
      }

      spaceBranches.push({
        space,
        folders: folderBranches,
        folderlessLists,
      });
    }

    tree.push({ team, spaces: spaceBranches });
  }

  console.log(`\n• ${allLists.length} total list(s) discovered`);

  // 4. Sample tasks — cap to avoid rate-limit on huge workspaces.
  const listsForSampling = allLists.slice(0, MAX_LISTS_FOR_SAMPLES);
  if (allLists.length > MAX_LISTS_FOR_SAMPLES) {
    console.log(
      `  (sampling first ${MAX_LISTS_FOR_SAMPLES} of ${allLists.length} — raise with --max-lists N)`,
    );
  }

  const samples: Record<
    string,
    { list: ClickUpList; taskCount: number; tasks: Task[] }
  > = {};

  for (const list of listsForSampling) {
    try {
      const { tasks } = await cu<{ tasks: Task[] }>(
        `/list/${list.id}/task?page=0&archived=false&subtasks=false&include_closed=true`,
      );
      samples[list.id] = {
        list,
        taskCount: tasks.length,
        tasks: tasks.slice(0, SAMPLE_SIZE),
      };
      console.log(
        `  • "${list.name}" (${list.id}) — ${tasks.length} task(s) on page 0, kept ${Math.min(tasks.length, SAMPLE_SIZE)} sample(s)`,
      );
    } catch (err) {
      console.log(
        `  ⚠ "${list.name}" (${list.id}) — sample fetch failed: ${(err as Error).message}`,
      );
    }
  }

  // 5. Write the dump.
  const payload = {
    discovered_at: new Date().toISOString(),
    max_lists_sampled: MAX_LISTS_FOR_SAMPLES,
    sample_size: SAMPLE_SIZE,
    tree,
    samples,
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);

  // 6. Human summary — helps operator pick the right list.
  console.log(`\n─── summary ─────────────────────────────────────────`);
  console.log(`Workspaces: ${tree.length}`);
  for (const t of tree) {
    for (const s of t.spaces) {
      const folderLists = s.folders.reduce(
        (acc, f) => acc + f.lists.length,
        0,
      );
      const totalLists = folderLists + s.folderlessLists.length;
      console.log(
        `  ${t.team.name} › ${s.space.name}: ${totalLists} list(s) (${s.folders.length} folder(s))`,
      );
    }
  }
  console.log(`\nLists ranked by task count (first page only):`);
  const ranked = Object.values(samples)
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 10);
  for (const r of ranked) {
    const loc = r.list.folder
      ? `${r.list.space?.name} › ${r.list.folder.name}`
      : `${r.list.space?.name} (folderless)`;
    console.log(
      `  ${r.taskCount.toString().padStart(4)} tasks  ${r.list.id}  ${loc} › ${r.list.name}`,
    );
  }

  console.log(
    `\nNext: open ${OUTPUT_PATH} and look at one list's \`samples[listId].tasks[0]\`.
Tell the assistant:
  - which list ID holds deals
  - which custom_fields map to: track, stage, main_contact_name, main_contact_email, file_no (if any), created_at
  - whether deals are structured as tasks in a single list, or spread across folders/spaces`,
  );
}

discover()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Discovery failed:", err.message);
    process.exit(1);
  });
