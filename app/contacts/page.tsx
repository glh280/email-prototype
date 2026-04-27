import Link from "next/link";
import { Users, Search } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "./_components/contacts-table";
import { ContactsSearchBar } from "./_components/contacts-search-bar";
import { NewContactDialog } from "./_components/new-contact-dialog";
import { queryContactsForList } from "@/lib/contacts-query";
import {
  parseContactsFilterParams,
  hasAnyContactsFilter,
} from "@/lib/contacts-filter-params";

/**
 * Phase 3 Plan 05 — /contacts page (VIEW-06 + PEOPLE-04).
 *
 * Server Component. Mirrors app/page.tsx shape: searchParams Promise
 * (Next.js 16), filter parse, DB query via queryContactsForList, two
 * empty-state branches (no contacts at all vs filtered-empty).
 *
 * URL-state (D-07): `?q=<query>` — case-insensitive substring across
 * full_name OR email OR org (enforced inside lib/contacts-query.ts).
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseContactsFilterParams(sp);
  const contacts = await queryContactsForList(filters.q || undefined);
  const anyFilter = hasAnyContactsFilter(filters);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Contacts</h1>
          <NewContactDialog />
        </div>

        <div className="mt-4">
          <ContactsSearchBar />
        </div>

        <div className="mt-4">
          {contacts.length === 0 ? (
            anyFilter ? (
              <div className="flex flex-col items-center py-24 text-center">
                <Search className="h-12 w-12 text-muted-foreground" />
                <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
                  No contacts match your search
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a different query.
                </p>
                <Button
                  render={<Link href="/contacts">Clear search</Link>}
                  variant="outline"
                  className="mt-6"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center py-24 text-center">
                <Users className="h-12 w-12 text-muted-foreground" />
                <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
                  No contacts yet
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add your first contact to start tracking people on deals.
                </p>
                <div className="mt-6">
                  <NewContactDialog />
                </div>
              </div>
            )
          ) : (
            <ContactsTable contacts={contacts} />
          )}
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </div>
      </main>
    </>
  );
}
