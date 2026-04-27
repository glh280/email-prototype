import { z } from "zod";
import { ROLE_SLOT_CODES } from "@/lib/role-slots";

/**
 * Zod contracts for PEOPLE-01..05.
 *
 * Mirrors the P2 pattern (lib/deal-schema.ts):
 *   - `.strict()` on every .object() so unknown keys fail fast
 *   - Email: z.union([z.literal(""), z.string().trim().email(...)]).nullable().optional()
 *   - Split-parse for composite-input server actions: contactIdSchema parsed
 *     first, then updateContactSchema.safeParse(rest) — `.and()` does NOT
 *     propagate .strict(), so the action layer parses the id separately.
 *
 * PEOPLE-05 enforcement LAYER: role enum comes from lib/role-slots.ts so
 * adding/removing a slot is a one-file edit. Track-compatibility check
 * (isRoleValidForTrack) runs in the server action, not the Zod layer — slots
 * can only be validated against a given deal's track after we read the deal row.
 *
 * Error copy mirrors UI-SPEC "Copywriting Contract":
 *   - Required blank:  "{Field label} is required."
 *   - Email format:    "That email doesn't look right."
 */

export const createContactSchema = z
  .object({
    fullName: z
      .string({ message: "Full name is required." })
      .trim()
      .min(1, "Full name is required.")
      .max(200, "Full name must be 200 characters or fewer."),
    roleHint: z.string().trim().max(100).nullable().optional(),
    org: z.string().trim().max(200).nullable().optional(),
    email: z
      .union([
        z.literal(""),
        z.string().trim().email("That email doesn't look right."),
      ])
      .nullable()
      .optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required.")
      .max(200, "Full name must be 200 characters or fewer.")
      .optional(),
    roleHint: z.string().trim().max(100).nullable().optional(),
    org: z.string().trim().max(200).nullable().optional(),
    email: z
      .union([
        z.literal(""),
        z.string().trim().email("That email doesn't look right."),
      ])
      .nullable()
      .optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const contactIdSchema = z
  .object({
    id: z.string().uuid("That contact id isn't valid."),
  })
  .strict();

export type ContactIdInput = z.infer<typeof contactIdSchema>;

/**
 * upsertDealPersonSchema — assign a contact (or free-text value, for
 * lender_partner) to a per-deal role slot.
 *
 * The server action (Plan 04) layers two additional checks on top:
 *   1. isRoleValidForTrack(role, deal.track.code) — PEOPLE-05 track compat
 *   2. For free_text slots (lender_partner): require freeTextValue and
 *      prohibit contactId (or synthesize a minimal contact row); for
 *      contact_fk slots: require contactId and prohibit freeTextValue.
 * That asymmetric rule can't be expressed here without knowing the slot
 * metadata, so Zod only validates shape + role membership.
 */
export const upsertDealPersonSchema = z
  .object({
    dealId: z.string().uuid("That deal id isn't valid."),
    role: z.enum(ROLE_SLOT_CODES as [string, ...string[]], {
      message: "Unknown role slot.",
    }),
    contactId: z
      .string()
      .uuid("That contact id isn't valid.")
      .nullable()
      .optional(),
    freeTextValue: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();

export type UpsertDealPersonInput = z.infer<typeof upsertDealPersonSchema>;

export const removeDealPersonSchema = z
  .object({
    dealId: z.string().uuid("That deal id isn't valid."),
    role: z.enum(ROLE_SLOT_CODES as [string, ...string[]], {
      message: "Unknown role slot.",
    }),
  })
  .strict();

export type RemoveDealPersonInput = z.infer<typeof removeDealPersonSchema>;
