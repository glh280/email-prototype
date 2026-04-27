import { z } from "zod";

/**
 * Zod schema shared by the New Deal form (client-side validation) and the
 * createDeal server action (server-side re-validation — trust no input).
 *
 * Field set sourced from DEAL-02 (REQUIREMENTS.md) + UI-SPEC Page 2.
 * Money fields are integer USD (whole dollars) per db/schema/app.ts; the
 * form uses `lib/parse-money.ts` on blur to normalize $-prefix strings to
 * this integer shape before Zod sees them.
 *
 * Error copy mirrors UI-SPEC "Copywriting Contract":
 *   - Required blank:  "{Field label} is required."
 *   - Email format:    "That email doesn't look right."
 *
 * Track / priority / property_type / loan_type / transaction_type are
 * enumerated against the seeded tracks/stages vocabulary (db/seed/tracks.ts).
 */
export const createDealSchema = z.object({
  // Section 1 — File basics
  trackCode: z.enum(["TE", "FL", "DP", "PO", "EC", "SL", "BL", "GI"], {
    message: "Track is required.",
  }),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"], {
    message: "Priority is required.",
  }),
  title: z
    .string({ message: "Title is required." })
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be 200 characters or fewer."),
  // 2-letter state code (US) or null/omitted — drives file_no prefix (DEAL-02a)
  propertyState: z
    .string()
    .trim()
    .length(2, "Property state must be a 2-letter code.")
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
  mainContactName: z.string().trim().max(200).nullable().optional(),
  // Email: accept empty string (blank optional field) OR a valid email
  mainContactEmail: z
    .union([
      z.literal(""),
      z.string().trim().email("That email doesn't look right."),
    ])
    .nullable()
    .optional(),

  // Section 2 — Property details
  propertyAddress: z.string().trim().max(300).nullable().optional(),
  propertyType: z
    .enum([
      "single_family",
      "multi_family",
      "condo",
      "townhome",
      "commercial",
      "land",
      "other",
    ])
    .nullable()
    .optional(),
  salesPrice: z.number().int().nonnegative().nullable().optional(),
  loanType: z
    .enum([
      "conventional",
      "dscr",
      "hard_money",
      "bridge",
      "transactional",
      "cash",
      "other",
    ])
    .nullable()
    .optional(),
  transactionType: z
    .enum(["purchase", "refinance", "wholesale", "double_close", "other"])
    .nullable()
    .optional(),

  // Section 3 — Financials & dates
  loanAmount: z.number().int().nonnegative().nullable().optional(),
  estimatedDown: z.number().int().nonnegative().nullable().optional(),
  earnestMoney: z.number().int().nonnegative().nullable().optional(),
  estRehab: z.number().int().nonnegative().nullable().optional(),
  arv: z.number().int().nonnegative().nullable().optional(),
  closingAt: z.coerce.date().nullable().optional(),
  fundingAt: z.coerce.date().nullable().optional(),
  titleCtc: z.boolean().default(false),
  lenderCtc: z.boolean().default(false),
});

/** Output type — what the server action receives after validation. */
export type CreateDealInput = z.infer<typeof createDealSchema>;

/**
 * Input type — what react-hook-form holds before Zod transforms run.
 * Differs from CreateDealInput because fields with `.default()` are
 * optional on input (users may omit them; Zod fills the default).
 */
export type CreateDealFormInput = z.input<typeof createDealSchema>;

/**
 * updateDealSchema — Phase 2 Overview-tab edit (DEAL-05).
 *
 * Every deal field that CAN be edited in Overview is optional here;
 * immutable fields (trackCode, fileNo — see DEAL-02a) are omitted entirely
 * so a stray payload with `trackCode: "FL"` fails `.strict()` validation.
 *
 * The server action (plan 05) re-validates raw FormData against this and
 * computes the before→after diff to persist in audit_log.
 *
 * Deal status transitions: `active` → `closed` is allowed here (the
 * "Mark as closed" overflow action uses updateDeal internally). The
 * `active` → `killed` transition has its own action (killDeal) because
 * it requires a reason note — see `killDealSchema` below.
 *
 * NOTE: mainContactName + mainContactEmail are intentionally NOT included
 * here. The `deals.main_contact_*` columns are DEAL-02 free-text fields
 * that migrate to a contacts FK in P3 (D-03). Editing them via Overview
 * is deferred to P3 when the contact model lands.
 */
export const updateDealSchema = z
  .object({
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    status: z.enum(["active", "closed"]).optional(), // killed handled by killDealSchema
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(200, "Title must be 200 characters or fewer.")
      .optional(),
    propertyAddress: z.string().trim().max(300).nullable().optional(),
    propertyState: z
      .string()
      .trim()
      .length(2, "Property state must be a 2-letter code.")
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    propertyType: z
      .enum([
        "single_family",
        "multi_family",
        "condo",
        "townhome",
        "commercial",
        "land",
        "other",
      ])
      .nullable()
      .optional(),
    salesPrice: z.number().int().nonnegative().nullable().optional(),
    loanType: z
      .enum([
        "conventional",
        "dscr",
        "hard_money",
        "bridge",
        "transactional",
        "cash",
        "other",
      ])
      .nullable()
      .optional(),
    transactionType: z
      .enum(["purchase", "refinance", "wholesale", "double_close", "other"])
      .nullable()
      .optional(),
    loanAmount: z.number().int().nonnegative().nullable().optional(),
    estimatedDown: z.number().int().nonnegative().nullable().optional(),
    earnestMoney: z.number().int().nonnegative().nullable().optional(),
    estRehab: z.number().int().nonnegative().nullable().optional(),
    arv: z.number().int().nonnegative().nullable().optional(),
    closingAt: z.coerce.date().nullable().optional(),
    fundingAt: z.coerce.date().nullable().optional(),
    titleCtc: z.boolean().optional(),
    lenderCtc: z.boolean().optional(),
    titleFileNo: z.string().trim().max(100).nullable().optional(),
    loanNo: z.string().trim().max(100).nullable().optional(),
    quickNote: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

/** Output type — resolved after Zod transforms (e.g., propertyState uppercased). */
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

/**
 * Input type — what react-hook-form holds before transforms run.
 * Identical to UpdateDealInput for now (no `.default()` on updateDealSchema),
 * but exported as a named type so consumer code can document intent.
 */
export type UpdateDealFormInput = z.input<typeof updateDealSchema>;

/**
 * killDealSchema — DEAL-06 kill action.
 *
 * Reason min 3 / max 2000 matches UI-SPEC kill dialog:
 *   "(destructive — disabled until reason has ≥ 3 chars)"
 *
 * The server action (plan 04) writes an audit row with
 * `after_json.kill_reason = reason` AND mirrors the reason into
 * `deal_notes` (is_system=true) so the Notes tab shows why the deal died.
 */
export const killDealSchema = z.object({
  dealId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters.")
    .max(2000, "Reason must be 2000 characters or fewer."),
});

export type KillDealInput = z.infer<typeof killDealSchema>;
