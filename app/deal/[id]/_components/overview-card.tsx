"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarIcon, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { parseMoney } from "@/lib/parse-money";
import {
  updateDealSchema,
  type UpdateDealFormInput,
  type UpdateDealInput,
} from "@/lib/deal-schema";
import { updateDeal } from "../actions/deals";
import {
  trackBadgeClasses,
  priorityDotClasses,
  priorityPillClasses,
} from "@/lib/format";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 Task 3 — Overview card (UI-SPEC lines 241-285).
 *
 * One reusable Card with two modes:
 *   - read  (default): <dl> grid of label/value pairs, em-dash for null
 *   - edit: fields turn into input controls (RHF + zodResolver(updateDealSchema))
 *           Cancel + Save changes footer; Save calls updateDeal with the diff
 *
 * The card owns its own edit state. Save success → router.refresh() so the
 * server component re-runs queryDealById with fresh data.
 *
 * Killed-deal handling: when deal.status==='killed', the Edit button is
 * disabled (opacity handled at parent via parent wrapper).
 *
 * Read-only fields (openedAt, closedAt, killedAt, killReason, track,
 * status when derived) are rendered via the `readOnly` flag on the field
 * spec — they still appear in the <dl> but never switch to an input.
 */

export type FieldKind =
  | "text"
  | "money"
  | "date"
  | "bool"
  | "select"
  | "textarea";

export type FieldSpec = {
  key: string; // keyof DealDetail (editable keys match updateDealSchema)
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string }>; // for kind === 'select'
  readOnly?: boolean;
  // Render hint for read-mode display of bespoke values (track badge, status, etc.)
  renderRead?: (deal: DealDetail) => React.ReactNode;
};

