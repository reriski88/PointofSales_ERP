"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

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

      {open ? (
        <div
          className={[
            "absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-md border bg-card text-card-foreground shadow-lg",
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
          <div id={`${id}-listbox`} role="listbox" className="max-h-64 overflow-y-auto py-1">
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
      ) : null}
    </div>
  );
}
