"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
};

export function SearchableSelect(props: {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearValue?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({
    left: 0,
    top: 0,
    width: 0,
    listMaxHeight: 256,
  });
  const selected = props.options.find((option) => option.value === props.value);
  const clearValue = props.clearValue ?? "";
  const canClear = props.allowClear && props.value !== clearValue && !props.disabled;

  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return props.options;
    return props.options.filter((option) =>
      [option.label, option.description ?? "", option.keywords ?? "", option.value]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [props.options, query]);

  const updateDropdownPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredListHeight = 256;
    const searchHeight = 41;
    const minimumComfortHeight = 160;
    const belowSpace = window.innerHeight - rect.bottom - viewportPadding;
    const aboveSpace = rect.top - viewportPadding;
    const openAbove = belowSpace < minimumComfortHeight && aboveSpace > belowSpace;
    const availableSpace = Math.max(minimumComfortHeight, openAbove ? aboveSpace : belowSpace);
    const desiredListHeight = filteredOptions.length
      ? Math.min(preferredListHeight, filteredOptions.length * 38 + 8)
      : 56;
    const listMaxHeight = Math.max(80, Math.min(preferredListHeight, availableSpace - searchHeight - 4));
    const actualDropdownHeight = searchHeight + Math.min(desiredListHeight, listMaxHeight);
    const top = openAbove ? rect.top - actualDropdownHeight - 4 : rect.bottom + 4;
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding),
    );

    setDropdownStyle({
      left,
      top: Math.max(viewportPadding, top),
      width: rect.width,
      listMaxHeight,
    });
  }, [filteredOptions.length]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      updateDropdownPosition();
      searchRef.current?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onReposition = () => updateDropdownPosition();
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateDropdownPosition]);

  function selectValue(value: string) {
    props.onChange(value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={["relative", props.className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={[
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          props.triggerClassName,
        ].filter(Boolean).join(" ")}
        aria-label={props.ariaLabel ?? props.placeholder}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={props.disabled}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={selected ? "min-w-0 truncate" : "min-w-0 truncate text-muted-foreground"}>
          {selected?.label ?? props.placeholder ?? "Pilih"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {canClear ? (
            <span
              role="button"
              tabIndex={-1}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Bersihkan pilihan"
              onClick={(event) => {
                event.stopPropagation();
                selectValue(clearValue);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            left: dropdownStyle.left,
            top: dropdownStyle.top,
            width: dropdownStyle.width,
          }}
          className={[
            "fixed z-[10020] overflow-hidden rounded-md border bg-card text-card-foreground shadow-lg",
            props.dropdownClassName,
          ].filter(Boolean).join(" ")}
        >
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              className="h-10 w-full bg-transparent px-9 text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              placeholder={props.searchPlaceholder ?? "Cari..."}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                }
                if (event.key === "Enter") {
                  const first = filteredOptions.find((option) => !option.disabled);
                  if (first) selectValue(first.value);
                }
              }}
            />
          </div>
          <div
            id={`${id}-listbox`}
            role="listbox"
            className="overflow-y-auto py-1"
            style={{ maxHeight: dropdownStyle.listMaxHeight }}
          >
            {filteredOptions.map((option) => {
              const active = option.value === props.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  className={[
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                    active ? "bg-muted" : "",
                  ].join(" ")}
                  onClick={() => selectValue(option.value)}
                >
                  <Check className={["mt-0.5 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0"].join(" ")} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
            {!filteredOptions.length ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {props.emptyText ?? "Data tidak ditemukan."}
              </p>
            ) : null}
          </div>
        </div>
      , document.body) : null}
    </div>
  );
}
