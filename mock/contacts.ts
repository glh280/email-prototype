// L1 contacts fixtures.
//
// SOURCE: new (no PROD source — replaces the Drizzle-backed
//   `queryContactsForList` for the standalone prototype)
// CREATED: 2026-04-28
// STATUS: new
// REINTEGRATION: dropped at L2 — real /contacts page reads from DB. This
//   file exists only because the prototype has no Postgres.
//
// Three sources flow into the prototype's contact list:
//   1. Workspace users — every member from `WORKSPACE_USERS`.
//   2. Email participants — every distinct `fromAddress` on an
//      `INBOX_ROWS` entry.
//   3. Base contacts — hand-rolled vendors / banks / agents / attorneys
//      that are realistic for a title + lending workflow.
//
// The compose dialog's To / Cc / Bcc autocomplete reads from
// `searchContacts(query)` so every name visible in the inbox or settings
// appears as a typeahead suggestion.

import { INBOX_ROWS } from "./inbox";
import { WORKSPACE_USERS } from "./settings";

export type Contact = {
  id: string;
  fullName: string;
  email: string;
  org: string | null;
  roleHint: string | null;
  phone: string | null;
  source: "workspace" | "email" | "base";
  notes: string | null;
  /** Number of inbox rows that include this contact's email. */
  emailCount: number;
  createdAt: Date;
};

const BASE_CONTACTS: Omit<Contact, "id" | "emailCount" | "createdAt" | "source">[] = [
  {
    fullName: "Susan Patel",
    email: "spatel@regionsbank.com",
    org: "Regions Bank",
    roleHint: "Loan Officer",
    phone: "813-555-0142",
    notes: "Primary contact for SBA loans",
  },
  {
    fullName: "Marcus Chen",
    email: "mchen@chasetreasury.com",
    org: "Chase Treasury",
    roleHint: "Treasury Manager",
    phone: "813-555-0143",
    notes: null,
  },
  {
    fullName: "Linda Garcia",
    email: "linda@homefirstrealty.com",
    org: "Home First Realty",
    roleHint: "Realtor",
    phone: "813-555-0144",
    notes: "Top producer — preferred agent for Tampa Bay listings",
  },
  {
    fullName: "Brian Walker",
    email: "bwalker@walkerlaw.net",
    org: "Walker & Associates",
    roleHint: "Real Estate Attorney",
    phone: "813-555-0145",
    notes: null,
  },
  {
    fullName: "Olivia Rivera",
    email: "olivia@premierhome.com",
    org: "Premier Home Inspections",
    roleHint: "Home Inspector",
    phone: "813-555-0146",
    notes: null,
  },
  {
    fullName: "Tomás Vega",
    email: "tomas@suncoastappraisal.com",
    org: "Suncoast Appraisal",
    roleHint: "Appraiser",
    phone: "813-555-0147",
    notes: null,
  },
  {
    fullName: "Rachel Kim",
    email: "rkim@floridainsurance.com",
    org: "Florida Title Insurance",
    roleHint: "Underwriter",
    phone: "813-555-0148",
    notes: null,
  },
  {
    fullName: "Daniel Foster",
    email: "dfoster@fosterbuilders.com",
    org: "Foster Builders",
    roleHint: "Builder / Developer",
    phone: "813-555-0149",
    notes: "New construction — frequent buyer",
  },
  {
    fullName: "Janelle Brooks",
    email: "janelle@sunshineescrow.com",
    org: "Sunshine Escrow",
    roleHint: "Escrow Officer",
    phone: "813-555-0150",
    notes: null,
  },
  {
    fullName: "Kevin Trent",
    email: "kevin@trentmortgage.com",
    org: "Trent Mortgage",
    roleHint: "Mortgage Broker",
    phone: "813-555-0151",
    notes: null,
  },
  {
    fullName: "Aisha Patel",
    email: "aisha.patel@bayareacredit.com",
    org: "Bay Area Credit Union",
    roleHint: "Lending Officer",
    phone: "813-555-0152",
    notes: null,
  },
  {
    fullName: "Greg Sims",
    email: "greg@simsroofing.com",
    org: "Sims Roofing",
    roleHint: "Vendor — Roofing",
    phone: "813-555-0153",
    notes: null,
  },
];

