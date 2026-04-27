import type { StageKey } from "@/mock/types";
import { stageLabel } from "@/mock/helpers";

const PIPELINE: StageKey[] = [
  "pre_screen",
  "deal_structuring",
  "deal_team_assigned",
  "lender_packaging",
  "lender_shopping",
  "term_sheet_pending",
  "pre_qual_approval",
  "term_sheet_execution",
  "closed",
];

/**
 * Tiny horizontal progress bar suitable for inline row display.
 * Shows the current position as filled segments vs unfilled.
 * Hover shows the stage label.
 */
export function MiniStageBar({ current }: { current: StageKey }) {
  if (current === "killed") {
    return (
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-full bg-red-500 rounded-full" title="Killed" />
      </div>
    );
  }
  const idx = PIPELINE.indexOf(current);
  return (
    <div className="flex items-center gap-[2px]" title={stageLabel(current)}>
      {PIPELINE.map((key, i) => {
        const isCurrent = i === idx;
        const isDone = i < idx;
        return (
          <span
            key={key}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              isCurrent
                ? "bg-foreground"
                : isDone
                  ? "bg-emerald-500"
                  : "bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
}
