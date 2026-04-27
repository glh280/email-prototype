"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  createDealSchema,
  type CreateDealInput,
  type CreateDealFormInput,
} from "@/lib/deal-schema";
import { createDeal } from "./actions";
import { parseMoney } from "@/lib/parse-money";

/**
 * New Deal form — Phase 1 Plan 05 Task 4.
 *
 * UI contract from .planning/phases/01-core-data-model/01-UI-SPEC.md Page 2.
 * Key decisions: single-column accordion (D-08), property-section always
 * visible (D-09), default stage pre_screen_qualification handled on server
 * (D-10), inline validation + toast feedback (D-11). Money fields use
 * parseMoney on blur to normalize "$485,000" → integer 485000 before the
 * server action sees them.
 */

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const PROPERTY_TYPES = [
  ["single_family", "Single Family"],
  ["multi_family", "Multi Family"],
  ["condo", "Condo"],
  ["townhome", "Townhome"],
  ["commercial", "Commercial"],
  ["land", "Land"],
  ["other", "Other"],
] as const;

const LOAN_TYPES = [
  ["conventional", "Conventional"],
  ["dscr", "DSCR"],
  ["hard_money", "Hard Money"],
  ["bridge", "Bridge"],
  ["transactional", "Transactional"],
  ["cash", "Cash"],
  ["other", "Other"],
] as const;

const TRANSACTION_TYPES = [
  ["purchase", "Purchase"],
  ["refinance", "Refinance"],
  ["wholesale", "Wholesale"],
  ["double_close", "Double Close"],
  ["other", "Other"],
] as const;

/**
 * Track badge color map — mirrors lib/format.ts::trackBadgeClasses added
 * in Plan 06. Used for the colored dot beside each Track <SelectItem>
 * label per UI-SPEC "Track Select option color dot" requirement.
 */
const TRACK_DOT_CLASSES: Record<string, string> = {
  TE: "bg-blue-500",
  FL: "bg-green-500",
  DP: "bg-purple-500",
  PO: "bg-pink-500",
  EC: "bg-amber-500",
  SL: "bg-rose-500",
  BL: "bg-teal-500",
  GI: "bg-gray-400",
};

type TrackOption = {
  code: string;
  label: string;
  defaultPriority: string;
  sortOrder: number;
};

