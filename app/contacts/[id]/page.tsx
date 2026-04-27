import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { queryContactById } from "@/lib/contacts-query";

/**
 * Phase 3 Plan 05 Task 1 — /contacts/[id] minimal read-only stub.
 *
 * Displays fields for the contact. Full edit UX lives in a later plan
 * (P10 calibration or a follow-up). Keeps Plan 05 narrow: list + create +
 * row-click navigation target.
 *
 * Next.js 16: `params` is a Promise (verified against node_modules/next/dist/docs).
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await queryContactById(id);
  if (!contact) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[960px] px-6 py-6">
        <Button
          render={<Link href="/contacts">← All contacts</Link>}
          variant="ghost"
          size="sm"
        />
        <h1 className="mt-4 text-xl font-semibold">{contact.fullName}</h1>
        <dl className="mt-6 grid grid-cols-[140px_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{contact.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{contact.phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Org</dt>
          <dd>{contact.org ?? "—"}</dd>
          <dt className="text-muted-foreground">Role hint</dt>
          <dd>{contact.roleHint ?? "—"}</dd>
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="whitespace-pre-wrap">{contact.notes ?? "—"}</dd>
        </dl>
      </main>
    </>
  );
}
