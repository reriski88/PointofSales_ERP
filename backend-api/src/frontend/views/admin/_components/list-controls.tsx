"use client";

import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "./searchable-select";

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
    <div data-tour="list-controls" className="flex flex-col gap-2 rounded-lg border bg-card p-2 shadow-sm lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 lg:max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            value={props.search}
            placeholder={props.searchPlaceholder ?? "Cari data..."}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {props.filters?.map((filter) => (
        <div key={filter.label} className="min-w-36 lg:w-40">
          <SearchableSelect
            className="h-9"
            value={filter.value}
            onChange={filter.onChange}
            options={filter.options}
            placeholder={`Pilih ${filter.label.toLowerCase()}`}
            searchPlaceholder={`Cari ${filter.label.toLowerCase()}...`}
            emptyText={`${filter.label} tidak ditemukan.`}
          />
        </div>
      ))}

      <div className="lg:w-44">
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            className="flex h-9 w-full rounded-md border bg-background py-1 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
