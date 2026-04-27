import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type User } from "@/db/schema";

/**
 * Users registry backed by the `users` table.
 *
 * Identity source of truth is Cloudflare Access — this table holds an app-side
 * cache of authenticated users for FK joins, display names, and attribution.
 * The first time an Access-authenticated user hits the app, `upsertUserFromAccess`
 * creates the row from the JWT claims; subsequent requests update display fields
 * (name, image) if they've changed.
 */

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return rows[0];
}

/**
 * Insert-or-update a user from verified Cloudflare Access claims.
 *
 * Idempotent: safe to call on every request. If the row exists and the
 * display fields match, the database still writes `updated_at = now()` — the
 * caller can treat this as "touch the user's last-seen timestamp" too.
 */
export async function upsertUserFromAccess(claims: {
  email: string;
  name?: string;
  image?: string;
}): Promise<User> {
  const normalizedEmail = claims.email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        name: claims.name ?? existing.name,
        image: claims.image ?? existing.image,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: claims.name ?? null,
      image: claims.image ?? null,
    })
    .returning();
  return inserted;
}
