"use client";

import * as React from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { AdvanceStageDialog } from "./advance-stage-dialog";
import { RevertStageDialog } from "./revert-stage-dialog";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Stage stepper (UI-SPEC lines 197-220).
 *
 * Horizontal pip-and-line strip for every stage in `deal.availableStages`
 * (universal + track-specific). Pips 20 px. States per UI-SPEC color mapping:
 *   - Past:     bg-primary/20        (clickable → RevertStageDialog)
 *   - Current:  bg-primary + ring    (label shown below)
 *   - Future:   bg-background + ring (disabled)
 *   - Terminal reached 'file_completed': bg-primary + Check icon
 *   - Terminal reached 'killed':          bg-destructive + X icon
 *
 * Below the strip, right-aligned: `Advance to {next.label} →` CTA that opens
 * AdvanceStageDialog. When current.isTerminal, CTA is replaced by muted text
 * `Deal in terminal stage — {stage.label}`.
 *
 * Accessibility (UI-SPEC lines 770-783):
 *   - Each pip: aria-label={stage.label} + aria-current={isCurrent ? 'step' : undefined}
 *   - Past pips: button (tabIndex=0) — Enter/Space opens revert dialog
 */
export function StageStepper(props: { deal: DealDetail }) {
  const { deal } = props;
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [revertTarget, setRevertTarget] = React.useState<
    DealDetail["availableStages"][number] | null
  >(null);
  const revertOpen = revertTarget !== null;

  const current = deal.currentStage;
  const stages = deal.availableStages;
  const currentIdx = stages.findIndex((s) => s.id === current.id);

  // Next stage = first stage with sortOrder > current.sortOrder AND compatible
  // track (universal OR same track). availableStages is already filtered to
  // compatible stages, so "sortOrder > current" is sufficient — excluding
  // `killed` (terminal non-progress stage).
  const nextStage = stages.find(
    (s) => s.sortOrder > current.sortOrder && s.code !== "killed",
  );

  const isKilled = deal.status === "killed";
  const isTerminalCurrent = current.isTerminal;
  const advanceHidden = isTerminalCurrent || isKilled || !nextStage;

  return (
    <div className="mt-6">
      <div
        className="flex items-center gap-0"
        role="list"
        aria-label="Deal milestones"
      >
        {stages.map((stage, idx) => {
          const isCurrent = stage.id === current.id;
          const isPast = currentIdx >= 0 && idx < currentIdx;
          const isFuture = currentIdx >= 0 && idx > currentIdx;
          const isTerminalFileCompleted =
            isCurrent && stage.code === "file_completed";
          const isTerminalKilled = isCurrent && stage.code === "killed";

          // Compute pip classes per UI-SPEC color mapping
          let pipClasses =
            "relative flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium shrink-0 transition-colors";
          if (isTerminalKilled) {
            pipClasses +=
              " bg-destructive text-destructive-foreground ring-2 ring-destructive/30 ring-offset-2";
          } else if (isTerminalFileCompleted) {
            pipClasses +=
              " bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2";
          } else if (isCurrent) {
            pipClasses +=
              " bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2";
          } else if (isPast) {
            pipClasses += " bg-primary/20 text-primary";
          } else {
            pipClasses +=
              " bg-background text-muted-foreground ring-1 ring-border";
          }

          // Line-segment color (between this pip and the next)
          const nextPip = stages[idx + 1];
          const segClasses =
            isPast || isCurrent ? "bg-primary/40" : "bg-border";

          const pipNode = (
            <>
              {isTerminalFileCompleted ? (
                <Check className="h-3 w-3" />
              ) : isTerminalKilled ? (
                <X className="h-3 w-3" />
              ) : null}
            </>
          );

          const pipCommonProps = {
            "aria-label": stage.label,
            "aria-current": isCurrent ? ("step" as const) : undefined,
          };

          return (
            <div
              key={stage.id}
              className="flex items-center"
              style={{ flex: nextPip ? 1 : "0 0 auto" }}
              role="listitem"
            >
              {isPast && !isKilled ? (
                // Past pip — clickable to revert
                <HoverCard>
                  <HoverCardTrigger
                    render={
                      <button
                        type="button"
                        className={pipClasses}
                        onClick={() => setRevertTarget(stage)}
                        {...pipCommonProps}
                      >
                        {pipNode}
                      </button>
                    }
                  />
                  <HoverCardContent className="w-auto text-xs">
                    <div className="font-medium">{stage.label}</div>
                    <div className="text-muted-foreground">
                      Click to revert here
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : isFuture ? (
                // Future pip — disabled
                <HoverCard>
                  <HoverCardTrigger
                    render={
                      <span
                        className={`${pipClasses} cursor-not-allowed`}
                        aria-disabled="true"
                        {...pipCommonProps}
                      >
                        {pipNode}
                      </span>
                    }
                  />
                  <HoverCardContent className="w-auto text-xs">
                    <div className="font-medium">{stage.label}</div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                // Current pip — no click, label shown below
                <span className={pipClasses} {...pipCommonProps}>
                  {pipNode}
                </span>
              )}
              {nextPip ? (
                <div className={`flex-1 h-0.5 min-w-4 ${segClasses}`} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Current stage label, positioned under the current pip */}
      <div className="mt-2 text-xs font-semibold text-foreground">
        {current.label}
      </div>

      {/* Advance CTA or terminal message, right-aligned below stepper */}
      <div className="mt-3 flex justify-end">
        {advanceHidden ? (
          <div className="text-sm text-muted-foreground">
            Deal in terminal stage — {current.label}
          </div>
        ) : nextStage ? (
          <Button size="sm" onClick={() => setAdvanceOpen(true)}>
            Advance to {nextStage.label}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>

      {/* Dialogs */}
      {nextStage ? (
        <AdvanceStageDialog
          open={advanceOpen}
          onOpenChange={setAdvanceOpen}
          deal={deal}
          nextStage={nextStage}
        />
      ) : null}
      <RevertStageDialog
        open={revertOpen}
        onOpenChange={(v) => {
          if (!v) setRevertTarget(null);
        }}
        deal={deal}
        targetStage={revertTarget}
      />
    </div>
  );
}
