"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RealtimeEvent, RealtimeTopic } from "@/lib/realtime";

export type { RealtimeEvent, RealtimeTopic };

export function useRealtimeEvents(input: {
  topics: RealtimeTopic[];
  onEvent: (event: RealtimeEvent) => void;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const onEventRef = useRef(input.onEvent);
  const timerRef = useRef<number | undefined>(undefined);
  const topicsKey = useMemo(
    () => Array.from(new Set(input.topics)).sort().join("|"),
    [input.topics],
  );

  useEffect(() => {
    onEventRef.current = input.onEvent;
  }, [input.onEvent]);

  useEffect(() => {
    if (input.enabled === false || !topicsKey) return;

    const source = new EventSource("/api/realtime");
    const topics = new Set(topicsKey.split("|").filter(Boolean));
    const debounceMs = input.debounceMs ?? 500;

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RealtimeEvent;
        if (!event.topics?.some((topic) => topics.has(topic))) return;

        if (timerRef.current !== undefined) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          onEventRef.current(event);
          timerRef.current = undefined;
        }, debounceMs);
      } catch {
        // Ignore malformed SSE payloads and keep the connection alive.
      }
    };

    return () => {
      source.close();
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [input.debounceMs, input.enabled, topicsKey]);
}
