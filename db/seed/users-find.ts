/**
 * users-find.ts — read-only user lookup helper for operator probes.
 *
 * Usage:
 *   npm run db:users:find -- --email somebody@example.com
 *   railway ssh --service npr-dashboard-prototype npm run db:users:find -- --email Carrie@unitedtitlesolutions.com
 *
 * Writes nothing. Prints JSON-like output for one matched row, or lists
 * all users if no match. Exists so operators (and assistants) have a
 * zero-risk way to confirm a user identity before a write-path script
 * tries to attribute a row to them.
 *
 * Match is case-insensitive on email. If no --email flag, lists all users.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const i = args.indexOf("--email");
  const email = i !== -1 ? args[i + 1] : null;

  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { users } = await import("@/db/schema");

  if (email) {
    const [hit] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    if (hit) {
      console.log("FOUND:");
      console.log("  id    :", hit.id);
      console.log("  email :", hit.email);
      console.log("  name  :", hit.name);
      process.exit(0);
    }
    console.log(`NOT FOUND: no user with email (case-insensitive) = ${email}`);
    console.log("All users in this database:");
  } else {
    console.log("All users in this database:");
  }

  const all = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .orderBy(users.email);
  console.log("  total:", all.length);
  for (const u of all) console.log("  ", u.email, "—", u.name);

  process.exit(email ? 1 : 0); // exit 1 when NOT FOUND so scripts can detect
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(2);
});
