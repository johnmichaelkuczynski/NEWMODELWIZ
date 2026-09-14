import React, { useEffect, useState } from "react";
import { Check, Copy, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import WordCountStatus from "@/components/WordCountStatus";

type ProgressiveOutputProps = {
  text: string;
  filename?: string;
  className?: string;
  /** Optional renderer for structured output. */
  render?: (visibleText: string) => React.ReactNode;
  onSave?: (visibleText: string) => void;
};

/**
 * Presents a completed response.  Provider streams are rendered by their
 * consumers as data arrives; this component must not add a fake post-hoc
 * typewriter delay after the response has completed.
 */
export default function ProgressiveOutput({
  text,
  filename = "output.txt",
  className = "",
  render,
  onSave,
}: ProgressiveOutputProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const visibleText = text;
  useEffect(() => setSaved(false), [text]);
  const save = () => {
    setSaved(true);
    onSave?.(visibleText);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(visibleText);
    toast({ title: "Copied", description: "The complete output was copied." });
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
          Complete
        </span>
        <WordCountStatus
          text={text}
          className="text-inherit"
        />
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={save}><Save className="mr-1 h-3 w-3" />Save</Button>
          <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-3 w-3" />Copy</Button>
          <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-3 w-3" />Download</Button>
          {saved && <Check className="mt-2 h-4 w-4 text-emerald-600" aria-label="Saved" />}
        </div>
      </div>
      {render ? render(visibleText) : (
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">{visibleText}</pre>
      )}
    </div>
  );
}