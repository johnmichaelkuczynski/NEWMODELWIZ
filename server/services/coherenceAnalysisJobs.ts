import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { writingJobs, writingJobSections } from "@shared/schema";

const activeJobs = new Set<number>();
const pause = () => new Promise(resolve => setTimeout(resolve, 2000));

type Checkpoint = { map?: string; delta?: string };

function splitText(text: string, targetWords = 700): string[] {
  const paragraphs = text.split(/\n+/).map(value => value.trim()).filter(Boolean);
  const sections: string[] = [];
  let current: string[] = [];
  let wordCount = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    for (let start = 0; start < words.length; start += targetWords) {
      const part = words.slice(start, start + targetWords);
      if (wordCount + part.length > targetWords && current.length) {
        sections.push(current.join("\n\n"));
        current = [];
        wordCount = 0;
      }
      current.push(part.join(" "));
      wordCount += part.length;
    }
  }
  if (current.length) sections.push(current.join("\n\n"));
  return sections;
}

function parseCheckpoint(value: string | null): Checkpoint {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

async function callClaude(system: string, prompt: string, maxTokens: number): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    temperature: 0,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content[0]?.type === "text" ? message.content[0].text : "";
}

export async function createCoherenceAnalysisJob(text: string, coherenceType: string, userId?: number) {
  const chunks = splitText(text);
  const [job] = await db.insert(writingJobs).values({
    userId,
    instructions: text,
    provider: "coherence-anthropic",
    requestedWordCount: text.trim().split(/\s+/).length,
    usesLargeScaleCoherence: true,
    status: "pending",
    auditGuidance: coherenceType,
    completedSections: 0,
    totalSections: chunks.length,
  }).returning();
  await db.insert(writingJobSections).values(chunks.map((content, sectionIndex) => ({
    jobId: job.id,
    sectionIndex,
    targetWordCount: content.split(/\s+/).length,
    content,
    continuitySummary: JSON.stringify({}),
  })));
  void runCoherenceAnalysisJob(job.id);
  return job;
}

