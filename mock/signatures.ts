// L1 email signature fixtures.
//
// SOURCE: new (no PROD source — mocked from operator's reference image)
// CREATED: 2026-04-28
// STATUS: new (HTML output — newoldstamp-compatible table layout)
// REINTEGRATION: replaced by `workspace_user.signature_html` (or per-mailbox
//   override) in L2 — same shape, server-driven content.
//
// Signatures are HTML so they round-trip cleanly through email clients
// that render Newoldstamp-style table layouts. Compose dialog auto-
// populates the body's signature block on open and replaces it whenever
// the operator switches the From mailbox.

export type SignatureContact = {
  name: string;
  title?: string;
  office?: string;
  direct?: string;
  cell?: string;
  eFax?: string;
  email: string;
  website?: string;
  brand: "UTS" | "STM" | "NPR" | "GENERIC";
};

const BRAND_STYLE: Record<
  SignatureContact["brand"],
  { label: string; tagline: string; color: string; logoBg: string }
> = {
  UTS: {
    label: "UNITED TITLE SOLUTIONS",
    tagline: "Build Better Together.",
    color: "#0F2C5A",
    logoBg: "#F5F7FB",
  },
  STM: {
    label: "SIGNATURE TRANSACTION MANAGEMENT",
    tagline: "Closings, simplified.",
    color: "#1A1A1A",
    logoBg: "#F5F5F5",
  },
  NPR: {
    label: "NPR FUNDING",
    tagline: "Capital that closes.",
    color: "#0E4D2F",
    logoBg: "#F2F8F4",
  },
  GENERIC: {
    label: "",
    tagline: "",
    color: "#444",
    logoBg: "#F5F5F5",
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoSvg(brand: SignatureContact["brand"]): string {
  // Inline SVG keeps the signature self-contained — no external image
  // refs that would break in copy-paste or email clients.
  const style = BRAND_STYLE[brand];
  const initials =
    brand === "UTS" ? "UTS" : brand === "STM" ? "STM" : brand === "NPR" ? "NPR" : "•";
  return `
    <div style="width:80px;height:80px;border-radius:6px;background:${style.logoBg};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;color:${style.color};">
      <div style="font-weight:700;font-size:18px;letter-spacing:1px;">${initials}</div>
      <div style="font-size:8px;letter-spacing:0.5px;text-transform:uppercase;color:${style.color};opacity:0.8;margin-top:2px;">${escapeHtml(style.label.split(" ").slice(0, 2).join(" "))}</div>
    </div>
  `.trim();
}

/**
 * Build a Newoldstamp-style HTML signature: table layout with logo on
 * the left and contact block on the right, then a brand line, then the
 * confidentiality + wire-fraud notices.
 */
export function buildSignatureHtml(c: SignatureContact): string {
  const accent = c.brand === "UTS" ? "#D68A00" : BRAND_STYLE[c.brand].color;
  const brandLine =
    c.brand === "GENERIC"
      ? ""
      : `
        <div style="margin-top:8px;font-size:11px;color:${BRAND_STYLE[c.brand].color};letter-spacing:0.5px;text-transform:uppercase;font-weight:700;">
          ${escapeHtml(BRAND_STYLE[c.brand].label)}
        </div>
        <div style="font-size:11px;color:${BRAND_STYLE[c.brand].color};font-style:italic;opacity:0.85;">
          ${escapeHtml(BRAND_STYLE[c.brand].tagline)}
        </div>
      `;

  const contactRows: string[] = [];
  if (c.office || c.direct) {
    const parts: string[] = [];
    if (c.office) parts.push(`<strong>Office:</strong> ${escapeHtml(c.office)}`);
    if (c.direct) parts.push(`<strong>Direct:</strong> ${escapeHtml(c.direct)}`);
    contactRows.push(parts.join(" &nbsp; "));
  }
  if (c.cell) contactRows.push(`<strong>Cell:</strong> ${escapeHtml(c.cell)}`);
  if (c.eFax)
    contactRows.push(
      `<strong>eFax:</strong> ${escapeHtml(c.eFax)} &nbsp; <strong>Email:</strong> <a href="mailto:${escapeHtml(c.email)}" style="color:${accent};text-decoration:none;">${escapeHtml(c.email)}</a>`,
    );
  else
    contactRows.push(
      `<strong>Email:</strong> <a href="mailto:${escapeHtml(c.email)}" style="color:${accent};text-decoration:none;">${escapeHtml(c.email)}</a>`,
    );
  if (c.website)
    contactRows.push(
      `<strong>Website:</strong> <a href="https://${escapeHtml(c.website)}" style="color:${accent};text-decoration:none;">${escapeHtml(c.website)}</a>`,
    );

  return `
<div data-signature="${escapeHtml(c.email)}" style="font-family:Arial,Helvetica,sans-serif;color:#1F2937;font-size:12px;line-height:1.5;">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td style="vertical-align:top;padding-right:14px;border-right:2px solid ${accent};">
        ${logoSvg(c.brand)}
      </td>
      <td style="vertical-align:top;padding-left:14px;">
        <div style="font-size:14px;font-weight:700;color:#0F172A;">${escapeHtml(c.name)}</div>
        ${c.title ? `<div style="font-size:12px;font-weight:600;color:${accent};margin-top:2px;">${escapeHtml(c.title)}</div>` : ""}
        <div style="margin-top:8px;color:#374151;">
          ${contactRows.map((r) => `<div style="margin:1px 0;">${r}</div>`).join("")}
        </div>
        ${brandLine}
      </td>
    </tr>
  </table>
  <p style="margin:10px 0 0 0;font-size:10px;color:#6B7280;line-height:1.5;">
    <strong style="color:#374151;">CONFIDENTIALITY NOTICE:</strong>
    This email may contain confidential or privileged information intended only for the recipient(s).
    If you are not the intended recipient, please notify the sender and delete this email.
  </p>
  <p style="margin:6px 0 0 0;font-size:10px;color:#6B7280;line-height:1.5;">
    <strong style="color:#B91C1C;">WIRE FRAUD ALERT:</strong>
    We do not change wiring instructions by email. Always verify wire instructions by phone using a known number before sending funds.
  </p>
</div>
  `.trim();
}

/**
 * Plain-text fallback used by views that can't render HTML (notes,
 * console logs, etc.). Mirrors the HTML structure with line breaks.
 */
export function buildSignatureText(c: SignatureContact): string {
  const lines: string[] = [];
  lines.push(c.name);
  if (c.title) lines.push(c.title);
  lines.push("");
  if (c.office) {
    let row = `Office: ${c.office}`;
    if (c.direct) row += `   Direct: ${c.direct}`;
    lines.push(row);
  } else if (c.direct) {
    lines.push(`Direct: ${c.direct}`);
  }
  if (c.cell) lines.push(`Cell: ${c.cell}`);
  if (c.eFax) lines.push(`eFax: ${c.eFax}   Email: ${c.email}`);
  else lines.push(`Email: ${c.email}`);
  if (c.website) lines.push(`Website: ${c.website}`);
  if (c.brand !== "GENERIC") {
    lines.push("");
    lines.push(BRAND_STYLE[c.brand].label);
    lines.push(BRAND_STYLE[c.brand].tagline);
  }
  lines.push("");
  lines.push(
    "CONFIDENTIALITY NOTICE: This email may contain confidential or privileged information intended only for the recipient(s). If you are not the intended recipient, please notify the sender and delete this email.",
  );
  lines.push("");
  lines.push(
    "WIRE FRAUD ALERT: We do not change wiring instructions by email. Always verify wire instructions by phone using a known number before sending funds.",
  );
  return lines.join("\n");
}

const MIKE_UTS: SignatureContact = {
  name: "Mike Miller",
  title: "Owner",
  office: "813-725-5757",
  direct: "813-928-8575",
  eFax: "813-434-2248",
  email: "mike@unitedtitlesolutions.com",
  website: "www.unitedtitlesolutions.com",
  brand: "UTS",
};

const CARRIE_UTS: SignatureContact = {
  name: "Carrie Davis",
  title: "Chief Operating Officer",
  office: "813-725-5757",
  direct: "813-928-8576",
  eFax: "813-434-2248",
  email: "carrie@unitedtitlesolutions.com",
  website: "www.unitedtitlesolutions.com",
  brand: "UTS",
};

const STEFF_UTS: SignatureContact = {
  name: "Steff Williams",
  title: "Closings Manager",
  office: "813-725-5757",
  direct: "813-928-8577",
  eFax: "813-434-2248",
  email: "steff@unitedtitlesolutions.com",
  website: "www.unitedtitlesolutions.com",
  brand: "UTS",
};

const ASHLEY_UTS: SignatureContact = {
  name: "Ashley Davis",
  title: "Title Processor",
  office: "813-725-5757",
  direct: "813-928-8578",
  eFax: "813-434-2248",
  email: "orders@unitedtitlesolutions.com",
  website: "www.unitedtitlesolutions.com",
  brand: "UTS",
};

const PAT_UTS: SignatureContact = {
  name: "Pat Lee",
  title: "Title Examiner",
  office: "813-725-5757",
  direct: "813-928-8579",
  eFax: "813-434-2248",
  email: "pat@unitedtitlesolutions.com",
  website: "www.unitedtitlesolutions.com",
  brand: "UTS",
};

const KENNETH_STM: SignatureContact = {
  name: "Kenneth Lezada",
  title: "Transaction Manager",
  office: "813-725-5800",
  direct: "813-928-8580",
  email: "connect@signaturetransactionmanagement.com",
  website: "www.signaturetransactionmanagement.com",
  brand: "STM",
};

const MIKE_NPR: SignatureContact = {
  name: "Mike Miller",
  title: "Principal",
  office: "813-725-5757",
  direct: "813-928-8575",
  email: "mike@nprfunding.com",
  website: "www.nprfunding.com",
  brand: "NPR",
};

const JORDAN_NPR: SignatureContact = {
  name: "Jordan Reyes",
  title: "Lending Operations",
  office: "813-725-5757",
  direct: "813-928-8581",
  email: "jordan@nprfunding.com",
  website: "www.nprfunding.com",
  brand: "NPR",
};

const DEVIN_NPR: SignatureContact = {
  name: "Devin Park",
  title: "Lending Analyst",
  office: "813-725-5757",
  direct: "813-928-8582",
  email: "devin@nprfunding.com",
  website: "www.nprfunding.com",
  brand: "NPR",
};

const CONTACTS_BY_MAILBOX: Record<string, SignatureContact> = {
  "mike@unitedtitlesolutions.com": MIKE_UTS,
  "mike@nprfunding.com": MIKE_NPR,
  "carrie@unitedtitlesolutions.com": CARRIE_UTS,
  "carrie@utstitle.com": { ...CARRIE_UTS, email: "carrie@utstitle.com", website: "www.utstitle.com" },
  "carrie@signaturetransactionmanagement.com": {
    name: "Carrie Davis",
    title: "Principal",
    office: "813-725-5800",
    direct: "813-928-8576",
    email: "carrie@signaturetransactionmanagement.com",
    website: "www.signaturetransactionmanagement.com",
    brand: "STM",
  },
  "carrie@godropbox.com": {
    name: "Carrie Davis",
    title: "Operator",
    office: "813-725-5757",
    direct: "813-928-8576",
    email: "carrie@godropbox.com",
    brand: "GENERIC",
  },
  "steff@unitedtitlesolutions.com": STEFF_UTS,
  "orders@unitedtitlesolutions.com": {
    ...ASHLEY_UTS,
    name: "Orders Desk",
    title: "Title Orders Team",
    direct: undefined,
  },
  "closings@unitedtitlesolutions.com": {
    name: "Closings Desk",
    title: "Closings Team",
    office: "813-725-5757",
    eFax: "813-434-2248",
    email: "closings@unitedtitlesolutions.com",
    website: "www.unitedtitlesolutions.com",
    brand: "UTS",
  },
  "title@unitedtitlesolutions.com": {
    name: "Title Department",
    title: "Title Operations",
    office: "813-725-5757",
    eFax: "813-434-2248",
    email: "title@unitedtitlesolutions.com",
    website: "www.unitedtitlesolutions.com",
    brand: "UTS",
  },
  "support@unitedtitlesolutions.com": {
    name: "UTS Support",
    title: "Customer Support",
    office: "813-725-5757",
    email: "support@unitedtitlesolutions.com",
    website: "www.unitedtitlesolutions.com",
    brand: "UTS",
  },
  "wires@unitedtitlesolutions.com": {
    name: "Wires Desk",
    title: "Funds Management",
    office: "813-725-5757",
    email: "wires@unitedtitlesolutions.com",
    website: "www.unitedtitlesolutions.com",
    brand: "UTS",
  },
  "info@unitedtitlesolutions.com": {
    name: "United Title Solutions",
    title: "General Inquiries",
    office: "813-725-5757",
    email: "info@unitedtitlesolutions.com",
    website: "www.unitedtitlesolutions.com",
    brand: "UTS",
  },
  "info@utstitle.com": {
    name: "UTS Title",
    title: "General Inquiries",
    office: "813-725-5757",
    email: "info@utstitle.com",
    website: "www.utstitle.com",
    brand: "UTS",
  },
  "connect@signaturetransactionmanagement.com": KENNETH_STM,
  "pat@unitedtitlesolutions.com": PAT_UTS,
  "jordan@nprfunding.com": JORDAN_NPR,
  "devin@nprfunding.com": DEVIN_NPR,
};

function genericContactFor(mailbox: string): SignatureContact {
  return {
    name: mailbox.split("@")[0] ?? mailbox,
    email: mailbox,
    brand: "GENERIC",
  };
}

/**
 * Resolve an HTML signature for any mailbox. Falls back to a minimal
 * generic block so the body never opens with bare text.
 */
export function signatureHtmlForMailbox(mailbox: string): string {
  const contact = CONTACTS_BY_MAILBOX[mailbox] ?? genericContactFor(mailbox);
  return buildSignatureHtml(contact);
}

/**
 * Plain-text signature alias used by older code paths (unit tests, log
 * lines, the Profile section's textarea fallback). Returns the same
 * mailbox lookup as `signatureHtmlForMailbox` rendered as text.
 */
export function signatureForMailbox(mailbox: string): string {
  const contact = CONTACTS_BY_MAILBOX[mailbox] ?? genericContactFor(mailbox);
  return buildSignatureText(contact);
}

/**
 * Map kept for callers that want the underlying `SignatureContact`
 * record (e.g., to build a richer profile preview). Read-only.
 */
export const SIGNATURE_CONTACTS: Record<string, SignatureContact> = CONTACTS_BY_MAILBOX;
