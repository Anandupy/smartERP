"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getTokenStorage } from "@/core/auth";

import type {
  AdmissionBatchEvent,
  AdmissionOcrResult,
} from "../schemas/admission-ocr.schema";

/** One student found in a bulk PDF. */
export interface ScannedForm {
  index: number;
  /** 1-based page numbers in the uploaded PDF. */
  pages: number[];
  result?: AdmissionOcrResult;
  error?: string;
}

export interface BulkScanState {
  status: "idle" | "reading" | "done" | "error";
  fileName: string;
  page: number;
  totalPages: number;
  forms: ScannedForm[];
  skippedPages: number[];
  error: string | null;
}

const initialState: BulkScanState = {
  status: "idle",
  fileName: "",
  page: 0,
  totalPages: 0,
  forms: [],
  skippedPages: [],
  error: null,
};

/**
 * Uploads a PDF of many filled admission forms to
 * `/api/admissions/ocr/batch` and reads its newline-delimited JSON stream,
 * adding each student to `forms` the moment the server has read them.
 * Leaving the page (or starting another PDF) cancels the read.
 */
export function useBulkScan() {
  const [state, setState] = useState<BulkScanState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const apply = useCallback((event: AdmissionBatchEvent) => {
    setState((s) => {
      switch (event.type) {
        case "start":
          return { ...s, totalPages: event.totalPages };
        case "progress":
          return { ...s, page: event.page, totalPages: event.totalPages };
        case "form":
          return {
            ...s,
            forms: [
              ...s.forms,
              {
                index: event.index,
                pages: event.pages,
                result: event.result,
                error: event.error,
              },
            ],
          };
        case "done":
          return { ...s, status: "done", skippedPages: event.skippedPages };
        case "error":
          return { ...s, status: "error", error: event.error };
      }
    });
  }, []);

  const start = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...initialState, status: "reading", fileName: file.name });

      try {
        const body = new FormData();
        body.append("file", file);
        const token = getTokenStorage().getAccessToken();
        const res = await fetch("/api/admissions/ocr/batch", {
          method: "POST",
          body,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            payload?.error ?? `The PDF could not be read (HTTP ${res.status}).`,
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          let newline = buffered.indexOf("\n");
          while (newline >= 0) {
            const line = buffered.slice(0, newline).trim();
            buffered = buffered.slice(newline + 1);
            if (line) apply(JSON.parse(line) as AdmissionBatchEvent);
            newline = buffered.indexOf("\n");
          }
        }
        // A stream that ends without "done" was cut off.
        setState((s) =>
          s.status === "reading"
            ? {
                ...s,
                status: "error",
                error: "The connection closed before the whole PDF was read.",
              }
            : s,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((s) => ({
          ...s,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "The PDF could not be read.",
        }));
      }
    },
    [apply],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  return { ...state, start, reset };
}
