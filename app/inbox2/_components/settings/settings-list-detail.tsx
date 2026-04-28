"use client";

/**
 * SOURCE: new (no PROD source — /settings list+detail scaffold)
 * CREATED: 2026-04-28
 * STATUS: new
 * REINTEGRATION: ship as-is.
 *
 * Reusable 2-column scaffold for /settings section pages. Middle column
 * = searchable list of items; right column = detail panel for the
 * selected item. Each section page parameterizes via render props.
 *
 * The outer 3-col layout is composed of:
 *   <SettingsSectionNav />  ← layout.tsx (left)
 *   <SettingsListDetail />  ← inside each section page (middle + right)
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props<T> = {
  title: string;
  description?: string;
  items: T[];
  /** Stable per-item key. */
  getId: (item: T) => string;
  /** Lowercased fields to match against the search input. */
  matchValue: (item: T) => string;
  /** Optional toolbar slot (Add new, Import, etc.). */
  toolbar?: React.ReactNode;
  /** Render the row in the middle column. */
  renderRow: (item: T, opts: { selected: boolean }) => React.ReactNode;
  /** Render the right-column detail for the selected item. */
  renderDetail: (item: T) => React.ReactNode;
  /** Right-column placeholder when nothing selected. */
  emptyDetail?: React.ReactNode;
  /** Optional middle column width override. Default 320px. */
  listWidth?: number;
  /** Initially selected item id (defaults to first item). */
  initialSelectedId?: string;
};

export function SettingsListDetail<T>({
  title,
  description,
  items,
  getId,
  matchValue,
  toolbar,
  renderRow,
  renderDetail,
  emptyDetail,
  listWidth = 320,
  initialSelectedId,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? (items[0] ? getId(items[0]) : null),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => matchValue(i).toLowerCase().includes(q));
  }, [items, query, matchValue]);

  const selected = useMemo(
    () => items.find((i) => getId(i) === selectedId) ?? null,
    [items, getId, selectedId],
  );

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="border-r bg-background flex flex-col min-h-0"
        style={{ width: listWidth }}
      >
        <header className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          ) : null}
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          {toolbar ? <div className="mt-2">{toolbar}</div> : null}
        </header>
        <ul className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-[11px] text-muted-foreground text-center">
              No matches
            </li>
          ) : (
            filtered.map((item) => {
              const id = getId(item);
              const isSel = id === selectedId;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(id)}
                    aria-current={isSel ? "true" : undefined}
                    className={cn(
                      "w-full text-left px-3 py-2 border-b border-border/50 transition-colors",
                      "border-l-[3px]",
                      isSel
                        ? "bg-primary/5 border-l-primary"
                        : "border-l-transparent hover:bg-muted/40",
                    )}
                  >
                    {renderRow(item, { selected: isSel })}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>
      <section className="flex-1 min-w-0 overflow-y-auto bg-muted/10">
        {selected ? renderDetail(selected) : (emptyDetail ?? <DefaultEmpty />)}
      </section>
    </div>
  );
}

function DefaultEmpty() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
      Select an item from the list.
    </div>
  );
}

export function DetailHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b bg-background px-6 py-4 flex items-start justify-between gap-3 sticky top-0 z-10">
      <div className="min-w-0">
        <h3 className="text-base font-semibold truncate">{title}</h3>
        {subtitle ? (
          <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}

export function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 py-4 border-b last:border-b-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 items-start text-xs">
      <div className="text-muted-foreground pt-0.5">{label}</div>
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}
