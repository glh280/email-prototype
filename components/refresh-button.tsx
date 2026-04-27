"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const [spinning, setSpinning] = useState(false);
  function refresh() {
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      toast.success("Refreshed (simulated)", {
        description: "In production this re-fetches deals + linked emails from server.",
      });
    }, 500);
  }
  return (
    <Button size="sm" variant="ghost" onClick={refresh} title="Refresh (Cmd/Ctrl-R)" className="gap-1.5">
      <span className={`inline-block ${spinning ? "animate-spin" : ""}`}>↻</span>
      Refresh
    </Button>
  );
}
