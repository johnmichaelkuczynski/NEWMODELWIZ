/**
 * Small browser-side readers for the streaming response formats used by the
 * AI endpoints.  Keeping the reader here prevents individual feature panels
 * from accidentally buffering a response with response.json()/response.text().
 */

export type StreamMessage = {
  type?: string;
  [key: string]: any;
};

function messageForStreamError(message: StreamMessage | any, fallback = "Generation failed"): string {
  return message?.message
    || message?.result?.message
    || message?.result?.error
    || message?.payload?.message
    || message?.error?.message
    || (typeof message?.error === "string" ? message.error : undefined)
    || fallback;
}

function streamError(message: StreamMessage | any, fallback = "Generation failed"): Error {
  const error = new Error(messageForStreamError(message, fallback));
  // Keep server-provided structured failure data available to consumers that
  // need to render more useful recovery details than the short message.
  if (message && typeof message === "object") (error as any).payload = message;
  if (message?.result !== undefined) (error as any).result = message.result;
  if (message?.payload !== undefined) (error as any).payload = message.payload;
  return error;
}

async function assertReadable(response: Response): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  if (!response.ok) {
    const message = await response.text();
    if (message) {
      try {
        const payload = JSON.parse(message);
        throw streamError(payload, message);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(message);
        }
        throw error;
      }
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("Streaming response was unavailable");
  return response.body.getReader();
}

export async function readNdjsonResult<T = any>(
  response: Response,
  onChunk?: (text: string, message: StreamMessage) => void,
): Promise<T | null> {
  let result: T | null = null;
  await readNdjsonStream(response, message => {
    if (message.type === "chunk") {
      onChunk?.(typeof message.text === "string" ? message.text : "", message);
    } else if (message.type === "done") {
      result = (message.result ?? message) as T;
    }
  });
  return result;
}

/**
 * Read a newline-delimited JSON response.  The final line is parsed even when
 * the server closes the connection without a trailing newline.
 */
export async function readNdjsonStream(
  response: Response,
  onMessage: (message: StreamMessage) => void,
): Promise<void> {
  const reader = await assertReadable(response);
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as StreamMessage;
      if (message.type === "error") {
        throw streamError(message);
      }
      onMessage(message);
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const message = JSON.parse(buffer) as StreamMessage;
    if (message.type === "error") throw streamError(message);
    onMessage(message);
  }
}

/**
 * Read a plain text provider stream.  TextDecoder is flushed on EOF so a
 * partial UTF-8 sequence and the last unterminated chunk are never lost.
 */
export async function readTextStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const reader = await assertReadable(response);
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
    if (chunk) onChunk(chunk);
    if (done) break;
  }
}