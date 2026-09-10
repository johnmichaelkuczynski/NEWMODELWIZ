import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { writingJobs, writingJobSections } from "@shared/schema";

type WritingProvider = "zhi1" | "zhi2" | "zhi3" | "zhi4" | "zhi5";

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function containsMarkdown(text: string): boolean {
  return /[*#`]|__|~~~|(^|\n)\s*>\s|(^|\n)\s*[-+]\s+|\[[^\]]+\]\([^)]+\)/m.test(text);
}

export function removeMarkdown(text: string): string {
  return text
    .replace(/```(?:[a-z0-9_-]+)?\s*/gi, "")
    .replace(/```|~~~/g, "")
    .replace(/^(\s{0,3})#{1,6}\s+/gm, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1$2")
    .replace(/^(\s*)>\s?/gm, "$1")
    .replace(/^(\s*)[-+*]\s+/gm, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatIntoParagraphs(text: string, targetParagraphWords = 130): string {
  const sourceParagraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const formatted: string[] = [];

  for (const source of sourceParagraphs) {
    if (countWords(source) <= 180) {
      formatted.push(source);
      continue;
    }

    const sentences = source.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g)?.map(sentence => sentence.trim()).filter(Boolean) || [source];
    let paragraph: string[] = [];
    let paragraphWords = 0;

    for (const sentence of sentences) {
      const sentenceWords = countWords(sentence);
      if (sentenceWords > 180) {
        if (paragraph.length) {
          formatted.push(paragraph.join(" "));
          paragraph = [];
          paragraphWords = 0;
        }
        const words = sentence.split(/\s+/);
        for (let index = 0; index < words.length; index += targetParagraphWords) {
          formatted.push(words.slice(index, index + targetParagraphWords).join(" "));
        }
        continue;
      }
      if (paragraph.length && paragraphWords + sentenceWords > targetParagraphWords) {
        formatted.push(paragraph.join(" "));
        paragraph = [];
        paragraphWords = 0;
      }
      paragraph.push(sentence);
      paragraphWords += sentenceWords;
    }
    if (paragraph.length) formatted.push(paragraph.join(" "));
  }

  return formatted.join("\n\n");
}

function trimToWordCount(text: string, targetWords: number): string {
  const wordPattern = /\S+/g;
  let match: RegExpExecArray | null;
  let words = 0;
  let end = 0;
  while ((match = wordPattern.exec(text)) !== null && words < targetWords) {
    words += 1;
    end = wordPattern.lastIndex;
  }
  return formatIntoParagraphs(text.slice(0, end).trim());
}

export function extractRequestedWordCount(instructions: string): number | null {
  const patterns = [
    /(?:exactly|approximately|about|around|roughly|at least|minimum of|word count(?:\s+of)?|length(?:\s+of)?)?\s*(\d[\d,]*)\s*[- ]?words?\b/i,
    /\b(\d[\d,]*)\s*[- ]word\b/i,
  ];
  for (const pattern of patterns) {
    const match = instructions.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isInteger(value) && value >= 50 && value <= 100_000) return value;
    }
  }
  return null;
}

async function callProvider(provider: WritingProvider, system: string, prompt: string, maxTokens = 5000): Promise<string> {
  if (provider === "zhi2") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      temperature: 0.65,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "";
  }

  const providerConfig = {
    zhi1: {
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: "gpt-4o",
    },
    zhi3: {
      url: "https://api.deepseek.com/chat/completions",
      key: process.env.DEEPSEEK_API_KEY,
      model: "deepseek-chat",
    },
    zhi4: {
      url: "https://api.perplexity.ai/chat/completions",
      key: process.env.PERPLEXITY_API_KEY,
      model: "sonar-pro",
    },
    zhi5: {
      url: "https://api.x.ai/v1/chat/completions",
      key: process.env.GROK_API_KEY,
      model: "grok-3",
    },
  }[provider === "zhi1" ? "zhi1" : provider];

  if (!providerConfig?.key) throw new Error(`${provider} is not configured`);
  const response = await fetch(providerConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.65,
      max_tokens: maxTokens,
    }),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Provider returned HTTP ${response.status}`);
  return data.choices?.[0]?.message?.content || "";
}

async function fillToTarget(
  provider: WritingProvider,
  initial: string,
  targetWords: number,
  context: string,
): Promise<string> {
  let text = removeMarkdown(initial);
  const minimumWords = Math.ceil(targetWords * 0.9);
  const maximumWords = Math.floor(targetWords * 1.1);
  for (let attempt = 0; countWords(text) < minimumWords && attempt < 4; attempt++) {
    const deficit = minimumWords - countWords(text);
    const continuation = await callProvider(
      provider,
      "Continue prose in plain text only. Never use Markdown symbols. Return only the continuation.",
      `Continue the passage naturally by approximately ${deficit + 40} words and bring it to a complete stopping point. Do not repeat prior material. Preserve the argument, terminology, voice, and continuity described below.\n\nCONTEXT:\n${context}\n\nPASSAGE END:\n${text.split(/\s+/).slice(-500).join(" ")}`,
      Math.min(5000, Math.ceil((deficit + 200) * 1.8)),
    );
    text = removeMarkdown(`${text}\n\n${continuation}`);
  }
  if (countWords(text) < minimumWords) {
    throw new Error(`Provider stopped at ${countWords(text)} words; minimum acceptable length is ${minimumWords}`);
  }
  return countWords(text) > maximumWords
    ? trimToWordCount(text, maximumWords)
    : formatIntoParagraphs(text);
}

async function createBlueprint(provider: WritingProvider, instructions: string, sectionCount: number): Promise<string> {
  return removeMarkdown(await callProvider(
    provider,
    "You design globally coherent long-form works. Plain text only. No Markdown symbols.",
    `Create a precise global coherence blueprint for the requested work. Define its controlling thesis or purpose, section sequence, recurring concepts, terminology rules, dependencies between early and late sections, facts and commitments that must remain stable, and the intended ending. Plan exactly ${sectionCount} sequential sections. Return only the blueprint in plain text.\n\nINSTRUCTIONS:\n${instructions}`,
    2500,
  ));
}

export async function createWritingJob(input: {
  userId?: number;
  instructions: string;
  provider: WritingProvider;
  requestedWordCount: number;
}) {
  const usesLargeScaleCoherence = input.requestedWordCount > 2000;
  const totalSections = usesLargeScaleCoherence
    ? Math.ceil(input.requestedWordCount / 1200)
    : 1;
  const [job] = await db.insert(writingJobs).values({
    userId: input.userId,
    instructions: input.instructions,
    provider: input.provider,
    requestedWordCount: input.requestedWordCount,
    usesLargeScaleCoherence,
    totalSections,
  }).returning();
  return job;
}

export async function getWritingJob(jobId: number) {
  const [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
  return job;
}

export async function processWritingJob(jobId: number): Promise<void> {
  const [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
  if (!job) throw new Error("Writing job not found");
  const provider = job.provider as WritingProvider;

  try {
    await db.update(writingJobs).set({ status: "planning", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));
    const blueprint = job.usesLargeScaleCoherence
      ? await createBlueprint(provider, job.instructions, job.totalSections)
      : removeMarkdown(job.instructions);
    let ledger = `Global requirements: ${job.instructions}\n\nBlueprint: ${blueprint}`;
    await db.update(writingJobs).set({ blueprint, coherenceLedger: ledger, status: "writing", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));

    const baseTarget = Math.floor(job.requestedWordCount / job.totalSections);
    const remainder = job.requestedWordCount % job.totalSections;

    for (let index = 0; index < job.totalSections; index++) {
      const targetWords = baseTarget + (index < remainder ? 1 : 0);
      const draft = await callProvider(
        provider,
        "Write polished prose in plain text only. Use readable paragraphs separated by blank lines. Do not use Markdown: no hashes, asterisks, underscores, code fences, blockquotes, link syntax, or bullet markers. Return only the requested prose section.",
        `Write section ${index + 1} of ${job.totalSections} at approximately ${targetWords} words. A length from ${Math.ceil(targetWords * 0.9)} through ${Math.floor(targetWords * 1.1)} words is acceptable. End naturally; do not pad or cut the argument merely to hit an exact count. Use multiple coherent paragraphs of roughly 80 to 160 words each, separated by blank lines. Follow the user's instructions and global blueprint. Maintain explicit logical and terminological continuity with every earlier section. Do not add meta-commentary.\n\nUSER INSTRUCTIONS:\n${job.instructions}\n\nGLOBAL BLUEPRINT AND CONTINUITY LEDGER:\n${ledger}`,
        Math.min(6000, Math.ceil((targetWords + 250) * 1.8)),
      );
      const content = await fillToTarget(provider, draft, targetWords, ledger);
      if (containsMarkdown(content)) throw new Error(`Markdown remained in section ${index + 1}`);

      const continuitySummary = job.usesLargeScaleCoherence
        ? removeMarkdown(await callProvider(
            provider,
            "Maintain a compact continuity ledger in plain text only.",
            `Update the continuity ledger after section ${index + 1}. Record claims established, definitions fixed, promises for later sections, unresolved questions, transitions, and any facts or terminology that later prose must preserve. Keep it under 350 words.\n\nPRIOR LEDGER:\n${ledger}\n\nNEW SECTION:\n${content}`,
            700,
          ))
        : "";
      ledger = job.usesLargeScaleCoherence ? continuitySummary : ledger;

      await db.insert(writingJobSections).values({
        jobId,
        sectionIndex: index,
        targetWordCount: targetWords,
        content,
        continuitySummary,
      });
      await db.update(writingJobs).set({
        completedSections: index + 1,
        coherenceLedger: ledger,
        updatedAt: new Date(),
      }).where(eq(writingJobs.id, jobId));
    }

    const sections = await db.select().from(writingJobSections)
      .where(eq(writingJobSections.jobId, jobId))
      .orderBy(asc(writingJobSections.sectionIndex));
    const output = removeMarkdown(sections.map(section => section.content).join("\n\n"));
    const actualWords = countWords(output);
    const minimumWords = Math.ceil(job.requestedWordCount * 0.9);
    const maximumWords = Math.floor(job.requestedWordCount * 1.1);
    if (actualWords < minimumWords || actualWords > maximumWords) {
      throw new Error(`Final word-count validation failed: ${actualWords} words is outside ${minimumWords}-${maximumWords}`);
    }
    if (containsMarkdown(output)) throw new Error("Final Markdown validation failed");

    await db.update(writingJobs).set({
      status: "complete",
      output,
      completedSections: job.totalSections,
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
  } catch (error: any) {
    await db.update(writingJobs).set({
      status: "failed",
      error: error.message || "Writing failed",
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
    throw error;
  }
}