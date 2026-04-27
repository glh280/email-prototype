import { z } from "zod";

/**
 * Shared Zod schemas for stage advance + revert (Phase 2 Plan 04).
 *
 * advanceStageSchema and revertStageSchema take identical shapes; the
 * distinction is semantic (advance validates forward motion; revert
 * validates backward motion) and enforced by the server actions, not
 * by Zod. Both require the target stage id — the client sends which
 * stage it clicked; the server re-resolves sort_order and track_id
 * against the seeded stages to reject invalid targets.
 */
export const advanceStageSchema = z.object({
  dealId: z.string().uuid(),
  targetStageId: z.string().uuid(),
});

export type AdvanceStageInput = z.infer<typeof advanceStageSchema>;

export const revertStageSchema = z.object({
  dealId: z.string().uuid(),
  targetStageId: z.string().uuid(),
});

export type RevertStageInput = z.infer<typeof revertStageSchema>;
