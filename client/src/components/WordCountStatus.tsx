type WordCountStatusProps = {
  text?: string | null;
  running?: boolean;
  count?: number;
  className?: string;
};

export function countWords(text: string | null | undefined): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

export async function readNdjsonStream(
  response: Response,
  onMessage: (message: any) => void,
): Promise<void> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("Streaming response was unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.type === "error") throw new Error(message.message || "Generation failed");
      onMessage(message);
    }
    if (done) break;
  }
  if (buffer.trim()) onMessage(JSON.parse(buffer));
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