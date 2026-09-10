import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Pause, Play, Save, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ProgressiveOutputProps = {
  text: string;
  filename?: string;
  className?: string;
  /** Optional renderer for structured output (the renderer receives only the visible prefix). */
  render?: (visibleText: string) => React.ReactNode;
  onSave?: (visibleText: string) => void;
};

/**
 * Presents an already-completed endpoint response progressively. This is deliberately
 * presentation-only: it does not stream or pause provider generation.
 */
export default function ProgressiveOutput({
  text,
  filename = "output.txt",
  className = "",
  render,
  onSave,
}: ProgressiveOutputProps) {
  const { toast } = useToast();
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<"manual" | "saved" | "limit" | null>(null);
  const [saved, setSaved] = useState(false);
  const cursorRef = useRef(0);
  const wordsRevealed = useMemo(
    () => text.slice(0, cursor).trim().split(/\s+/).filter(Boolean).length,
    [text, cursor],
  );
  const complete = cursor >= text.length;
  const visibleText = text.slice(0, cursor);

  useEffect(() => {
    cursorRef.current = 0;
    setCursor(0);
    setPaused(false);
    setPauseReason(null);
    setSaved(false);
  }, [text]);

  useEffect(() => {
    if (paused || complete) return;
    const timer = window.setTimeout(() => {
      const current = cursorRef.current;
      const remaining = text.slice(current);
      // Keep chunks readable while preserving every character and whitespace.
      const match = remaining.match(/^(.*?\s+){1,18}/);
      const next = Math.min(text.length, current + (match?.[0].length || Math.min(120, remaining.length)));
      cursorRef.current = next;
      setCursor(next);
      const nextWords = text.slice(0, next).trim().split(/\s+/).filter(Boolean).length;
      if (nextWords > 0 && nextWords % 1000 < 18 && next < text.length) {
        setPaused(true);
        setPauseReason("limit");
      }
    }, 75);
    return () => window.clearTimeout(timer);
  }, [cursor, text, paused, complete]);

  useEffect(() => {
    if (pauseReason !== "limit") return;
    const timer = window.setTimeout(() => {
      setPaused(false);
      setPauseReason(null);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [pauseReason]);

  const stop = () => {
    setPaused(true);
    setPauseReason("manual");
  };
  const save = () => {
    setPaused(true);
    setSaved(true);
    setPauseReason("saved");
    onSave?.(visibleText);
  };
  const resume = () => {
    setPaused(false);
    setPauseReason(null);
    setSaved(false);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(visibleText);
    toast({ title: "Copied", description: "The visible output prefix was copied." });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([visibleText], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span aria-live="polite" className="font-medium">
          {complete ? "Complete" : paused ? (pauseReason === "limit" ? "Paused after 1,000-word interval" : saved ? "Saved and paused" : "Stopped") : "Revealing"}
        </span>
        <span>{wordsRevealed.toLocaleString()} / {text.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words visible</span>
        {!complete && <span>(presentation of a completed response)</span>}
        <div className="ml-auto flex flex-wrap gap-1">
          {paused && !complete ? (
            <Button size="sm" variant="outline" onClick={resume}><Play className="mr-1 h-3 w-3" />Resume</Button>
          ) : !complete ? (
            <Button size="sm" variant="outline" onClick={stop}><Square className="mr-1 h-3 w-3" />Stop</Button>
          ) : null}
          {!complete && <Button size="sm" variant="outline" onClick={save}><Save className="mr-1 h-3 w-3" />Save</Button>}
          <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-3 w-3" />Copy</Button>
          <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-3 w-3" />Download</Button>
          {saved && <Check className="mt-2 h-4 w-4 text-emerald-600" aria-label="Saved" />}
        </div>
      </div>
      {pauseReason === "limit" && (
        <div className="mb-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <Pause className="h-3 w-3" /> Automatically paused for 10 seconds after 1,000 revealed words. Resume to continue.
        </div>
      )}
      {render ? render(visibleText) : (
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">{visibleText}</pre>
      )}
    </div>
  );
}