// Format a value for read-mode <dd>.
function formatRead(value: unknown, kind: FieldKind): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/70">—</span>;
  }
  switch (kind) {
    case "money":
      return `$${Number(value).toLocaleString("en-US")}`;
    case "date":
      if (value instanceof Date) {
        return value.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      return String(value);
    case "bool":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

export function OverviewCard(props: {
  title: string;
  deal: DealDetail;
  fields: FieldSpec[];
}) {
  const { title, deal, fields } = props;
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const isLocked = deal.status === "killed" || deal.status === "closed";

  // Build form default values from current deal — only for editable fields.
  const defaultValues = React.useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.readOnly) continue;
      const v = (deal as unknown as Record<string, unknown>)[f.key];
      defaults[f.key] = v ?? undefined;
    }
    return defaults as UpdateDealFormInput;
  }, [deal, fields]);

  const form = useForm<UpdateDealFormInput, unknown, UpdateDealInput>({
    resolver: zodResolver(updateDealSchema),
    defaultValues,
  });

  // Reset form values whenever the deal changes (e.g., after router.refresh())
  React.useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = (data: UpdateDealInput) => {
    // Compute diff vs deal — only send fields that actually changed.
    const diff: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.readOnly) continue;
      const newVal = (data as unknown as Record<string, unknown>)[f.key];
      const oldVal = (deal as unknown as Record<string, unknown>)[f.key];
      // Normalize undefined/null/"" as equivalent "no value"
      const aEmpty = newVal === undefined || newVal === null || newVal === "";
      const bEmpty = oldVal === undefined || oldVal === null || oldVal === "";
      if (aEmpty && bEmpty) continue;
      // Date comparison: compare getTime()
      if (newVal instanceof Date && oldVal instanceof Date) {
        if (newVal.getTime() === oldVal.getTime()) continue;
      } else if (newVal === oldVal) {
        continue;
      }
      diff[f.key] = newVal ?? null;
    }

    startTransition(async () => {
      const result = await updateDeal({ dealId: deal.id, ...diff });
      if (result.ok) {
        toast.success("Changes saved.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(`Couldn't save — ${result.error}. Try again.`);
      }
    });
  };

  const onInvalid = () => {
    toast.error("Please fix the errors above.");
  };

  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center border-b">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={isLocked}
          >
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4">
            {fields.map((f) => {
              const value = (deal as unknown as Record<string, unknown>)[f.key];
              return (
                <React.Fragment key={f.key}>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="text-sm font-mono">
                    {f.renderRead
                      ? f.renderRead(deal)
                      : formatRead(value, f.kind)}
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
              <div className="grid grid-cols-[140px_1fr] gap-y-4 gap-x-4 items-start">
                {fields.map((f) => {
                  if (f.readOnly) {
                    const value = (deal as unknown as Record<string, unknown>)[
                      f.key
                    ];
                    return (
                      <React.Fragment key={f.key}>
                        <div className="text-xs font-medium text-muted-foreground pt-2">
                          {f.label}
                        </div>
                        <div className="text-sm font-mono pt-2">
                          {f.renderRead
                            ? f.renderRead(deal)
                            : formatRead(value, f.kind)}
                        </div>
                      </React.Fragment>
                    );
                  }
                  return (
                    <FieldRow
                      key={f.key}
                      field={f}
                      form={form}
                      makeMoneyBlurHandler={makeMoneyBlurHandler}
                    />
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    form.reset(defaultValues);
                    setEditing(false);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

// Reusable money-onBlur handler factory — mirrors the pattern from
// app/deal/new/new-deal-form.tsx (P1 Plan 05). Parses the input string
// via parseMoney and sets the form field to the integer (or null).
function makeMoneyBlurHandler(
  form: ReturnType<
    typeof useForm<UpdateDealFormInput, unknown, UpdateDealInput>
  >,
  fieldName: string,
) {
  return (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseMoney(e.target.value);
    form.setValue(
      fieldName as keyof UpdateDealFormInput,
      (parsed ?? null) as never,
      { shouldValidate: true, shouldDirty: true },
    );
    e.target.value =
      parsed === null ? "" : `$${parsed.toLocaleString("en-US")}`;
  };
}

function FieldRow(props: {
  field: FieldSpec;
  form: ReturnType<
    typeof useForm<UpdateDealFormInput, unknown, UpdateDealInput>
  >;
  makeMoneyBlurHandler: typeof makeMoneyBlurHandler;
}) {
  const { field: f, form } = props;

  return (
    <FormField
      control={form.control}
      name={f.key as keyof UpdateDealFormInput}
      render={({ field }) => (
        <>
          <FormLabel
            htmlFor={`field-${f.key}`}
            className="text-xs font-medium text-muted-foreground pt-2"
          >
            {f.label}
          </FormLabel>
          <FormItem>
            <FormControl>{renderInput(f, field, form)}</FormControl>
            <FormMessage />
          </FormItem>
        </>
      )}
    />
  );
}

function renderInput(
  f: FieldSpec,
  field: {
    value: unknown;
    onChange: (v: unknown) => void;
    onBlur: () => void;
    name: string;
  },
  form: ReturnType<
    typeof useForm<UpdateDealFormInput, unknown, UpdateDealInput>
  >,
): React.ReactElement {
  switch (f.kind) {
    case "text":
      return (
        <Input
          id={`field-${f.key}`}
          value={(field.value as string | null | undefined) ?? ""}
          onChange={(e) => field.onChange(e.target.value || null)}
          onBlur={field.onBlur}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={`field-${f.key}`}
          rows={3}
          value={(field.value as string | null | undefined) ?? ""}
          onChange={(e) => field.onChange(e.target.value || null)}
          onBlur={field.onBlur}
        />
      );
    case "money":
      return (
        <MoneyInput
          value={field.value as number | null | undefined}
          onBlur={makeMoneyBlurHandler(form, f.key)}
        />
      );
    case "bool":
      return (
        <div className="flex items-center">
          <Checkbox
            id={`field-${f.key}`}
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(!!v)}
          />
        </div>
      );
    case "select":
      return (
        <Select
          value={(field.value as string | null | undefined) ?? ""}
          onValueChange={(v) => field.onChange(v || null)}
        >
          <SelectTrigger id={`field-${f.key}`} className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {f.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <DateFieldControl
          value={field.value as Date | null | undefined}
          onChange={(d) => field.onChange(d)}
        />
      );
    default:
      return <span>Unsupported field kind: {f.kind}</span>;
  }
}

/**
 * $-prefix money input — mirrors the shape in app/deal/new/new-deal-form.tsx.
 */
function MoneyInput(props: {
  value: number | null | undefined;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const defaultDisplay =
    props.value == null || props.value === undefined
      ? ""
      : `$${props.value.toLocaleString("en-US")}`;
  return (
    <div className="relative">
      <span
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none"
        aria-hidden="true"
      >
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        className="pl-6"
        defaultValue={defaultDisplay}
        onBlur={props.onBlur}
      />
    </div>
  );
}

/**
 * Popover + Calendar date picker — mirrors app/deal/new/new-deal-form.tsx.
 */
function DateFieldControl(props: {
  value: Date | null | undefined;
  onChange: (v: Date | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const label = props.value
    ? (props.value as Date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" type="button" className="justify-start">
              <CalendarIcon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={(props.value as Date | undefined) ?? undefined}
            onSelect={(d) => {
              props.onChange(d ?? null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {props.value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => props.onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

// Re-exports so OverviewTab can render read-mode badges matching list view.
export function TrackBadgeReadOnly(props: { deal: DealDetail }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
        trackBadgeClasses[props.deal.trackCode] ?? ""
      }`}
    >
      {props.deal.trackLabel}
    </span>
  );
}

export function StatusBadgeReadOnly(props: { deal: DealDetail }) {
  const { status } = props.deal;
  if (status === "killed") {
    return (
      <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive ring-1 ring-destructive/30">
        Killed
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground ring-1 ring-border">
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/30">
      Active
    </span>
  );
}

export function PriorityBadgeReadOnly(props: { deal: DealDetail }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
        priorityPillClasses[props.deal.priority] ?? ""
      }`}
    >
      <span
        className={priorityDotClasses[props.deal.priority] ?? ""}
        aria-hidden="true"
      />
      {props.deal.priority}
    </span>
  );
}

/**
 * Phase 3 Plan 07 — Main Contact read-only renderer.
 *
 * Reads from the deal_people row with role='main_contact' (the authoritative
 * post-D-03 source — joined in queryDealById via mainContactPerson). If no
 * deal_people row exists (pre-backfill grace-period fallback), renders from
 * deals.main_contact_* text columns — preserved until the P10 drop migration.
 *
 * If neither source has data, renders em-dash (unassigned state).
 *
 * Includes a link to the File Contacts tab so the operator can assign/edit
 * the main_contact slot — the authoritative write path per Plan 06.
 */
export function MainContactReadOnly(props: { deal: DealDetail }) {
  const { deal } = props;
  const fromDealPeople = deal.mainContactPerson;
  const name =
    fromDealPeople?.contactFullName ?? deal.legacyMainContactName ?? null;
  const email =
    fromDealPeople?.contactEmail ?? deal.legacyMainContactEmail ?? null;

  if (!name && !email) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground/70">—</span>
        <a
          href="?tab=contacts"
          className="text-xs text-primary underline underline-offset-2"
        >
          Assign in File Contacts →
        </a>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span>
        {name ?? <span className="text-muted-foreground/70">—</span>}
        {email ? (
          <span className="text-muted-foreground ml-2 text-xs">{email}</span>
        ) : null}
      </span>
      <a
        href="?tab=contacts"
        className="text-xs text-primary underline underline-offset-2 mt-0.5"
      >
        Edit in File Contacts →
      </a>
    </span>
  );
}
