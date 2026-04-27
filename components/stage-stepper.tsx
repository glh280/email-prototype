import { STAGES, type StageKey } from "@/mock/types";
import { stageIndex, stageLabel } from "@/mock/helpers";

// The pipeline-visible stages (exclude killed; closed is the terminal end of the line)
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

export function StageStepper({ current }: { current: StageKey }) {
  if (current === "killed") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="font-medium text-red-700 dark:text-red-300">Killed</span>
      </div>
    );
  }
  const idx = PIPELINE.indexOf(current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {PIPELINE.map((key, i) => {
        const isCurrent = i === idx;
        const isDone = i < idx;
        return (
          <div key={key} className="flex items-center shrink-0">
            <div
              className={`rounded-md px-2.5 py-1 text-xs whitespace-nowrap ${
                isCurrent
                  ? "bg-foreground text-background font-medium"
                  : isDone
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-muted text-muted-foreground"
              }`}
              title={STAGES.find((s) => s.key === key)?.label ?? key}
            >
              {isDone ? "✓ " : ""}
              {stageLabel(key).split(" / ")[0].split(" — ")[0]}
            </div>
            {i < PIPELINE.length - 1 && <div className="w-3 h-px bg-border mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

export function stageProgress(current: StageKey): { done: number; total: number } {
  if (current === "killed") return { done: 0, total: PIPELINE.length };
  const idx = stageIndex(current);
  return { done: Math.max(idx, 0) + 1, total: PIPELINE.length };
}
