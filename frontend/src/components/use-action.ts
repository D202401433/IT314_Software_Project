"use client";

import { useState } from "react";

import { ApiError, errorMessage } from "@/lib/api";

import { useToast } from "./ui";

/**
 * Runs a mutation and reports the outcome. Success is announced only after the
 * backend has confirmed it; failures show the server's message.
 */
export function useAction(onConflict?: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(key);
    try {
      const result = await fn();
      if (success) toast("success", success);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.code === "VERSION_CONFLICT") {
        toast("error", "Someone else changed this record. The latest version has been loaded; review it and try again.");
        onConflict?.();
      } else {
        toast("error", errorMessage(e));
      }
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  return { run, busy };
}