function buildEmailParticipants(): Contact[] {
  const seen = new Map<string, Contact>();
  for (const row of INBOX_ROWS) {
    const email = row.fromAddress?.toLowerCase().trim();
    if (!email) continue;
    const existing = seen.get(email);
    if (existing) {
      existing.emailCount += 1;
      // Prefer the first non-null sender name we encounter; keep the
      // earliest sentAt as the "added" timestamp.
      if (!existing.fullName && row.fromName) existing.fullName = row.fromName;
      if (row.sentAt < existing.createdAt) existing.createdAt = row.sentAt;
      continue;
    }
    const domain = email.split("@")[1] ?? null;
    seen.set(email, {
      id: `c_email_${email}`,
      fullName: row.fromName ?? email.split("@")[0] ?? email,
      email,
      org: domain
        ? domain
            .split(".")
            .slice(0, -1)
            .join(" ")
            .replace(/\b\w/g, (s) => s.toUpperCase())
        : null,
      roleHint: "Email correspondent",
      phone: null,
      source: "email",
      notes: null,
      emailCount: 1,
      createdAt: row.sentAt,
    });
  }
  return Array.from(seen.values());
}

function buildContacts(): Contact[] {
  const out: Contact[] = [];

  // Workspace users — every member can be addressed by email.
  for (const u of WORKSPACE_USERS) {
    out.push({
      id: `c_ws_${u.id}`,
      fullName: u.name,
      email: u.email,
      org:
        u.email.endsWith("@nprfunding.com")
          ? "NPR Funding"
          : u.email.endsWith("@unitedtitlesolutions.com")
            ? "United Title Solutions"
            : u.email.endsWith("@signaturetransactionmanagement.com")
              ? "Signature Transaction Management"
              : null,
      roleHint:
        u.role === "owner"
          ? "Owner"
          : u.role === "admin"
            ? "Admin"
            : u.role === "member"
              ? "Team member"
              : "Viewer",
      phone: null,
      source: "workspace",
      notes: `Workspace ${u.role} · last active ${new Date(u.lastActive).toLocaleDateString()}`,
      emailCount: 0,
      createdAt: new Date("2025-09-01T00:00:00Z"),
    });
  }

  // Base contacts.
  let i = 0;
  for (const b of BASE_CONTACTS) {
    out.push({
      id: `c_base_${i++}`,
      ...b,
      source: "base",
      emailCount: 0,
      createdAt: new Date("2025-12-01T00:00:00Z"),
    });
  }

  // Merge email participants — skip ones whose email already exists in
  // workspace or base contacts to avoid dupes; bump emailCount otherwise.
  const byEmail = new Map(out.map((c) => [c.email.toLowerCase(), c] as const));
  for (const p of buildEmailParticipants()) {
    const existing = byEmail.get(p.email);
    if (existing) {
      existing.emailCount += p.emailCount;
      continue;
    }
    out.push(p);
    byEmail.set(p.email, p);
  }

  return out.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export const CONTACTS: Contact[] = buildContacts();

/**
 * Case-insensitive substring match on fullName, email, or org. Returns
 * up to `limit` results sorted by best match (exact > prefix > substring).
 */
export function searchContacts(query: string, limit = 8): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ contact: Contact; score: number }> = [];
  for (const c of CONTACTS) {
    const name = c.fullName.toLowerCase();
    const email = c.email.toLowerCase();
    const org = c.org?.toLowerCase() ?? "";
    let score = -1;
    if (name === q || email === q) score = 0;
    else if (name.startsWith(q) || email.startsWith(q)) score = 1;
    else if (name.includes(q) || email.includes(q) || org.includes(q)) score = 2;
    if (score >= 0) scored.push({ contact: c, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score || a.contact.fullName.localeCompare(b.contact.fullName),
  );
  return scored.slice(0, limit).map((s) => s.contact);
}
