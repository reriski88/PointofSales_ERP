"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CollapsibleSection(props: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  collapsible?: boolean;
}) {
  const collapsible = props.collapsible ?? true;
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? true);
  const expanded = collapsible ? isOpen : true;

  return (
    <Card className={["h-fit overflow-hidden", props.className].filter(Boolean).join(" ")}>
      <CardHeader className="space-y-0 p-4 sm:p-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              if (collapsible) setIsOpen((current) => !current);
            }}
          >
            <CardTitle className="leading-snug">{props.title}</CardTitle>
            {props.description ? <CardDescription className="mt-1 leading-5">{props.description}</CardDescription> : null}
          </button>
          <div className="flex shrink-0 items-center justify-end gap-2">
            {props.actions}
            {collapsible ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted"
                onClick={() => setIsOpen((current) => !current)}
                aria-label={isOpen ? "Collapse section" : "Expand section"}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {props.isLoading ? <SectionLoading text={props.loadingText ?? "Memuat data section..."} /> : props.children}
        </CardContent>
      ) : null}
    </Card>
  );
}

function SectionLoading(props: { text: string }) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/25 p-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {props.text}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <span className="h-12 animate-pulse rounded-md bg-muted" />
        <span className="h-12 animate-pulse rounded-md bg-muted" />
        <span className="h-12 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
