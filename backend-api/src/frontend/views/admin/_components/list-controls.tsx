"use client";

import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = {
  value: string;
  label: string;
};

export function ListControls(props: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    label: string;
    value: string;
    options: Option[];
    onChange: (value: string) => void;
  }>;
  sort: string;
  sortOptions: Option[];
  onSortChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
      <div className="space-y-2">
        <Label>Pencarian</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={props.search}
            placeholder={props.searchPlaceholder ?? "Cari data..."}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {props.filters?.map((filter) => (
        <div key={filter.label} className="space-y-2">
          <Label>{filter.label}</Label>
          <select
            className="flex h-10 min-w-40 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="space-y-2">
        <Label>Sort</Label>
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            className="flex h-10 min-w-44 rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={props.sort}
            onChange={(event) => props.onSortChange(event.target.value)}
          >
            {props.sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
