type WordCountStatusProps = {
  text?: string | null;
  running?: boolean;
  count?: number;
  className?: string;
};

export { readNdjsonStream } from "@/lib/streaming";

export function countWords(text: string | null | undefined): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

export default function WordCountStatus({
  text,
  running = false,
  count,
  className = "",
}: WordCountStatusProps) {
  const wordCount = count ?? countWords(text);
  return (
    <div
      aria-live="polite"
      className={`text-xs font-semibold text-gray-600 dark:text-gray-300 ${className}`}
      data-testid={running ? "running-word-count" : "final-word-count"}
    >
      {running ? "Running word count" : "Final word count"}: {wordCount.toLocaleString()}
    </div>
  );
}