export function NewDealForm(props: {
  tracks: TrackOption[];
  currentYear: number;
  fileNoEstimate: string;
}) {
  const form = useForm<CreateDealFormInput, unknown, CreateDealInput>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      trackCode: undefined,
      priority: undefined,
      title: "",
      propertyState: undefined,
      mainContactName: "",
      mainContactEmail: "",
      propertyAddress: "",
      propertyType: undefined,
      salesPrice: undefined,
      loanType: undefined,
      transactionType: undefined,
      loanAmount: undefined,
      estimatedDown: undefined,
      earnestMoney: undefined,
      estRehab: undefined,
      arv: undefined,
      closingAt: undefined,
      fundingAt: undefined,
      titleCtc: false,
      lenderCtc: false,
    },
  });

  const [isPending, startTransition] = React.useTransition();

  const selectedState = form.watch("propertyState");
  const prefix = selectedState ? selectedState.toUpperCase() : "XX";

  const onSubmit = (data: CreateDealInput) => {
    startTransition(async () => {
      try {
        const result = await createDeal(data);
        // Only reached if the action returned a validation error
        if (result && !result.ok) {
          for (const [field, msgs] of Object.entries(result.errors)) {
            if (msgs && msgs[0]) {
              form.setError(field as keyof CreateDealFormInput, {
                message: msgs[0],
              });
            }
          }
          toast.error("Please fix the errors above.");
          requestAnimationFrame(() => {
            const firstError = document.querySelector(
              '[aria-invalid="true"]',
            ) as HTMLElement | null;
            firstError?.scrollIntoView({ block: "center", behavior: "smooth" });
            firstError?.focus();
          });
        }
      } catch (err) {
        // Next.js redirect() throws a digest-tagged error — re-throw so the
        // framework handles the navigation. All other errors bubble as a
        // server-error toast.
        const digest = (err as { digest?: string }).digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        const message =
          err instanceof Error ? err.message : "Unknown server error.";
        toast.error(`Couldn't create deal — ${message}. Try again.`);
      }
    });
  };

  const onInvalid = () => {
    toast.error("Please fix the errors above.");
    requestAnimationFrame(() => {
      const firstError = document.querySelector(
        '[aria-invalid="true"]',
      ) as HTMLElement | null;
      firstError?.scrollIntoView({ block: "center", behavior: "smooth" });
      firstError?.focus();
    });
  };

  /**
   * Reusable money-field onBlur handler. Parses the raw string via
   * parseMoney and writes the integer (or null) back to the form field,
   * then re-renders the input's display text as `$485,000`.
   */
  const makeMoneyBlurHandler =
    (fieldName: keyof CreateDealFormInput) =>
    (e: React.FocusEvent<HTMLInputElement>) => {
      const parsed = parseMoney(e.target.value);
      form.setValue(
        fieldName as keyof CreateDealFormInput,
        (parsed ?? undefined) as never,
        { shouldValidate: true },
      );
      e.target.value =
        parsed === null ? "" : `$${parsed.toLocaleString("en-US")}`;
    };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
        <Accordion defaultValue={["file-basics"]}>
          {/* Section 1 — File basics */}
          <AccordionItem value="file-basics">
            <AccordionTrigger>File basics</AccordionTrigger>
            <AccordionContent className="space-y-4 p-6 pt-2">
              {/* Track */}
              <FormField
                control={form.control}
                name="trackCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Track <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const t = props.tracks.find((tt) => tt.code === v);
                        if (t) {
                          form.setValue(
                            "priority",
                            t.defaultPriority as "HIGH" | "MEDIUM" | "LOW",
                          );
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a track" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.tracks.map((t) => (
                          <SelectItem key={t.code} value={t.code}>
                            <span className="flex items-center">
                              <span
                                className={`inline-block h-2 w-2 rounded-full mr-2 ${TRACK_DOT_CLASSES[t.code] ?? "bg-gray-400"}`}
                                aria-hidden="true"
                              />
                              {t.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Priority <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                        <SelectItem value="LOW">LOW</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>
                      A short name to recognize this file at a glance.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Property state */}
              <FormField
                control={form.control}
                name="propertyState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property state</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="(none — file # starts with XX)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used in the file number. Leave blank and the file number
                      will start with XX.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File # preview */}
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono">
                Will be assigned: ~{prefix}-{props.currentYear}-
                {props.fileNoEstimate}
              </div>

              {/* Main Contact name */}
              <FormField
                control={form.control}
                name="mainContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Contact name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Main Contact email */}
              <FormField
                control={form.control}
                name="mainContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Contact email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Section 2 — Property details */}
          <AccordionItem value="property-details">
            <AccordionTrigger>Property details</AccordionTrigger>
            <AccordionContent className="space-y-4 p-6 pt-2">
              <FormField
                control={form.control}
                name="propertyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Street, city, state"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property type</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPERTY_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales price</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onBlur={makeMoneyBlurHandler("salesPrice")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan type</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select loan type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOAN_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction type</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSACTION_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Section 3 — Financials & dates */}
          <AccordionItem value="financials">
            <AccordionTrigger>Financials &amp; dates</AccordionTrigger>
            <AccordionContent className="p-6 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <FormField
                  control={form.control}
                  name="loanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan amount</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onBlur={makeMoneyBlurHandler("loanAmount")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedDown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated down</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onBlur={makeMoneyBlurHandler("estimatedDown")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="earnestMoney"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Earnest money</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onBlur={makeMoneyBlurHandler("earnestMoney")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estRehab"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. rehab</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onBlur={makeMoneyBlurHandler("estRehab")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ARV</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onBlur={makeMoneyBlurHandler("arv")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="closingAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing date</FormLabel>
                      <DateFieldControl
                        value={field.value as Date | null | undefined}
                        onChange={(d) => field.onChange(d)}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundingAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding date</FormLabel>
                      <DateFieldControl
                        value={field.value as Date | null | undefined}
                        onChange={(d) => field.onChange(d)}
                      />
                      <FormDescription>
                        Leave blank if same as closing.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="titleCtc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(!!v)}
                          />
                        </FormControl>
                        <FormLabel className="mb-0">
                          Title Clear-to-Close
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lenderCtc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(!!v)}
                          />
                        </FormControl>
                        <FormLabel className="mb-0">
                          Lender Clear-to-Close
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Sticky footer */}
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-2 mt-4">
          <Button render={<Link href="/" />} variant="outline" type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create Deal"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * $-prefix money input — renders a leading "$" inside the input frame
 * and defers to parseMoney on blur (via the parent's makeMoneyBlurHandler).
 * Value is the integer cents stored in the form state; display re-renders
 * as `$485,000` once the blur handler normalizes it.
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
 * Popover + Calendar date picker. Null/undefined clears the field. Displays
 * `MMM d, yyyy` when set, `Pick a date` otherwise; a trailing `X` clears.
 */
function DateFieldControl(props: {
  value: Date | null | undefined;
  onChange: (v: Date | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const label = props.value
    ? props.value.toLocaleDateString("en-US", {
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
            selected={props.value ?? undefined}
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
