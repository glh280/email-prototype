// L1 /inbox2 preview-pane attachment fixtures.
//
// SOURCE: new (no PROD source — Workspace-shell file list)
// CREATED: 2026-04-28
// STATUS: new
// REINTEGRATION: replaced by `queryAttachmentsForThread` joining
//   `gmail_message_attachments` rows server-side.

import type { Attachment } from "./types";

export const ATTACHMENTS_BY_THREAD: Record<string, Attachment[]> = {
  t_001: [
    { id: "att_001_1", name: "Appraisal-Order-1845-Maple.pdf", sizeLabel: "412 KB", kind: "pdf" },
  ],
  t_002: [
    { id: "att_002_1", name: "Wire-Instructions-FNB.pdf", sizeLabel: "188 KB", kind: "pdf" },
    { id: "att_002_2", name: "Closing-Disclosure-v3.pdf", sizeLabel: "1.4 MB", kind: "pdf" },
  ],
  t_004: [
    { id: "att_004_1", name: "Title-Commitment-22-441.pdf", sizeLabel: "892 KB", kind: "pdf" },
  ],
  t_005: [
    { id: "att_005_1", name: "Survey-Lot-12B.pdf", sizeLabel: "2.1 MB", kind: "pdf" },
    { id: "att_005_2", name: "Plat-Map.png", sizeLabel: "640 KB", kind: "image" },
  ],
  t_007: [
    { id: "att_007_1", name: "UW-Conditions.docx", sizeLabel: "78 KB", kind: "docx" },
  ],
  t_008: [
    { id: "att_008_1", name: "Rate-Lock-Confirmation.pdf", sizeLabel: "212 KB", kind: "pdf" },
    { id: "att_008_2", name: "Term-Sheet-v2.pdf", sizeLabel: "560 KB", kind: "pdf" },
  ],
  t_009: [
    { id: "att_009_1", name: "Final-Wire-Receipt.pdf", sizeLabel: "92 KB", kind: "pdf" },
    { id: "att_009_2", name: "HUD-1.pdf", sizeLabel: "1.1 MB", kind: "pdf" },
    { id: "att_009_3", name: "Recording-Confirmation.pdf", sizeLabel: "146 KB", kind: "pdf" },
  ],
  t_012: [
    { id: "att_012_1", name: "Settlement-Statement.xlsx", sizeLabel: "44 KB", kind: "xlsx" },
  ],
  t_013: [
    { id: "att_013_1", name: "Photos-Property.zip", sizeLabel: "8.4 MB", kind: "other" },
  ],
  t_014: [
    { id: "att_014_1", name: "Lender-Term-Sheet.pdf", sizeLabel: "320 KB", kind: "pdf" },
  ],
};

export function attachmentsForThread(threadId: string): Attachment[] {
  return ATTACHMENTS_BY_THREAD[threadId] ?? [];
}
