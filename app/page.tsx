import { AppHeader } from "@/components/app-header";
import { DealsView } from "@/components/deals-view";
import { DEALS } from "@/mock/deals";

export default function Home() {
  const activeDeals = DEALS.filter((d) => d.status === "active");
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <DealsView deals={activeDeals} />
      </main>
    </>
  );
}
