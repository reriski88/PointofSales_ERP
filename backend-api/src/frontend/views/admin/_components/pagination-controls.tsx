"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControls(props: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const currentPage = Math.min(Math.max(props.page, 1), pageCount);
  const start = props.total === 0 ? 0 : (currentPage - 1) * props.pageSize + 1;
  const end = Math.min(props.total, currentPage * props.pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/25 p-3 text-sm md:flex-row md:items-center md:justify-between">
      <p className="text-muted-foreground">
        Menampilkan {start}-{end} dari {props.total} data
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="flex h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={props.pageSize}
          onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
        >
          {[10, 20, 50, 100].map((value) => (
            <option key={value} value={value}>
              {value} / halaman
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => props.onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-20 text-center font-medium">
          {currentPage} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= pageCount}
          onClick={() => props.onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function pageItems<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  return items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
}