export async function getCoherenceAnalysisJob(jobId: number) {
  const [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
  if (!job || job.provider !== "coherence-anthropic") return null;
  const sections = await db.select().from(writingJobSections)
    .where(eq(writingJobSections.jobId, jobId))
    .orderBy(asc(writingJobSections.sectionIndex));
  const checkpoints = sections.map(section => parseCheckpoint(section.continuitySummary));
  return {
    id: job.id,
    userId: job.userId,
    status: job.status,
    stage: job.status,
    wordCount: job.requestedWordCount,
    totalChunks: job.totalSections,
    completedMaps: checkpoints.filter(item => item.map).length,
    completedChecks: checkpoints.filter(item => item.delta).length,
    skeletonReady: Boolean(job.blueprint),
    analysis: job.output,
    score: Number(job.auditReport || 0),
    assessment: job.error || null,
    error: job.status === "failed" ? job.error : null,
  };
}

export async function runCoherenceAnalysisJob(jobId: number) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);
  try {
    let [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
    if (!job || job.provider !== "coherence-anthropic" || job.status === "complete") return;
    let sections = await db.select().from(writingJobSections)
      .where(eq(writingJobSections.jobId, jobId))
      .orderBy(asc(writingJobSections.sectionIndex));

    await db.update(writingJobs).set({ status: "mapping", error: null, updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
    for (const section of sections) {
      const checkpoint = parseCheckpoint(section.continuitySummary);
      if (checkpoint.map) continue;
      checkpoint.map = await callClaude(
        "Extract structural evidence from one part of a larger document. Do not judge it as a standalone essay. Plain text only.",
        `Map chunk ${section.sectionIndex + 1} of ${sections.length}. Record claims, definitions, ASSERTS/REJECTS/ASSUMES, dependencies, references, local conflicts, and expected handoff. Mark claims as newly established or merely repeated. Keep under 450 words.\n\nCHUNK:\n${section.content}`,
        900,
      );
      await db.update(writingJobSections).set({ continuitySummary: JSON.stringify(checkpoint) }).where(eq(writingJobSections.id, section.id));
      await db.update(writingJobs).set({ completedSections: section.sectionIndex + 1, updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
      await pause();
    }

    sections = await db.select().from(writingJobSections).where(eq(writingJobSections.jobId, jobId)).orderBy(asc(writingJobSections.sectionIndex));
    const maps = sections.map(section => parseCheckpoint(section.continuitySummary).map || "");
    [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
    let skeleton = job.blueprint;
    if (!skeleton) {
      await db.update(writingJobs).set({ status: "skeleton", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
      skeleton = await callClaude(
        "Fuse structural maps into one immutable Tractatus-style argument skeleton. Preserve conflicts and negative commitments. Plain text only.",
        `Build: controlling thesis, ordered argument tree, fixed definitions, ASSERTS, REJECTS, ASSUMES, dependency edges, terminology drift, repeated claims, contradictions, unresolved obligations, and expected conclusion.\n\n${maps.map((map, index) => `MAP ${index + 1}:\n${map}`).join("\n\n")}`,
        3000,
      );
      await db.update(writingJobs).set({ blueprint: skeleton, status: "cross-check", completedSections: 0, updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
      await pause();
    }

    for (const section of sections) {
      const checkpoint = parseCheckpoint(section.continuitySummary);
      if (checkpoint.delta) continue;
      const priorDeltas = sections
        .filter(item => item.sectionIndex < section.sectionIndex)
        .map(item => parseCheckpoint(item.continuitySummary).delta)
        .filter(Boolean)
        .join("\n\n");
      checkpoint.delta = await callClaude(
        "Evaluate one chunk only as a component of the complete document. Track cross-chunk coherence, not standalone writing quality. Plain text only.",
        `Evaluate chunk ${section.sectionIndex + 1} of ${sections.length} against the global skeleton and all prior findings. Record role performed, dependencies honored/broken, contradictions, terminology drift, semantic repetition, false handoffs, and new global findings.\n\nGLOBAL SKELETON:\n${skeleton}\n\nPRIOR CUMULATIVE FINDINGS:\n${priorDeltas || "None."}\n\nCURRENT CHUNK:\n${section.content}`,
        1300,
      );
      await db.update(writingJobSections).set({ continuitySummary: JSON.stringify(checkpoint) }).where(eq(writingJobSections.id, section.id));
      await db.update(writingJobs).set({ status: "cross-check", completedSections: section.sectionIndex + 1, updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
      await pause();
    }

    sections = await db.select().from(writingJobSections).where(eq(writingJobSections.jobId, jobId)).orderBy(asc(writingJobSections.sectionIndex));
    const deltas = sections.map(section => parseCheckpoint(section.continuitySummary).delta || "");
    await db.update(writingJobs).set({ status: "synthesis", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
    const analysis = await callClaude(
      "Produce one rigorous whole-document coherence report. Do not concatenate local reports. Judge the complete argument as one object. Plain text only.",
      `Begin exactly with GLOBAL COHERENCE SCORE: X/10 and OVERALL ASSESSMENT: one decisive sentence. Then provide global argument reconstruction, cross-chunk contradictions, terminology drift, semantic repetition, broken dependencies/handoffs, missing steps, strongest features, and prioritized repairs. Cite chunk numbers and distinguish recurrence from redundant re-argument.\n\nGLOBAL SKELETON:\n${skeleton}\n\nCHUNK DELTAS:\n${deltas.map((delta, index) => `CHUNK ${index + 1}:\n${delta}`).join("\n\n")}`,
      4000,
    );
    const score = Number(analysis.match(/GLOBAL COHERENCE SCORE:\s*(\d+)/i)?.[1] || 0);
    const assessment = analysis.match(/OVERALL ASSESSMENT:\s*([^\n]+)/i)?.[1]?.trim() || "Whole-document analysis complete.";
    await db.update(writingJobs).set({
      status: "complete",
      output: analysis,
      auditReport: String(score),
      error: assessment,
      completedSections: sections.length,
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
  } catch (error: any) {
    console.error(`Coherence analysis job ${jobId} stopped:`, error);
    await db.update(writingJobs).set({ status: "paused", error: error.message || "Analysis paused", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
  } finally {
    activeJobs.delete(jobId);
  }
}