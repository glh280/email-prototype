import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

/**
 * Phase 2 Plan 05 — Deal-not-found empty state.
 *
 * Rendered when `queryDealById(id)` returns null (bad UUID, deleted row).
 * Copy verbatim from UI-SPEC §Empty states table (lines 636-638).
 */
export default function DealNotFound() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1120px] px-6 py-6">
        <div className="flex flex-col items-center py-24 text-center">
          <FileQuestion className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
            Deal not found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It might have been killed or the link is stale.
          </p>
          <Button
            render={<Link href="/">Back to deals</Link>}
            variant="outline"
            className="mt-6"
          />
        </div>
      </main>
    </>
  );
}
