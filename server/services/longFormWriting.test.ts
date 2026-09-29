import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { users, writingJobs, writingJobSections } from "@shared/schema";
import {
  createWritingJob,
  getWritingJob,
  processWritingJob,
} from "./longFormWriting";

const originalFetch = globalThis.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const createdJobIds: number[] = [];
let testUserId: number;

function prose(label: string, words = 720): string {
  const sentence = `${label} makes a definite claim through a concrete example and exact reasoning.`;
  return Array.from({ length: Math.ceil(words / sentence.split(/\s+/).length) }, () => sentence)
    .join(" ")
    .split(/\s+/)
    .slice(0, words)
    .join(" ") + ".";
}

function providerResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function removeJob(jobId: number): Promise<void> {
  await db.delete(writingJobSections).where(eq(writingJobSections.jobId, jobId));
  await db.delete(writingJobs).where(eq(writingJobs.id, jobId));
}

before(() => {
  process.env.OPENAI_API_KEY = "test-key";
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  for (const jobId of createdJobIds) await removeJob(jobId);
  if (testUserId) await db.delete(users).where(eq(users.id, testUserId));
  await pool.end();
});

test("explicit chapter counts remain authoritative over length heuristics", async () => {
  if (!testUserId) {
    const [testUser] = await db.insert(users).values({
      username: `long-form-regression-${process.pid}-${Date.now()}`,
      password: "not-used",
    }).returning();
    testUserId = testUser.id;
  }
  const instructions = [
    "Write a 3-chapter work of approximately 2100 words.",
    "Chapter 1: State the first argument.",
    "Chapter 2: Develop the second argument.",
    "Chapter 3: Give the final argument.",
  ].join("\n");
  const job = await createWritingJob({
    userId: testUserId,
    instructions,
    provider: "zhi1",
    requestedWordCount: 2100,
  });
  createdJobIds.push(job.id);

  assert.equal(
    job.totalSections,
    3,
    "the explicit chapter count must override the two-section length heuristic",
  );
});

test("persistent audit failures cannot erase a completed document", async () => {
  const job = await createWritingJob({
    instructions: "Write approximately 700 words stating and defending one concrete argument.",
    provider: "zhi1",
    requestedWordCount: 700,
  });
  createdJobIds.push(job.id);

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const system = String(body.messages[0].content);
    const prompt = String(body.messages[1].content);
    if (system.startsWith("Act as a strict compliance auditor")) {
      return providerResponse("FAIL: Deliberate persistent test finding.");
    }
    return providerResponse(prose("Persistent audit evidence"));
  };

  await processWritingJob(job.id);
  const completed = await getWritingJob(job.id);

  assert.equal(completed.status, "complete");
  assert.ok(completed.output?.trim(), "completed output must remain non-empty");
  assert.equal(completed.error, null);
  assert.equal(completed.completedSections, 1);
});

test("an exception after a section draft exists delivers the in-progress text", async () => {
  const job = await createWritingJob({
    instructions: "Write approximately 700 words about a concrete test case.",
    provider: "zhi1",
    requestedWordCount: 700,
  });
  createdJobIds.push(job.id);
  const draft = prose("Saved draft evidence", 950);

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const system = String(body.messages[0].content);
    if (system.startsWith("Act as a strict compliance auditor")) {
      throw new Error("simulated downstream audit failure");
    }
    return providerResponse(draft);
  };

  await processWritingJob(job.id);
  const completed = await getWritingJob(job.id);

  assert.equal(completed.status, "complete");
  assert.ok(completed.output?.includes("Saved draft evidence"));
  assert.ok(completed.output?.trim(), "the best available draft must be delivered");
  assert.equal(completed.error, null);
  assert.equal(completed.completedSections, 1);
});

test("planning labels and future-section headings are rewritten before delivery", async () => {
  const job = await createWritingJob({
    instructions: "Write at least 700 words as a single unnumbered essay.",
    provider: "zhi1",
    requestedWordCount: 700,
  });
  createdJobIds.push(job.id);
  let repairCount = 0;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const system = String(body.messages[0].content);
    const prompt = String(body.messages[1].content);
    if (system.startsWith("Act as a strict compliance auditor")) return providerResponse("PASS");
    if (system.includes("manuscript editor")) {
      repairCount++;
      return providerResponse(`Section 1:\n\n${prose("Finished argument", 730)}`);
    }
    if (prompt.includes("Write the first approximately")) {
      return providerResponse(
        "Section 1:\n\nParagraph 1 (Derive Step 1): Establish the argument.\n\nSection 2: Premature section.\n\nSection 2 must now discuss its own topic.",
      );
    }
    return providerResponse(prose("Continuation evidence", 720));
  };

  await processWritingJob(job.id);
  const completed = await getWritingJob(job.id);

  assert.equal(completed.status, "complete");
  assert.ok(repairCount > 0, "the leaked plan must be rewritten, not silently stripped");
  assert.doesNotMatch(completed.output || "", /Paragraph \d|Derive Step|Section \d/i);
  assert.match(completed.output || "", /reasoning\.\n\nFinished argument/);
  assert.ok((completed.output || "").trim().split(/\s+/).length >= 700);
});

test("unrepairable planning text remains in a checkpoint but is not displayed as output", async () => {
  const job = await createWritingJob({
    instructions: "Write 700 words of unnumbered prose.",
    provider: "zhi1",
    requestedWordCount: 700,
  });
  createdJobIds.push(job.id);
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const system = String(body.messages[0].content);
    if (system.startsWith("Act as a strict compliance auditor")) return providerResponse("PASS");
    return providerResponse(`Section 1:\n\nParagraph 4 (Derive Step 4): ${prose("Unusable draft", 730)}`);
  };

  await processWritingJob(job.id);
  const result = await getWritingJob(job.id);
  const saved = await db.select().from(writingJobSections).where(eq(writingJobSections.jobId, job.id));
  assert.equal(result.status, "failed");
  assert.equal(result.output, null);
  assert.ok(saved.some(section => section.content.includes("Paragraph 4")), "the original remains available to resume");
});