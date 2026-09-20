// src/components/ui/select.tsx
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

// Radix disallows an empty-string item value (it's reserved internally to
// mean "no selection"), but "" is exactly what this app's filter UIs use
// for an "All X" option throughout. SelectItem translates its own value to
// this sentinel so those call sites can keep writing value="" like a
// native <select>.
//
// Root's incoming `value` is passed straight through, deliberately
// untouched — Radix's placeholder only appears when `value` is literally
// "" or undefined, so remapping it here would orphan every plain
// placeholder-only select (no "" item at all): the sentinel would match
// no registered item and render blank instead of the placeholder. Only
// onValueChange needs translating, to turn a selected "All X" item's
// sentinel back into the "" the caller's state expects. Selects that use
// "" to mean "an actual item is selected" (the All X / Unassinged
// pattern) must give their SelectValue an explicit placeholder equal to
// that item's label (the "All X" / "Unassigned" pattern) — see the
// callers of SelectItem value="".
const EMPTY_VALUE = "__select-empty__";

export function Select({
  onValueChange,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <SelectPrimitive.Root
      onValueChange={(next) => onValueChange?.(next === EMPTY_VALUE ? "" : next)}
      {...props}
    />
  );
}

export function SelectTrigger({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--destructive)] aria-[invalid=true]:focus:border-[var(--destructive)] aria-[invalid=true]:focus:ring-[var(--destructive)] data-[placeholder]:text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className = "",
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-xl shadow-black/30",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className = "",
  children,
  value,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      value={value === "" ? EMPTY_VALUE : value}
      className={cn(
        "relative flex w-full cursor-pointer items-center rounded-xl py-2 pr-3 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--muted)]",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
