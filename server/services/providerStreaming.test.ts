import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  AdaptiveWritingPacer,
  createThrottledCheckpoint,
  streamAnthropicMessages,
  streamOpenAICompatible,
} from "./providerStreaming";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

test("OpenAI-compatible responses are consumed as incremental SSE deltas", async () => {
  const requests: RequestInit[] = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(init || {});
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "first " } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "second" } }] })}\n\n`,
      "data: [DONE]\n\n",
    ];
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(chunks[0]));
        setTimeout(() => controller.enqueue(new TextEncoder().encode(chunks[1])), 0);
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(chunks[2]));
          controller.close();
        }, 0);
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };

  const partials: string[] = [];
  const result = await streamOpenAICompatible(
    "https://provider.invalid",
    "test-key",
    "test-model",
    "system",
    "prompt",
    100,
    0,
    { onText: partial => partials.push(partial) },
  );

  assert.equal(result, "first second");
  assert.deepEqual(partials, ["first ", "first second"]);
  assert.equal(JSON.parse(String(requests[0].body)).stream, true);
});

test("Anthropic text deltas and adaptive pauses share the same policy", async () => {
  const events = [
    { type: "content_block_delta", delta: { type: "text_delta", text: "one " } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "two" } },
  ];
  const client = {
    messages: {
      stream: () => (async function* () {
        for (const event of events) yield event;
      })(),
    },
  };
  const partials: string[] = [];
  const result = await streamAnthropicMessages(
    client,
    "claude-test",
    "system",
    "prompt",
    100,
    0,
    { onText: partial => partials.push(partial) },
  );
  assert.equal(result, "one two");
  assert.deepEqual(partials, ["one ", "one two"]);

  const pauses: number[] = [];
  const pacer = new AdaptiveWritingPacer({
    sleep: async milliseconds => pauses.push(milliseconds),
  });
  await pacer.waitIfDue(1_050);
  assert.deepEqual(pauses, [2_000]);
  await pacer.waitIfDue(10_050);
  assert.equal(pauses.at(-1), 6_000);
  assert.equal(pauses.length, 10);
});

test("partial checkpoints are throttled and flush forces the final text", async () => {
  const persisted: string[] = [];
  const checkpoint = createThrottledCheckpoint(async value => {
    persisted.push(value);
    return false;
  }, { intervalMs: 60_000, meaningfulWordIncrement: 40 });

  for (let index = 1; index <= 20; index++) {
    await checkpoint.update(Array.from({ length: index }, () => "word").join(" "));
  }
  assert.equal(persisted.length, 1, "token-sized updates should not each write to the database");
  await checkpoint.flush();
  assert.equal(persisted.length, 2, "stream completion must persist the latest partial");
  assert.equal(persisted[1].split(/\s+/).length, 20);
});