/**
 * Provider transport and long-form pacing live here so every writing path uses
 * the same incremental response handling and pause policy.
 */

export type ProviderTextCallback = (partialText: string) => void | Promise<void>;

export interface AdaptivePacerOptions {
  shortPauseMs?: number;
  longPauseMs?: number;
  longPauseEveryWords?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * A pacer is deliberately stateful: when a job resumes, initialize() can move
 * past already-written words instead of replaying old pauses.
 */
export class AdaptiveWritingPacer {
  private nextPauseAt = 1000;
  private initialized = false;
  private readonly shortPauseMs: number;
  private readonly longPauseMs: number;
  private readonly longPauseEveryWords: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: AdaptivePacerOptions = {}) {
    this.shortPauseMs = options.shortPauseMs ?? 2_000;
    this.longPauseMs = options.longPauseMs ?? 6_000;
    this.longPauseEveryWords = options.longPauseEveryWords ?? 10_000;
    this.sleep = options.sleep ?? defaultSleep;
  }

  initialize(wordCount: number): void {
    if (this.initialized) return;
    this.nextPauseAt = (Math.floor(Math.max(0, wordCount) / 1_000) + 1) * 1_000;
    this.initialized = true;
  }

  async waitIfDue(wordCount: number): Promise<void> {
    this.initialize(0);
    while (wordCount >= this.nextPauseAt) {
      const isLongBreak = this.nextPauseAt % this.longPauseEveryWords === 0;
      await this.sleep(isLongBreak ? this.longPauseMs : this.shortPauseMs);
      this.nextPauseAt += 1_000;
    }
  }
}

export interface ProviderStreamOptions {
  onText?: ProviderTextCallback;
  pacer?: AdaptiveWritingPacer;
  wordCountOffset?: number;
}

export interface ThrottledCheckpoint<T> {
  update(value: T): Promise<boolean>;
  flush(): Promise<boolean>;
}

export function createThrottledCheckpoint<T>(
  persist: (value: T) => Promise<boolean>,
  options: {
    intervalMs?: number;
    meaningfulWordIncrement?: number;
    measureWords?: (value: T) => number;
  } = {},
): ThrottledCheckpoint<T> {
  const intervalMs = options.intervalMs ?? 750;
  const meaningfulWordIncrement = options.meaningfulWordIncrement ?? 40;
  const measureWords = options.measureWords || ((value: T) =>
    typeof value === "string" ? countWords(value) : 0);
  let latest: T | undefined;
  let lastPersisted: T | undefined;
  let lastPersistedAt = 0;
  let lastPersistedWords = 0;

  const persistLatest = async (): Promise<boolean> => {
    if (latest === undefined) return false;
    const value = latest;
    const stopped = await persist(value);
    lastPersisted = value;
    lastPersistedAt = Date.now();
    lastPersistedWords = measureWords(value);
    return stopped;
  };

  return {
    async update(value: T): Promise<boolean> {
      latest = value;
      const words = measureWords(value);
      const meaningful = lastPersisted === undefined
        || Date.now() - lastPersistedAt >= intervalMs
        || words - lastPersistedWords >= meaningfulWordIncrement;
      return meaningful ? persistLatest() : false;
    },
    async flush(): Promise<boolean> {
      if (latest === undefined || latest === lastPersisted) return false;
      return persistLatest();
    },
  };
}

async function emit(
  delta: string,
  accumulated: string,
  options: ProviderStreamOptions,
): Promise<void> {
  const next = accumulated + delta;
  if (options.onText) await options.onText(next);
  if (options.pacer) {
    await options.pacer.waitIfDue((options.wordCountOffset || 0) + countWords(next));
  }
}

async function errorBody(response: Response): Promise<string> {
  try {
    const body = await response.text();
    if (!body) return "";
    try {
      const parsed = JSON.parse(body);
      return parsed?.error?.message || parsed?.message || body;
    } catch {
      return body;
    }
  } catch {
    return "";
  }
}

async function readBodyTextIncrementally(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    text += decoder.decode(result.value || new Uint8Array(), { stream: !done });
  }
  return text;
}

function textFromOpenAIChoice(choice: any): string {
  const value = choice?.delta?.content ?? choice?.message?.content ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(item => typeof item === "string" ? item : item?.text || "").join("");
  }
  return "";
}

/**
 * Consume OpenAI-compatible SSE bodies incrementally. A JSON response fallback
 * is retained for compatible gateways and local provider test doubles that do
 * not implement stream=true.
 */
export async function streamOpenAICompatible(
  url: string,
  key: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  options: ProviderStreamOptions = {},
): Promise<string> {
  const streamOptions: ProviderStreamOptions = {
    ...options,
    pacer: options.pacer || new AdaptiveWritingPacer(),
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });
  if (!response.ok) {
    throw new Error((await errorBody(response)) || `Provider returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!response.body || contentType.includes("application/json")) {
    const body = await readBodyTextIncrementally(response);
    const data = body ? JSON.parse(body) as any : {};
    const text = data.choices?.[0]?.message?.content || "";
    await emit(text, "", streamOptions);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    buffer += decoder.decode(result.value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = textFromOpenAIChoice(parsed.choices?.[0]);
      if (delta) {
        await emit(delta, accumulated, streamOptions);
        accumulated += delta;
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim().startsWith("data:")) {
    const payload = buffer.replace(/^data:\s*/, "").trim();
    if (payload && payload !== "[DONE]") {
      try {
        const delta = textFromOpenAIChoice(JSON.parse(payload).choices?.[0]);
        if (delta) {
          await emit(delta, accumulated, streamOptions);
          accumulated += delta;
        }
      } catch {
        // An incomplete trailing SSE frame is harmless after the stream closes.
      }
    }
  }
  return accumulated;
}

/** Consume Anthropic's content_block_delta events as they arrive. */
export async function streamAnthropicMessages(
  client: any,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  options: ProviderStreamOptions = {},
): Promise<string> {
  const streamOptions: ProviderStreamOptions = {
    ...options,
    pacer: options.pacer || new AdaptiveWritingPacer(),
  };
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  let accumulated = "";
  for await (const event of stream) {
    if (event?.type !== "content_block_delta" || event.delta?.type !== "text_delta") continue;
    const delta = event.delta.text || "";
    if (!delta) continue;
    await emit(delta, accumulated, streamOptions);
    accumulated += delta;
  }
  return accumulated;
}