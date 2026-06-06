"use client";

import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CodeInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  showRandomButton?: boolean;
}) {
  function randomize() {
    props.onChange(generateCode(props.prefix));
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="relative">
        <Input
          className="pr-11 uppercase"
          value={props.value}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
        />
        {props.showRandomButton ?? true ? (
          <Button
            type="button"
            variant="ghost"
            className="absolute right-1 top-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            disabled={props.disabled}
            title="Buat kode acak"
            aria-label={`Buat kode acak untuk ${props.label}`}
            onClick={randomize}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {props.helperText ? <p className="text-xs text-muted-foreground">{props.helperText}</p> : null}
    </div>
  );
}

export function generateCode(prefix = "KD") {
  const normalizedPrefix = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "KD";
  const datePart = compactDatePart();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${normalizedPrefix}-${datePart}-${randomPart}`;
}

function compactDatePart() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
