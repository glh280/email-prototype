import { describe, it, expect } from "vitest";
import { createNoteSchema } from "@/lib/note-schema";

/**
 * Phase 2 Plan 02 Task 2 — note creation Zod schema.
 *
 * Notes are append-only in P2 (UI-SPEC assumption 4) — no update/delete schema.
 * `body` is trimmed so whitespace-only submissions fail with the same
 * required-field error users see for empty input.
 */
const validUuid = "00000000-0000-4000-8000-000000000001";

describe("createNoteSchema", () => {
  it("accepts a minimal valid note", () => {
    const result = createNoteSchema.safeParse({
      dealId: validUuid,
      body: "Quick note — lender called back.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBe("Quick note — lender called back.");
    }
  });

  it("rejects empty-string body with 'Note body is required.'", () => {
    const result = createNoteSchema.safeParse({
      dealId: validUuid,
      body: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "body")
        ?.message;
      expect(msg).toBe("Note body is required.");
    }
  });

  it("rejects whitespace-only body (trimmed → empty → fails min(1))", () => {
    const result = createNoteSchema.safeParse({
      dealId: validUuid,
      body: "     ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "body")
        ?.message;
      expect(msg).toBe("Note body is required.");
    }
  });

  it("rejects body longer than 5000 chars", () => {
    const result = createNoteSchema.safeParse({
      dealId: validUuid,
      body: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "body")
        ?.message;
      expect(msg).toBe("Note body must be 5000 characters or fewer.");
    }
  });

  it("rejects a non-uuid dealId", () => {
    const result = createNoteSchema.safeParse({
      dealId: "not-a-uuid",
      body: "A valid note body.",
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from body before length checks", () => {
    const result = createNoteSchema.safeParse({
      dealId: validUuid,
      body: "  meaningful content  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBe("meaningful content");
    }
  });
});
