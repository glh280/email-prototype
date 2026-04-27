"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Phase 1 Plan 06 Task 3 — one-shot success toast.
 *
 * Plan 05's createDeal server action redirects to `/?created={fileNo}` after
 * a successful insert. This component reads that param on mount, fires
 * `Deal {fileNo} created.` via sonner, then strips the param from the URL via
 * router.replace so a refresh doesn't re-fire the toast.
 *
 * `firedRef` guards against StrictMode double-invoke of the effect in dev —
 * without it, the toast pops twice on dev-mode hydration.
 */
export function SuccessToast() {
  const sp = useSearchParams();
  const router = useRouter();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const created = sp.get("created");
    if (!created) return;
    if (firedRef.current === created) return;
    firedRef.current = created;

    toast.success(`Deal ${created} created.`);

    // Strip ?created= so refresh / back-nav doesn't re-fire
    const next = new URLSearchParams(sp.toString());
    next.delete("created");
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }, [sp, router]);

  return null;
}
