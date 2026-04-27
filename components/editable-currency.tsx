"use client";

import { useState } from "react";
import { formatCurrency } from "@/mock/helpers";

/** Click-to-edit currency field. Enter or blur commits. Escape cancels. */
export function EditableCurrency({
  value,
  onChange,
  className,
}: {
  value?: number;
  onChange: (next: number | undefined) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");

  function commit() {
    const trimmed = draft.replace(/[$,\s]/g, "");
    if (!trimmed) {
      onChange(undefined);
    } else {
      const n = Number(trimmed);
      if (!Number.isNaN(n)) onChange(n);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`rounded border px-1 py-0.5 bg-background outline-none focus:ring-2 focus:ring-foreground/20 ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      className={`hover:bg-muted/40 rounded px-1 -mx-1 text-left ${className ?? ""}`}
      title="Click to edit"
    >
      {formatCurrency(value)}
    </button>
  );
}
