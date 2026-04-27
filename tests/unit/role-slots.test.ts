import { describe, it, expect } from "vitest";
import {
  ROLE_SLOTS,
  ROLE_SLOT_CODES,
  ALL_TRACKS,
  isRoleValidForTrack,
  slotsForTrack,
} from "@/lib/role-slots";

/**
 * Phase 3 Plan 02 Task 1 — canonical role-slot registry tests.
 *
 * Pure data + pure function tests. No DB, no I/O.
 *
 * PEOPLE-02 taxonomy source: .planning/REQUIREMENTS.md §People Map & Contacts.
 * PEOPLE-05 enforcement primitive: isRoleValidForTrack() — used by server
 * actions (Plan 04) to reject unknown slots and cross-track slot misuse.
 */
describe("ROLE_SLOTS registry", () => {
  it("has exactly 12 slot entries", () => {
    expect(ROLE_SLOTS.length).toBe(12);
  });

  it("enumerates the 12 canonical PEOPLE-02 slot codes", () => {
    const expected = [
      "borrower",
      "consultant_partner",
      "directing_agent",
      "internal_owner",
      "lender_partner",
      "listing_agent",
      "main_contact",
      "mortgage_partner",
      "seller",
      "tc_partner",
      "title_partner",
      "tl_partner",
    ];
    const actual = ROLE_SLOTS.map((s) => s.code).slice().sort();
    expect(actual).toEqual(expected);
  });

  it("has exactly one slot with source='free_text' and it is lender_partner", () => {
    const freeText = ROLE_SLOTS.filter((s) => s.source === "free_text");
    expect(freeText.length).toBe(1);
    expect(freeText[0].code).toBe("lender_partner");
  });

  it("exposes ROLE_SLOT_CODES as a string array aligned with ROLE_SLOTS", () => {
    expect(ROLE_SLOT_CODES.length).toBe(12);
    expect(new Set(ROLE_SLOT_CODES)).toEqual(
      new Set(ROLE_SLOTS.map((s) => s.code)),
    );
  });

  it("exposes ALL_TRACKS as the 8 seeded track codes", () => {
    expect([...ALL_TRACKS]).toEqual([
      "TE",
      "FL",
      "DP",
      "PO",
      "EC",
      "SL",
      "BL",
      "GI",
    ]);
  });
});

describe("isRoleValidForTrack()", () => {
  // Universal slots (appliesToTracks === "ALL")
  it("returns true for main_contact on GI (universal slot)", () => {
    expect(isRoleValidForTrack("main_contact", "GI")).toBe(true);
  });

  it("returns true for internal_owner on EC (every deal has an owner)", () => {
    expect(isRoleValidForTrack("internal_owner", "EC")).toBe(true);
  });

  it("returns true for directing_agent on EC (every deal can have a directing agent)", () => {
    expect(isRoleValidForTrack("directing_agent", "EC")).toBe(true);
  });

  // Track-specific slots
  it("returns true for title_partner on TE (TE is the one applicable track)", () => {
    expect(isRoleValidForTrack("title_partner", "TE")).toBe(true);
  });

  it("returns false for title_partner on FL (conservative default — TE-specific)", () => {
    // Documented in lib/role-slots.ts header — operator may widen in P10.
    expect(isRoleValidForTrack("title_partner", "FL")).toBe(false);
  });

  it("returns true for mortgage_partner on FL", () => {
    expect(isRoleValidForTrack("mortgage_partner", "FL")).toBe(true);
  });

  it("returns true for mortgage_partner on TE (title deals commonly have mortgage partners)", () => {
    expect(isRoleValidForTrack("mortgage_partner", "TE")).toBe(true);
  });

  it("returns true for lender_partner on FL", () => {
    expect(isRoleValidForTrack("lender_partner", "FL")).toBe(true);
  });

  it("returns true for listing_agent on TE", () => {
    expect(isRoleValidForTrack("listing_agent", "TE")).toBe(true);
  });

  it("returns true for listing_agent on SL", () => {
    expect(isRoleValidForTrack("listing_agent", "SL")).toBe(true);
  });

  // Negative cases
  it("returns false for unknown role 'banana' on TE", () => {
    expect(isRoleValidForTrack("banana", "TE")).toBe(false);
  });

  it("returns false for unknown track 'ZZ' even with a valid role", () => {
    expect(isRoleValidForTrack("main_contact", "ZZ")).toBe(false);
  });

  it("returns false for both unknown role and unknown track", () => {
    expect(isRoleValidForTrack("banana", "ZZ")).toBe(false);
  });
});

describe("slotsForTrack()", () => {
  it("returns at least 8 slots for TE and includes title_partner", () => {
    const slots = slotsForTrack("TE");
    expect(slots.length).toBeGreaterThanOrEqual(8);
    expect(slots.map((s) => s.code)).toContain("title_partner");
  });

  it("returns at least 3 slots for GI and includes the 3 universal slots", () => {
    const slots = slotsForTrack("GI");
    expect(slots.length).toBeGreaterThanOrEqual(3);
    const codes = slots.map((s) => s.code);
    expect(codes).toContain("main_contact");
    expect(codes).toContain("internal_owner");
    expect(codes).toContain("directing_agent");
  });

  it("does NOT include title_partner when called for FL (TE-only per conservative default)", () => {
    const slots = slotsForTrack("FL");
    expect(slots.map((s) => s.code)).not.toContain("title_partner");
  });

  it("includes lender_partner for FL and DP but not TE", () => {
    expect(slotsForTrack("FL").map((s) => s.code)).toContain("lender_partner");
    expect(slotsForTrack("DP").map((s) => s.code)).toContain("lender_partner");
    expect(slotsForTrack("TE").map((s) => s.code)).not.toContain(
      "lender_partner",
    );
  });
});
