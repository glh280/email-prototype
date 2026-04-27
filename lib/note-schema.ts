import { z } from "zod";

/**
 * createNoteSchema — Phase 2 Plan 06 Notes tab.
 *
 * Notes are append-only in P2 (UI-SPEC assumption 4) — no edit/delete
 * schemas. If Carrie requests editing during calibration, P3 adds them.
 *
 * `body` is trimmed so whitespace-only submissions fail the min(1) check
 * with the same error users see for empty input.
 */
export const createNoteSchema = z.object({
  dealId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Note body is required.")
    .max(5000, "Note body must be 5000 characters or fewer."),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
