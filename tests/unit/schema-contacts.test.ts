import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import * as schema from "@/db/schema";

/**
 * Phase 3 Plan 01 — Schema-shape tests for contacts + deal_people.
 *
 * These are introspection-only tests (Drizzle column metadata, no DB round-trip)
 * mirroring the P1/P2 schema-shape pattern established in
 * `tests/unit/schema-shape.test.ts`. They encode PEOPLE-01 (contacts registry)
 * and PEOPLE-02 (deal_people link table with one-slot-per-deal invariant) at
 * the schema layer.
 *
 * Column names are asserted by their SQL name (snake_case) so a TypeScript
 * field rename that leaves the DB shape untouched surfaces here.
 */
describe("contacts schema (PEOPLE-01)", () => {
  it("P3 Test 1: exports contacts from the barrel", () => {
    expect(schema.contacts).toBeDefined();
  });

  it("P3 Test 2: contacts table has all 10 expected columns", () => {
    const cols = getTableColumns(schema.contacts);
    const names = Object.values(cols).map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "id",
        "full_name",
        "role_hint",
        "org",
        "email",
        "phone",
        "notes",
        "created_by",
        "created_at",
        "updated_at",
      ].sort(),
    );
  });

  it("P3 Test 3: contacts FK / nullability contract", () => {
    const cols = getTableColumns(schema.contacts);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    // Required
    expect(byName.full_name.notNull).toBe(true);
    expect(byName.created_by.notNull).toBe(true);
    expect(byName.created_at.notNull).toBe(true);
    expect(byName.updated_at.notNull).toBe(true);
    // Optional (nullable — PEOPLE-01 permits sparse contact records)
    expect(byName.role_hint.notNull).toBe(false);
    expect(byName.org.notNull).toBe(false);
    expect(byName.email.notNull).toBe(false);
    expect(byName.phone.notNull).toBe(false);
    expect(byName.notes.notNull).toBe(false);
    // Column types
    expect(byName.id.columnType).toMatch(/PgUUID/);
    expect(byName.created_by.columnType).toMatch(/PgUUID/);
    expect(byName.email.columnType).toMatch(/PgText/);
  });

  it("P3 Test 4: email column is a proxy object (runtime presence for uniqueIndex target)", () => {
    // Proxy assertion — the schema file declares the partial unique index
    // `contacts_email_unique_idx ON (lower(email)) WHERE email IS NOT NULL`.
    // This test confirms the email column proxy that the index consumes exists
    // at runtime — any import drift where `email` is dropped surfaces here.
    expect(typeof (schema.contacts as unknown as Record<string, unknown>).email).toBe(
      "object",
    );
  });
});

describe("dealPeople schema (PEOPLE-02)", () => {
  it("P3 Test 5: exports dealPeople from the barrel", () => {
    expect(schema.dealPeople).toBeDefined();
  });

  it("P3 Test 6: deal_people table has all 6 expected columns", () => {
    const cols = getTableColumns(schema.dealPeople);
    const names = Object.values(cols).map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "id",
        "deal_id",
        "contact_id",
        "role",
        "created_by",
        "created_at",
      ].sort(),
    );
  });

  it("P3 Test 7: dealPeople FK / nullability contract", () => {
    const cols = getTableColumns(schema.dealPeople);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    // Required
    expect(byName.deal_id.notNull).toBe(true);
    expect(byName.role.notNull).toBe(true);
    expect(byName.created_by.notNull).toBe(true);
    expect(byName.created_at.notNull).toBe(true);
    // contact_id is nullable — SET NULL on contact delete preserves the slot
    // row as an audit trail (PEOPLE-02 semantics from the plan context).
    expect(byName.contact_id.notNull).toBe(false);
    // Column types
    expect(byName.id.columnType).toMatch(/PgUUID/);
    expect(byName.deal_id.columnType).toMatch(/PgUUID/);
    expect(byName.contact_id.columnType).toMatch(/PgUUID/);
    expect(byName.role.columnType).toMatch(/PgText/);
  });

  it("P3 Test 8: Contact / NewContact / DealPerson / NewDealPerson types compile", () => {
    // Runtime proxy for type presence — if the exports drift, this file fails
    // to type-check via `npx tsc --noEmit`. The runtime assertions here are
    // incidental; the real test is compile-time.
    const contactRow: schema.Contact = {
      id: "00000000-0000-0000-0000-000000000000",
      fullName: "Jane Doe",
      roleHint: null,
      org: null,
      email: null,
      phone: null,
      notes: null,
      createdBy: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newContact: schema.NewContact = {
      fullName: "Y",
      createdBy: contactRow.createdBy,
    };
    const dealPersonRow: schema.DealPerson = {
      id: "00000000-0000-0000-0000-000000000000",
      dealId: "00000000-0000-0000-0000-000000000000",
      contactId: contactRow.id,
      role: "main_contact",
      createdBy: contactRow.createdBy,
      createdAt: new Date(),
    };
    const newDealPerson: schema.NewDealPerson = {
      dealId: dealPersonRow.dealId,
      role: "main_contact",
      createdBy: contactRow.createdBy,
    };
    expect(contactRow.fullName).toBe("Jane Doe");
    expect(newContact.fullName).toBe("Y");
    expect(dealPersonRow.role).toBe("main_contact");
    expect(newDealPerson.role).toBe("main_contact");
  });
});
