import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DealDetail } from "@/components/deal-detail";
import { getDeal } from "@/mock/deals";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <DealDetail deal={deal} />
      </main>
    </>
  );
}
