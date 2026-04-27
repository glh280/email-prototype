"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Deal } from "@/mock/types";
import { TRACK_LABEL } from "@/mock/types";
import { formatCurrency } from "@/mock/helpers";

/**
 * A track-aware "Deal details" dialog. The set of fields shown depends on which
 * workflow the deal is in. Readonly for the prototype.
 */
export function DealDetailsButton({ deal }: { deal: Deal }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            🗂 Deal details
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deal details — {TRACK_LABEL[deal.track]}</DialogTitle>
          <DialogDescription>
            Track-specific fields for this workflow. Shown fields change depending on whether this is Title, Lending,
            Deal Desk, Consulting, or Partnership.
          </DialogDescription>
        </DialogHeader>

        {/* Common top block */}
        <section className="space-y-2 py-2 border-b">
          <Row label="Deal title" value={deal.title} />
          <Row label="Track" value={`${deal.track} · ${TRACK_LABEL[deal.track]}`} />
          <Row label="Property address" value={deal.propertyAddress ?? "—"} />
          <Row label="Property state" value={deal.propertyState ?? "—"} />
        </section>

        {/* Track-specific body */}
        <section className="space-y-2 py-2">
          {deal.track === "TI" && <TitleFields deal={deal} />}
          {deal.track === "LN" && <LendingFields deal={deal} />}
          {deal.track === "DD" && <DealDeskFields deal={deal} />}
          {deal.track === "CS" && <ConsultingFields deal={deal} />}
          {deal.track === "PT" && <PartnershipFields deal={deal} />}
        </section>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function TitleFields({ deal }: { deal: Deal }) {
  return (
    <>
      <Heading>Title-specific</Heading>
      <Row label="Purchase price" value={formatCurrency(deal.purchasePrice)} />
      <Row label="Loan amount" value={formatCurrency(deal.loanAmount)} />
      <Row label="Down payment" value={formatCurrency(deal.downPayment)} />
      <Row label="Title CTC" value={deal.titleCTC ? <Badge className="bg-emerald-500 text-white">Cleared</Badge> : "Pending"} />
      <Row label="Lender CTC" value={deal.lenderCTC ? <Badge className="bg-emerald-500 text-white">Cleared</Badge> : "Pending"} />
      <Row label="Scheduled closing" value={deal.closingAt ? new Date(deal.closingAt).toLocaleString() : "Not scheduled"} />
      <Row label="Policy type" value="Owner + Lender (ALTA)" />
      <Row label="Underwriter" value="CATIC (primary) / WFG (backup)" />
      <Row label="Title file #" value={`TI-${deal.id.slice(-4).toUpperCase()}`} />
    </>
  );
}

function LendingFields({ deal }: { deal: Deal }) {
  const loanType = deal.purchasePrice && deal.purchasePrice > 1_000_000 ? "DSCR-Commercial" : "DSCR";
  const dscr = deal.loanAmount && deal.purchasePrice ? (deal.purchasePrice / deal.loanAmount).toFixed(2) : "—";
  return (
    <>
      <Heading>Lending-specific</Heading>
      <Row label="Loan type" value={loanType} />
      <Row label="Loan amount" value={formatCurrency(deal.loanAmount)} />
      <Row label="Purchase price" value={formatCurrency(deal.purchasePrice)} />
      <Row label="LTV" value={deal.loanAmount && deal.purchasePrice ? `${Math.round((deal.loanAmount / deal.purchasePrice) * 100)}%` : "—"} />
      <Row label="Est. DSCR" value={dscr} />
      <Row label="Credit range" value="700+ (est)" />
      <Row label="Est. rehab" value="—" />
      <Row label="Exit strategy" value="Hold / refi" />
      <Row label="Loan #" value={`LN-${deal.id.slice(-4).toUpperCase()}`} />
    </>
  );
}

function DealDeskFields({ deal }: { deal: Deal }) {
  return (
    <>
      <Heading>Deal Desk / structuring-specific</Heading>
      <Row label="Deal type" value="Commercial distressed note" />
      <Row label="Purchase price" value={formatCurrency(deal.purchasePrice)} />
      <Row label="Capital stack" value="Senior + mezz + equity" />
      <Row label="Capital sourced %" value="65%" />
      <Row label="Target IRR" value="18–22%" />
      <Row label="Hold period" value="3–5 yrs" />
      <Row label="Deal source" value="Peter (VAC)" />
      <Row label="Board review" value={deal.id === "d_velocity_office" ? "Pending" : "N/A"} />
      <Row label="Review fee" value={deal.id === "d_velocity_office" ? "$5,000" : "—"} />
    </>
  );
}

function ConsultingFields({ deal }: { deal: Deal }) {
  return (
    <>
      <Heading>Consulting / education-specific</Heading>
      <Row label="Engagement type" value="Strategy session" />
      <Row label="Hours estimated" value="1 hr" />
      <Row label="Rate" value="—" />
      <Row label="Entry source" value="Skool free tier" />
      <Row label="Focus area" value="DSCR stack walkthrough" />
      <Row label="Follow-up material" value="Five Levers PDF" />
    </>
  );
}

function PartnershipFields({ deal }: { deal: Deal }) {
  return (
    <>
      <Heading>Partnership-specific</Heading>
      <Row label="Partnership type" value="Title Partner (workshare)" />
      <Row label="BC-17 vetting" value={<Badge className="bg-amber-500 text-white">INCOMPLETE</Badge>} />
      <Row label="References called" value="0 / 2" />
      <Row label="Last partnership ended" value="—" />
      <Row label="Needs unmet elsewhere" value="—" />
      <Row label="Pipeline impact if ended" value="—" />
      <Row label="Fee structure" value="$350 coord / 30% premium spread" />
      <Row label="Agreement status" value="Drafted, not signed" />
    </>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
      {children}
    </div>
  );
}
