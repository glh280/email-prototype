/**
 * Canonical per-track role-slot registry for PEOPLE-02 / PEOPLE-05.
 *
 * Single source of truth — edit HERE when P10 calibrates slot applicability.
 * Server actions call isRoleValidForTrack() to reject unknown slots (PEOPLE-05).
 * UI calls slotsForTrack() to render the right set of slot rows per deal.
 *
 * `source` disambiguates how the slot is filled:
 *   - "contact_fk": deal_people.contact_id points to a contacts row (autosuggest)
 *   - "free_text":  lender_partner — actual lender often not in the registry;
 *                   stored via a dedicated contact row whose org field carries
 *                   the lender name, OR (future) via a sidecar free-text column.
 *                   Plan 04 implements free_text as "create a minimal contact
 *                   with full_name=<text>, role_hint='lender', no email" — the
 *                   simplest path that keeps the deal_people shape uniform.
 *
 * Conservative default: title_partner applies to TE only (not FL). This
 * reflects REQUIREMENTS PEOPLE-02 note "autosuggest from partner contacts"
 * as Title-and-Escrow-specific. Operator (Carrie via Mike) may widen the
 * applicability during P10 calibration week — that is a one-line edit to
 * the appliesToTracks array below.
 */
export const ALL_TRACKS = ["TE", "FL", "DP", "PO", "EC", "SL", "BL", "GI"] as const;
export type TrackCode = (typeof ALL_TRACKS)[number];

export type RoleSlotSource = "contact_fk" | "free_text";

export type RoleSlot = {
  code: string;
  label: string;
  appliesToTracks: "ALL" | readonly TrackCode[];
  source: RoleSlotSource;
  notes?: string;
};

export const ROLE_SLOTS: readonly RoleSlot[] = [
  {
    code: "directing_agent",
    label: "Directing Agent",
    appliesToTracks: "ALL",
    source: "contact_fk",
  },
  {
    code: "main_contact",
    label: "Main Contact",
    appliesToTracks: "ALL",
    source: "contact_fk",
    notes: "Lead name on file. Formerly 'primary contact'.",
  },
  {
    code: "internal_owner",
    label: "Internal Owner",
    appliesToTracks: "ALL",
    source: "contact_fk",
    notes:
      "Us — the team member on the file. Mirrors deals.internal_owner until P10 calibrates.",
  },
  {
    code: "title_partner",
    label: "Title Partner",
    appliesToTracks: ["TE"],
    source: "contact_fk",
    notes: "Autosuggest from partner contacts. TE-specific per PEOPLE-02.",
  },
  {
    code: "borrower",
    label: "Borrower",
    appliesToTracks: ["TE", "FL", "DP"],
    source: "contact_fk",
    notes: "May mirror main_contact per VIEW-05.",
  },
  {
    code: "seller",
    label: "Seller",
    appliesToTracks: ["TE", "SL"],
    source: "contact_fk",
  },
  {
    code: "mortgage_partner",
    label: "Mortgage Partner",
    appliesToTracks: ["TE", "FL", "DP"],
    source: "contact_fk",
    notes:
      "Mortgage brokerage partner (renamed from lender_partner). Autosuggest from partner contacts.",
  },
  {
    code: "lender_partner",
    label: "Lender",
    appliesToTracks: ["FL", "DP"],
    source: "free_text",
    notes:
      "Actual lender on the deal. Often not in the registry — stored as a minimal contact row with org=<lender name>.",
  },
  {
    code: "tc_partner",
    label: "TC Partner",
    appliesToTracks: ["TE"],
    source: "contact_fk",
    notes: "Transaction Coordinator. Autosuggest from partner contacts.",
  },
  {
    code: "tl_partner",
    label: "TL Partner",
    appliesToTracks: ["TE", "FL"],
    source: "contact_fk",
    notes: "Title Liaison partner. Autosuggest from partner contacts.",
  },
  {
    code: "consultant_partner",
    label: "Consultant Partner",
    appliesToTracks: ["EC", "DP", "PO"],
    source: "contact_fk",
  },
  {
    code: "listing_agent",
    label: "Listing Agent",
    appliesToTracks: ["TE", "SL", "BL"],
    source: "contact_fk",
  },
] as const;

/**
 * Array of slot codes suitable for Zod's z.enum([...]).
 * Mirrors ROLE_SLOTS order for determinism — downstream code can index
 * by position if it must (it shouldn't; prefer .find()).
 */
export const ROLE_SLOT_CODES: readonly string[] = ROLE_SLOTS.map((s) => s.code);

export type RoleSlotCode = (typeof ROLE_SLOTS)[number]["code"];

/**
 * PEOPLE-05 enforcement primitive.
 *
 * Returns true iff:
 *   - `role` matches a ROLE_SLOTS entry AND
 *   - `trackCode` is one of the 8 seeded tracks AND
 *   - The slot's appliesToTracks is "ALL" OR includes trackCode.
 *
 * Returns false for unknown role, unknown track, or incompatible pairing.
 * Server actions (Plan 04) gate upsertDealPerson on this after loading
 * the deal row (to know its track).
 */
export function isRoleValidForTrack(role: string, trackCode: string): boolean {
  if (!(ALL_TRACKS as readonly string[]).includes(trackCode)) return false;
  const slot = ROLE_SLOTS.find((s) => s.code === role);
  if (!slot) return false;
  if (slot.appliesToTracks === "ALL") return true;
  return (slot.appliesToTracks as readonly string[]).includes(trackCode);
}

/**
 * Returns the subset of ROLE_SLOTS applicable to a given track.
 * Used by the deal-detail File Contacts tab UI (Plan 06) to render the
 * right set of slot rows per deal.
 */
export function slotsForTrack(trackCode: TrackCode): readonly RoleSlot[] {
  return ROLE_SLOTS.filter(
    (s) =>
      s.appliesToTracks === "ALL" ||
      (s.appliesToTracks as readonly string[]).includes(trackCode),
  );
}
