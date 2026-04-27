import { describe, it, expect } from "vitest";
import {
  createContactSchema,
  updateContactSchema,
  contactIdSchema,
  upsertDealPersonSchema,
  removeDealPersonSchema,
} from "@/lib/contact-schema";

/**
 * Phase 3 Plan 02 Task 2 — Zod contract tests for contact CRUD + deal_people
 * upsert/remove.
 *
 * Mirrors the P2 cadence in deal-schema.test.ts: happy path, trim/bounds,
 * .strict() unknown-key rejection, email accepts empty string, role enum
 * consumed from lib/role-slots.ts.
 *
 * Validation-only: no DB, no server action. Track-compatibility (PEOPLE-05)
 * is enforced at the server-action layer (Plan 04) after loading the deal row.
 */

const VALID_UUID = "00000000-0000-4000-8000-000000000000";
const OTHER_UUID = "11111111-1111-4111-8111-111111111111";

describe("createContactSchema", () => {
  it("accepts a happy-path contact (fullName only)", () => {
    const result = createContactSchema.safeParse({ fullName: "Carrie Davis" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace on fullName", () => {
    const result = createContactSchema.safeParse({
      fullName: "  Carrie Davis  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Carrie Davis");
    }
  });

  it("accepts empty-string email (blank optional field)", () => {
    const result = createContactSchema.safeParse({
      fullName: "Carrie Davis",
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects garbage email with 'That email doesn't look right.'", () => {
    const result = createContactSchema.safeParse({
      fullName: "Carrie Davis",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("That email doesn't look right.");
    }
  });

  it("rejects unknown keys via .strict()", () => {
    const result = createContactSchema.safeParse({
      fullName: "Carrie Davis",
      somethingWeird: "banana",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fullName that is empty after trim", () => {
    const result = createContactSchema.safeParse({ fullName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Full name is required.");
    }
  });
});

describe("updateContactSchema", () => {
  it("accepts a single-field partial update (org only)", () => {
    const result = updateContactSchema.safeParse({ org: "UTS" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op diff)", () => {
    const result = updateContactSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys via .strict()", () => {
    const result = updateContactSchema.safeParse({
      org: "UTS",
      rogueField: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects garbage email in a partial update", () => {
    const result = updateContactSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects fullName longer than 200 chars", () => {
    const result = updateContactSchema.safeParse({ fullName: "x".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("contactIdSchema", () => {
  it("accepts a valid uuid", () => {
    const result = contactIdSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects 'not-a-uuid'", () => {
    const result = contactIdSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("upsertDealPersonSchema", () => {
  it("accepts a happy-path input with contactId", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "main_contact",
      contactId: OTHER_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts lender_partner + freeTextValue (no contactId)", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "lender_partner",
      freeTextValue: "Wells Fargo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown role (e.g., 'banana')", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "banana",
      contactId: OTHER_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid dealId", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: "not-a-uuid",
      role: "main_contact",
      contactId: OTHER_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys via .strict()", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "main_contact",
      contactId: OTHER_UUID,
      sneakyField: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts role=lender_partner + freeTextValue='Wells Fargo'", () => {
    // Redundant-on-purpose to document the plan's lender_partner shape.
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "lender_partner",
      freeTextValue: "Wells Fargo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.freeTextValue).toBe("Wells Fargo");
    }
  });

  it("rejects freeTextValue that is empty after trim", () => {
    const result = upsertDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "lender_partner",
      freeTextValue: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("removeDealPersonSchema", () => {
  it("accepts a happy-path input", () => {
    const result = removeDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "main_contact",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const result = removeDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "banana",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys via .strict()", () => {
    const result = removeDealPersonSchema.safeParse({
      dealId: VALID_UUID,
      role: "main_contact",
      extraField: "no",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing dealId", () => {
    const result = removeDealPersonSchema.safeParse({ role: "main_contact" });
    expect(result.success).toBe(false);
  });
});
