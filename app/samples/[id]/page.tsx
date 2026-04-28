/**
 * SOURCE: new (no PROD source — Workspace shell attachment preview stub)
 * CREATED: 2026-04-28
 * STATUS: new
 * REINTEGRATION: replaced by signed-URL download from
 *   `gmail_message_attachments` (S3 / Drive) at L2+.
 */

import { ATTACHMENTS_BY_THREAD } from "@/mock/attachments";

export default async function SamplePreviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let foundName: string | null = null;
  let foundSize: string | null = null;
  for (const list of Object.values(ATTACHMENTS_BY_THREAD)) {
    const att = list.find((a) => a.id === id);
    if (att) {
      foundName = att.name;
      foundSize = att.sizeLabel;
      break;
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", fontFamily: "system-ui" }}>
      <a href="/inbox2" style={{ fontSize: 12, color: "#64748b" }}>
        Back to inbox
      </a>
      <h1 style={{ fontSize: 18, marginTop: 16 }}>
        {foundName ?? `Unknown attachment: ${id}`}
      </h1>
      {foundSize ? (
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Size: {foundSize}
        </p>
      ) : null}
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 24, maxWidth: 480 }}>
        Sample attachment preview. The click flow, new-tab open, and routing
        all work today; binary download wires up at L2+.
      </p>
      <code
        style={{
          display: "inline-block",
          marginTop: 24,
          background: "#f1f5f9",
          padding: "4px 8px",
          fontSize: 11,
          fontFamily: "monospace",
        }}
      >
        /samples/{id}
      </code>
    </main>
  );
}
