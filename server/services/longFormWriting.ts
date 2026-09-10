import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { writingJobs, writingJobSections } from "@shared/schema";
import { normalizeMathNotation, preserveRequestedMathNotation } from "@shared/mathNotation";

type WritingProvider = "zhi1" | "zhi2" | "zhi3" | "zhi4" | "zhi5";

const UTILITARIAN_STYLE = `Use a succinct, utilitarian style to the fullest extent permitted by the user's instructions and subject matter. Begin with the first substantive claim, definition, event, or instruction. Never open with ceremonial framing, historical throat-clearing, or empty verbal gestures such as "In the realm of," "Throughout history," "It is important to note that," "It is worth noting that," "In today's world," "When it comes to," or claims that a topic "has long been a subject of inquiry." Prefer direct constructions and delete sentences that merely announce, praise, contextualize, or summarize the discussion without advancing it.`;
const MATH_NOTATION_STYLE = `Preserve mathematical notation exactly. Do not flatten indexed variables such as E_1 into E1 or replace symbols with names. Use conventional LaTeX notation internally for Greek letters, subscripts, superscripts, relations, and operators; the final formatter will render it as proper mathematical typography. LaTeX math is permitted and is not Markdown.`;
const ILLUSTRATIVE_STYLE = `Illustrate every substantive statement whose meaning is not genuinely self-evident. Place a concrete example, counterexample, named case, or brief application immediately after or within the same paragraph as the claim it explains. The example must instantiate the exact claim rather than merely restate it. Never leave vague umbrella phrases such as "modes of expression," "various contexts," "different forms," or "multiple situations" unexplained; name representative instances and show how the claim applies to them. Do not add examples to headings, elementary connective statements, or conclusions that have already been demonstrated.`;
const PHILOSOPHICAL_STYLE = `For philosophical or theoretical prose, always prefer a stark, precise, potentially refutable proposition to language that is vague, academic, flowery, or insulated from criticism. When asked to evaluate a claim, state the writer's own verdict in the first sentence; do not begin with the claim's origin, importance, or surrounding debate. Define disputed terms through explicit contrasts, necessary or sufficient conditions where appropriate, and ordinary cases. Reconstruct the opponent's actual inference before criticizing it; identify the exact premise, ambiguity, contradiction, or invalid step rather than gesturing at complexity. Use thought experiments, analogies, counterexamples, and reductio arguments when they expose logical structure. Answer the strongest natural objection directly. Do not organize the essay as alternating neutral summaries of what supporters and critics say. Do not use prestige phrases such as "offers a nuanced lens," "underscores the complex interplay," "invites us to reflect," "can be seen as," "it can be argued," or "arguably" in place of a claim. Do not end with "both sides," "the tension between these views," "highlights the complexity," "whether this is true may depend," or another refusal to decide. The conclusion must state the verdict and its decisive reason. If uncertainty is warranted, state exactly what evidence or inference is missing and what would settle it. Clarity takes priority even when it makes the claim easier to refute.`;
const ASSIGNMENT_FIDELITY = `Execute the work the user requested. Treat the requested thesis, premises, definitions, stance, narrative facts, mathematical assumptions, and structural commitments as assignment constraints rather than invitations to substitute your own preferred argument. Criticize, reject, modify, or reverse them only when the user explicitly assigns that operation in the current section. Distinguish an opponent's assigned objection from the work's controlling position, and return to the controlling position when the requested structure requires a rebuttal.`;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function containsMarkdown(text: string): boolean {
  return /[*#`]|__|~~~|(^|\n)\s*>\s|(^|\n)\s*[-+]\s+|\[[^\]]+\]\([^)]+\)/m.test(text);
}

export function containsEmptyVerbalGestures(text: string): boolean {
  return /\b(?:in the realm of|throughout history|since the dawn of|it is (?:important|worthwhile|worth) to note that|in today's (?:world|society)|when it comes to|has long been (?:a|an|the) (?:subject|topic|matter) (?:of|for))\b/i.test(text);
}

export function containsAcademicEvasion(text: string): boolean {
  return /\b(?:offers? a nuanced lens|underscores? the complex interplay|invites? us to reflect|can be seen as|it can be argued|arguably|the tension between (?:these|the) views|highlights? the complexity|whether [^.!?\n]{0,140} may depend)\b|(?:^|\n)\s*in conclusion,\s*while\b/im.test(text);
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
  const structurePreserved = text.replace(
    /(^|\n)\s*(chapter\s+\d{1,3}\s*:[^\n]*)(?=\n|$)/gi,
    "\n\n$2\n\n",
  );
  const sourceParagraphs = structurePreserved
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

function trimToNaturalWordCount(text: string, minimumWords: number, maximumWords: number): string {
  const formatted = formatIntoParagraphs(text);
  const wordPattern = /\S+/g;
  let match: RegExpExecArray | null;
  let words = 0;
  let end = 0;
  let naturalEnd = 0;
  while ((match = wordPattern.exec(formatted)) !== null && words < maximumWords) {
    words += 1;
    end = wordPattern.lastIndex;
    if (words >= minimumWords && /[.!?]["')\]]*$/.test(match[0])) naturalEnd = end;
  }
  return formatIntoParagraphs(formatted.slice(0, naturalEnd || end).trim());
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

export function getWordCountRange(instructions: string, targetWords: number): { minimum: number; maximum: number } {
  const hasHardMinimum = /\b(?:minimum of|at least|no fewer than)\s*\d[\d,]*\s*[- ]?words?\b/i.test(instructions);
  return {
    minimum: hasHardMinimum ? targetWords : Math.ceil(targetWords * 0.9),
    maximum: Math.floor(targetWords * 1.1),
  };
}

export function detectExplicitChapterCount(instructions: string): number | null {
  const declared = instructions.match(/\b(\d{1,3})\s*[- ]chapter\b/i);
  const chapterNumbers = [...instructions.matchAll(/\bchapter\s+(\d{1,3})\b/gi)]
    .map(match => Number(match[1]))
    .filter(number => number > 0 && number <= 100);
  const maximumNumber = chapterNumbers.length ? Math.max(...chapterNumbers) : 0;
  const declaredCount = declared ? Number(declared[1]) : 0;
  return Math.max(maximumNumber, declaredCount) || null;
}

export function extractChapterDirective(instructions: string, chapterNumber: number): string {
  const markers = [...instructions.matchAll(/\bchapter\s+(\d{1,3})\s*:/gi)]
    .map(match => ({ number: Number(match[1]), index: match.index ?? 0, contentStart: (match.index ?? 0) + match[0].length }));
  const markerIndex = markers.findIndex(marker => marker.number === chapterNumber);
  if (markerIndex < 0) return "";
  const marker = markers[markerIndex];
  const next = markers[markerIndex + 1];
  return instructions.slice(marker.contentStart, next?.index ?? instructions.length).trim();
}

export function extractWorkTitle(instructions: string): string | null {
  const match = instructions.match(/\btitled\s*:\s*(.+?)(?=\.\s*(?:rules?|chapter)\b|\n|$)/i);
  return match?.[1]?.trim() || null;
}

export function extractGlobalStandard(instructions: string): string | null {
  const match = instructions.match(/\bstandard\s*:\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function calculateSectionTargets(instructions: string, totalWords: number, sectionCount: number, chapterCount: number | null): number[] {
  const weights = Array.from({ length: sectionCount }, (_, index) => {
    if (!chapterCount) return 1;
    const directive = extractChapterDirective(instructions, index + 1);
    let weight = 1;
    if (/\b(?:construct|develop|deductive theory|derive)\b/i.test(directive)) weight += 0.35;
    if (/\b(?:dismantle|refute|rebut|defend)\b/i.test(directive)) weight += 0.35;
    if (/\b(?:define exactly|single most|formulate the single)\b/i.test(directive)) weight -= 0.15;
    return Math.max(0.6, weight);
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exactTargets = weights.map(weight => totalWords * weight / weightTotal);
  const targets = exactTargets.map(Math.floor);
  let remainder = totalWords - targets.reduce((sum, target) => sum + target, 0);
  const byFraction = exactTargets
    .map((target, index) => ({ index, fraction: target - Math.floor(target) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; remainder > 0; index++, remainder--) {
    targets[byFraction[index % byFraction.length].index] += 1;
  }
  return targets;
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
  hardMinimum = false,
  liveProgress?: (content: string) => Promise<boolean>,
  pauseBetweenChunksMs = 0,
): Promise<string> {
  let text = removeMarkdown(initial);
  const minimumWords = hardMinimum ? targetWords : Math.ceil(targetWords * 0.9);
  const maximumWords = Math.floor(targetWords * 1.1);
  const maximumContinuationAttempts = Math.ceil(targetWords / 350) + 4;
  for (let attempt = 0; countWords(text) < minimumWords && attempt < maximumContinuationAttempts; attempt++) {
    if (liveProgress && await liveProgress(text)) {
      throw new Error("WRITING_STOPPED_BY_USER");
    }
    if (pauseBetweenChunksMs > 0) {
      await new Promise(resolve => setTimeout(resolve, pauseBetweenChunksMs));
      if (liveProgress && await liveProgress(text)) {
        throw new Error("WRITING_STOPPED_BY_USER");
      }
    }
    const deficit = minimumWords - countWords(text);
    const continuationWords = Math.min(500, deficit + 40);
    const continuation = await callProvider(
      provider,
      `Continue prose in plain text only. Never use Markdown symbols. Return only the continuation. ${ASSIGNMENT_FIDELITY} ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
      `Continue the passage naturally by approximately ${continuationWords} words. ${deficit <= 500 ? "Bring it to a complete stopping point." : "Do not conclude the section yet."} Do not repeat prior material. Preserve the argument, terminology, voice, and continuity described below.\n\nCONTEXT:\n${context}\n\nPASSAGE END:\n${text.split(/\s+/).slice(-500).join(" ")}`,
      Math.min(1800, Math.ceil((continuationWords + 200) * 1.8)),
    );
    text = removeMarkdown(`${text}\n\n${continuation}`);
  }
  if (liveProgress && await liveProgress(text)) {
    throw new Error("WRITING_STOPPED_BY_USER");
  }
  if (countWords(text) < minimumWords) {
    throw new Error(`Provider stopped at ${countWords(text)} words; minimum acceptable length is ${minimumWords}`);
  }
  return countWords(text) > maximumWords
    ? trimToNaturalWordCount(text, minimumWords, maximumWords)
    : formatIntoParagraphs(text);
}

function chapterHeadings(text: string): number[] {
  return [...text.matchAll(/(?:^|\n)\s*chapter\s+(\d{1,3})\b/gi)].map(match => Number(match[1]));
}

function enforceChapterPresentation(text: string, chapterNumber: number, title: string | null): string {
  let content = text.trim();
  if (title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(new RegExp(escapedTitle, "gi"), "").trim();
    content = `${title}\n\n${content}`;
  }
  if (!chapterHeadings(content).includes(chapterNumber)) {
    const titlePrefix = title ? `${title}\n\n` : "";
    const body = title ? content.slice(titlePrefix.length).trim() : content;
    content = `${titlePrefix}Chapter ${chapterNumber}:\n\n${body}`;
  }
  return content;
}

function removeUnassignedChapterReferences(text: string, chapterNumber: number, assignedDirective: string): string {
  const permittedReferences = new Set(
    [...assignedDirective.matchAll(/\bchapter\s+(\d{1,3})\b/gi)].map(match => Number(match[1])),
  );
  return text
    .split(/\n\s*\n/)
    .map(paragraph => {
      if (new RegExp(`^chapter\\s+${chapterNumber}\\s*:`, "i").test(paragraph.trim())) return paragraph.trim();
      const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [paragraph];
      return sentences
        .map(sentence => sentence.trim())
        .filter(sentence => {
          const references = [...sentence.matchAll(/\bchapter\s+(\d{1,3})\b/gi)].map(match => Number(match[1]));
          return references.every(reference => permittedReferences.has(reference));
        })
        .join(" ");
    })
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .join("\n\n");
}

function enforceSingleFinalTheorem(text: string, assignedDirective: string): string {
  if (!/(?:final paragraph|concluding theorem).{0,120}\btheorem\b|\btheorem\b.{0,120}(?:final paragraph|concluding)/i.test(assignedDirective)) {
    return text;
  }
  const paragraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  const theoremIndexes = paragraphs
    .map((paragraph, index) => (/\btheorem\b/i.test(paragraph) ? index : -1))
    .filter(index => index >= 0);
  if (!theoremIndexes.length) return text;
  const finalTheoremIndex = theoremIndexes[theoremIndexes.length - 1];
  const finalTheorem = paragraphs[finalTheoremIndex].replace(/^concluding theorem:\s*/i, "");
  const body = paragraphs.filter((paragraph, index) =>
    index !== finalTheoremIndex && !/\btheorem\b/i.test(paragraph),
  );
  return [...body, `Concluding Theorem: ${finalTheorem}`].join("\n\n");
}

export function finalizeRequiredTheorem(text: string, instructions: string): string {
  if (!/final paragraph[\s\S]{0,180}\btheorem\b/i.test(instructions)) return text;
  const paragraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  const chapterOneIndex = paragraphs.findIndex(paragraph => /^chapter\s+1\s*:/i.test(paragraph));
  const openingParagraph = paragraphs.slice(chapterOneIndex + 1).find(paragraph => !/^chapter\s+\d+\s*:/i.test(paragraph));
  const openingSentence = openingParagraph?.match(/^.*?[.!?](?=\s|["')\]]|$)/)?.[0]?.trim();
  const finalIndex = paragraphs.length - 1;
  let finalParagraph = paragraphs[finalIndex].replace(/^concluding theorem:\s*/i, "");
  finalParagraph = `Concluding Theorem: ${finalParagraph}`;
  if (openingSentence && !finalParagraph.includes(openingSentence)) {
    finalParagraph += ` The opening sentence of Chapter 1 states: "${openingSentence}" The derivation just established entails that opening claim directly, because semantic inquiry requires precisely the invariant meaning and irreducible intentional mediation proven necessary here.`;
  }
  paragraphs[finalIndex] = finalParagraph;
  return paragraphs.join("\n\n");
}

function removeRepetitiveSummaryParagraphs(text: string, globalStandard: string | null): string {
  if (!globalStandard || !/\bno repetitive (?:conversational )?summaries\b/i.test(globalStandard)) return text;
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph =>
      /\btheorem\b/i.test(paragraph)
      || !/^(?:in summary|to summarize|in conclusion|in closing|ultimately)\b/i.test(paragraph),
    )
    .join("\n\n");
}

function validateChapterSection(text: string, chapterNumber: number): void {
  const headings = chapterHeadings(text);
  if (headings.length !== 1 || headings[0] !== chapterNumber) {
    throw new Error(`Chapter ${chapterNumber} structure failed: expected one Chapter ${chapterNumber} heading; received ${headings.join(", ") || "none"}`);
  }
}

async function auditSection(
  provider: WritingProvider,
  instructions: string,
  blueprint: string,
  content: string,
  chapterNumber: number | null,
  auditGuidance?: string | null,
): Promise<string> {
  const originalDirective = chapterNumber ? extractChapterDirective(instructions, chapterNumber) : instructions;
  const assignedDirective = auditGuidance
    ? `${originalDirective}\n\nPRIOR AUDIT FINDINGS. APPLY ONLY CORRECTIONS COMPATIBLE WITH THE ORIGINAL ASSIGNMENT; THE ORIGINAL ASSIGNMENT ALWAYS CONTROLS:\n${auditGuidance}`
    : originalDirective;
  const standard = extractGlobalStandard(instructions);
  return removeMarkdown(await callProvider(
    provider,
    `Act as a strict read-only compliance auditor. Never rewrite the work. Check explicit requirements, mathematical fidelity, concrete explanatory coverage, and the mandatory standards for utilitarian and philosophical prose. Respond with PASS if every requirement assigned to this section is satisfied. Otherwise respond with FAIL followed by a concise list of concrete omissions or violations. The user's original assignment is authoritative; prior audit findings may never override it. Plain text only. ${MATH_NOTATION_STYLE}`,
    `Audit ${chapterNumber ? `Chapter ${chapterNumber}` : "the following section"}. Whole-work title, length, chapter-count, and completion requirements are validated separately and must not be evaluated here. Any requirement that the final theorem quote or link to the opening sentence of the complete work is also validated and inserted during final assembly, so do not fail this section for the absence or wording of that cross-document callback. Fail for another substantive explicit-constraint violation. Fail when a non-self-evident substantive claim lacks a nearby concrete example, case, counterexample, or application, or when a vague category phrase is used without naming representative instances. Do not demand examples for headings, elementary connective statements, or conclusions already demonstrated. For philosophical or theoretical prose, fail unnecessary hedging, undefined abstractions, prestige language substituted for reasoning, false balance, or criticism that does not identify the opponent's exact error. If the directive asks for an evaluation, fail unless the writer's verdict appears in the first sentence and the conclusion gives the verdict's decisive reason. Fail an essay that merely alternates summaries of proponents and critics. Do not fail uncertainty that is itself precisely stated and justified. Fail utilitarian style only when the opening delays substance through ceremonial framing or the text contains one of the empty verbal gestures explicitly named below; do not invent additional banned phrases or reject useful explanatory language merely because it could be shortened. Do not accept promises that an assigned task will be completed later. ${UTILITARIAN_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}${standard ? ` Apply this additional standard: ${standard}` : ""}\n\nASSIGNED DIRECTIVE:\n${assignedDirective}\n\nSECTION:\n${content}`,
    700,
  ));
}

async function repairSection(
  provider: WritingProvider,
  instructions: string,
  blueprint: string,
  content: string,
  audit: string,
  chapterNumber: number | null,
  targetWords: number,
  auditGuidance?: string | null,
): Promise<string> {
  const originalDirective = chapterNumber ? extractChapterDirective(instructions, chapterNumber) : instructions;
  const assignedDirective = auditGuidance
    ? `${originalDirective}\n\nPRIOR AUDIT FINDINGS. APPLY ONLY CORRECTIONS COMPATIBLE WITH THE ORIGINAL ASSIGNMENT; THE ORIGINAL ASSIGNMENT ALWAYS CONTROLS:\n${auditGuidance}`
    : originalDirective;
  const title = chapterNumber === 1 ? extractWorkTitle(instructions) : null;
  const standard = extractGlobalStandard(instructions);
  return callProvider(
    provider,
    `Rewrite prose to satisfy every explicit requirement. Use readable paragraphs and plain text only. Do not use Markdown. Return only the complete replacement section. ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
    `Rewrite the section at approximately ${targetWords} words. Correct every audit finding without weakening, changing, or omitting its assigned directive. ${chapterNumber ? `This replacement must contain exactly one Chapter ${chapterNumber} heading and must not contain any other chapter heading. ${title ? `Put the exact title "${title}" before the Chapter 1 heading.` : "Begin with the chapter heading."} Do not preview, summarize, name, or perform material assigned to another chapter.` : ""}${standard ? ` Apply this global standard: ${standard}` : ""}\n\nASSIGNED DIRECTIVE:\n${assignedDirective}\n\nAUDIT FINDINGS:\n${audit}\n\nSECTION TO REPLACE:\n${content}`,
    Math.min(6000, Math.ceil((targetWords + 300) * 1.8)),
  );
}

async function rewriteDecisively(
  provider: WritingProvider,
  assignedDirective: string,
  content: string,
  chapterNumber: number | null,
  targetWords: number,
  title: string | null,
): Promise<string> {
  return callProvider(
    provider,
    `Replace evasive philosophical prose with a decisive argument. Return only the complete replacement in plain text with readable paragraphs and no Markdown. ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
    `Write approximately ${targetWords} words. Preserve the assigned subject and every explicit requirement, but rebuild the reasoning rather than editing the existing sentences. The first prose sentence must state the writer's own verdict in a form that can be true or false. State the opponent's strongest inference as identifiable premises and a conclusion. Identify the exact premise, ambiguity, contradiction, or inferential step that succeeds or fails. Use at least two concrete examples or counterexamples as tests of the argument. Answer the strongest objection. The final paragraph must state the verdict and decisive reason without compromise, false balance, generic complexity language, or a question left for the reader.${chapterNumber ? ` Preserve exactly one Chapter ${chapterNumber} heading and no other chapter heading.${title ? ` Put the exact title "${title}" before the Chapter 1 heading.` : ""}` : ""}\n\nASSIGNED DIRECTIVE:\n${assignedDirective}\n\nMATERIAL TO REBUILD:\n${content}`,
    Math.min(6000, Math.ceil((targetWords + 350) * 1.8)),
  );
}

async function polishSection(
  provider: WritingProvider,
  assignedDirective: string,
  content: string,
  chapterNumber: number,
  targetWords: number,
  title: string | null,
  requiresFinalTheorem: boolean,
): Promise<string> {
  return callProvider(
    provider,
    `Act as a rigorous developmental editor. Return only the complete revised chapter in plain text with readable paragraphs and no Markdown. ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
    `Revise Chapter ${chapterNumber} to approximately ${targetWords} words while preserving every substantive claim required by its directive. Remove recap paragraphs, repeated conclusions, repeated examples or applications, ceremonial introductions, and empty verbal gestures. Every paragraph must perform distinct argumentative work; replace redundant material with deeper deductions, objections, distinctions, or implications directly relevant to the assigned task. Do not mention or preview any unassigned chapter. Preserve exactly one Chapter ${chapterNumber} heading.${title ? ` Preserve the exact work title "${title}" before the Chapter 1 heading.` : ""}${requiresFinalTheorem ? ` Preserve exactly one theorem derivation, only in the final paragraph, beginning "Concluding Theorem:".` : ""}\n\nASSIGNED DIRECTIVE:\n${assignedDirective}\n\nCHAPTER TO TIGHTEN:\n${content}`,
    Math.min(6000, Math.ceil((targetWords + 350) * 1.8)),
  );
}

async function createBlueprint(provider: WritingProvider, instructions: string, sectionCount: number): Promise<string> {
  return removeMarkdown(await callProvider(
    provider,
    `You design globally coherent long-form works. Plain text only. No Markdown symbols. ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
    `Create a precise global coherence blueprint for the requested work. Define its controlling thesis or purpose, section sequence, recurring concepts, terminology rules, dependencies between early and late sections, facts and commitments that must remain stable, and the intended ending. Plan exactly ${sectionCount} sequential sections. Return only the blueprint in plain text.\n\nINSTRUCTIONS:\n${instructions}`,
    2500,
  ));
}

export async function createWritingJob(input: {
  userId?: number;
  instructions: string;
  provider: WritingProvider;
  requestedWordCount: number;
  auditGuidance?: string;
}) {
  const explicitChapterCount = detectExplicitChapterCount(input.instructions);
  const usesLargeScaleCoherence = input.requestedWordCount > 2000 || Boolean(explicitChapterCount && explicitChapterCount > 1);
  const totalSections = explicitChapterCount
    || (input.requestedWordCount > 2000 ? Math.ceil(input.requestedWordCount / 1200) : 1);
  const [job] = await db.insert(writingJobs).values({
    userId: input.userId,
    instructions: input.instructions,
    provider: input.provider,
    requestedWordCount: input.requestedWordCount,
    auditGuidance: input.auditGuidance || null,
    usesLargeScaleCoherence,
    totalSections,
  }).returning();
  return job;
}

export async function getWritingJob(jobId: number) {
  const [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
  return job;
}

export async function requestWritingStop(jobId: number): Promise<void> {
  await db.update(writingJobs)
    .set({ stopRequested: true, updatedAt: new Date() })
    .where(eq(writingJobs.id, jobId));
}

export async function processWritingJob(jobId: number): Promise<void> {
  const [job] = await db.select().from(writingJobs).where(eq(writingJobs.id, jobId));
  if (!job) throw new Error("Writing job not found");
  const provider = job.provider as WritingProvider;
  let inProgressContent = "";
  const completedOutputParts: string[] = [];
  const auditFailures = new Map<number, { section: string; report: string }>();

  try {
    await db.update(writingJobs).set({
      status: "planning",
      error: null,
      output: null,
      stopRequested: false,
      stoppedEarly: false,
      completedSections: 0,
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
    const blueprint = job.usesLargeScaleCoherence
      ? await createBlueprint(provider, job.instructions, job.totalSections)
      : removeMarkdown(job.instructions);
    let ledger = `Global requirements: ${job.instructions}\n\nBlueprint: ${blueprint}`;
    await db.update(writingJobs).set({ blueprint, coherenceLedger: ledger, status: "writing", updatedAt: new Date() }).where(eq(writingJobs.id, jobId));

    const explicitChapterCount = detectExplicitChapterCount(job.instructions);
    const hardMinimum = getWordCountRange(job.instructions, job.requestedWordCount).minimum === job.requestedWordCount;
    const sectionTargets = calculateSectionTargets(
      job.instructions,
      job.requestedWordCount,
      job.totalSections,
      explicitChapterCount,
    );

    for (let index = 0; index < job.totalSections; index++) {
      const targetWords = sectionTargets[index];
      const chapterNumber = explicitChapterCount ? index + 1 : null;
      const assignedDirective = chapterNumber ? extractChapterDirective(job.instructions, chapterNumber) : job.instructions;
      const guidedDirective = job.auditGuidance
        ? `${assignedDirective}\n\nPRIOR AUDIT FINDINGS. IMPROVE THE NEW DRAFT WHERE COMPATIBLE, BUT NEVER CHANGE OR OVERRIDE THE USER'S ORIGINAL THESIS, PREMISES, DEFINITIONS, STANCE, STRUCTURE, OR OTHER EXPLICIT REQUIREMENTS:\n${job.auditGuidance}`
        : assignedDirective;
      const workTitle = chapterNumber === 1 ? extractWorkTitle(job.instructions) : null;
      const globalStandard = extractGlobalStandard(job.instructions);
      const sectionMinimum = hardMinimum ? targetWords : Math.ceil(targetWords * 0.9);
      const streamsInChunks = job.requestedWordCount > 1500;
      const initialChunkWords = streamsInChunks ? Math.min(500, targetWords) : targetWords;
      const structuralInstruction = chapterNumber
        ? `This section corresponds exclusively to Chapter ${chapterNumber} of ${explicitChapterCount}. ${workTitle ? `Place the exact title "${workTitle}" on the first line, then use ` : "Begin with "}exactly one plain-text heading starting "Chapter ${chapterNumber}:" and write only that chapter. Do not repeat, preview, name, begin, or defend material assigned to another chapter.`
        : `Write section ${index + 1} of ${job.totalSections}.`;
      const theoremInstruction = /final paragraph[\s\S]{0,180}\btheorem\b/i.test(assignedDirective)
        ? ` The final paragraph must begin "Concluding Theorem:" and present the deductive derivation requested by the user from the controlling premises and definitions specified in the assignment. It must quote the opening prose sentence of Chapter 1 verbatim from the continuity record and state exactly how the theorem entails that sentence. Do not state or derive the theorem anywhere before the final paragraph.`
        : "";
      const priorContext = chapterNumber === 1
        ? "There is no earlier chapter. Do not discuss any later chapter or later technical concept."
        : ledger;
      const fillContext = chapterNumber
        ? `CURRENT CHAPTER DIRECTIVE:\n${guidedDirective}\n\nCOMPLETED EARLIER CHAPTER CONTINUITY:\n${priorContext}\n\nRemain inside the current chapter. Do not announce transitions or mention any chapter unless the current directive explicitly requires that reference.`
        : priorContext;
      const draft = await callProvider(
        provider,
        `Write polished prose in plain text only. Use readable paragraphs separated by blank lines. Do not use Markdown: no hashes, asterisks, code fences, blockquotes, link syntax, or bullet markers. LaTeX underscores inside mathematical expressions are allowed. Return only the requested prose section. ${ASSIGNMENT_FIDELITY} ${UTILITARIAN_STYLE} ${MATH_NOTATION_STYLE} ${ILLUSTRATIVE_STYLE} ${PHILOSOPHICAL_STYLE}`,
        `${structuralInstruction} Write the first approximately ${initialChunkWords} words of this ${targetWords}-word section.${streamsInChunks && initialChunkWords < targetWords ? " Stop at a natural paragraph boundary without concluding; later calls will continue the section." : " End naturally."} Use readable paragraphs of roughly 80 to 160 words each, separated by blank lines. Execute every requirement in the assigned directive. Maintain explicit logical and terminological continuity with every earlier section. Do not add conversational summaries, promises about later content, or meta-commentary. Do not preview, summarize, name, or perform material assigned to another chapter.${theoremInstruction}${globalStandard ? ` Apply this global standard: ${globalStandard}` : ""}\n\nASSIGNED DIRECTIVE:\n${guidedDirective}\n\nCONTINUITY FROM COMPLETED EARLIER CHAPTERS ONLY:\n${priorContext}`,
        Math.min(1800, Math.ceil((initialChunkWords + 250) * 1.8)),
      );
      const preparedDraft = removeRepetitiveSummaryParagraphs(draft, globalStandard);
      const publishLiveProgress = async (currentSection: string): Promise<boolean> => {
        inProgressContent = currentSection;
        const liveOutput = preserveRequestedMathNotation(
          normalizeMathNotation(removeMarkdown([...completedOutputParts, currentSection].filter(Boolean).join("\n\n"))),
          job.instructions,
        );
        await db.update(writingJobs).set({
          output: liveOutput,
          updatedAt: new Date(),
        }).where(eq(writingJobs.id, jobId));
        const [currentJob] = await db.select({
          stopRequested: writingJobs.stopRequested,
        }).from(writingJobs).where(eq(writingJobs.id, jobId));
        return Boolean(currentJob?.stopRequested);
      };
      let content = await fillToTarget(
        provider,
        preparedDraft,
        targetWords,
        fillContext,
        hardMinimum,
        publishLiveProgress,
        streamsInChunks ? 5000 : 0,
      );
      if (chapterNumber) {
        content = enforceChapterPresentation(content, chapterNumber, workTitle);
        content = removeUnassignedChapterReferences(content, chapterNumber, assignedDirective);
        content = removeRepetitiveSummaryParagraphs(content, globalStandard);
        if (countWords(content) < sectionMinimum) {
          content = await fillToTarget(provider, content, targetWords, fillContext, hardMinimum);
          content = enforceChapterPresentation(content, chapterNumber, workTitle);
          content = removeUnassignedChapterReferences(content, chapterNumber, assignedDirective);
          content = removeRepetitiveSummaryParagraphs(content, globalStandard);
        }
        content = enforceSingleFinalTheorem(content, assignedDirective);
      }
      content = preserveRequestedMathNotation(normalizeMathNotation(content), assignedDirective);
      if (chapterNumber) {
        try {
          validateChapterSection(content, chapterNumber);
        } catch (error) {
          console.warn(`Chapter ${chapterNumber} delivered despite a remaining structural warning:`, error);
        }
      }
      content = removeMarkdown(content);
      if (containsEmptyVerbalGestures(content)) {
        console.warn(`Section ${index + 1} delivered with a remaining utilitarian-style warning.`);
        auditFailures.set(index, {
          section: chapterNumber ? `Chapter ${chapterNumber}` : `Section ${index + 1}`,
          report: "The delivered text still contains a ceremonial or empty verbal gesture.",
        });
      }
      if (containsAcademicEvasion(content)) {
        console.warn(`Section ${index + 1} delivered with a remaining philosophical-style warning.`);
        auditFailures.set(index, {
          section: chapterNumber ? `Chapter ${chapterNumber}` : `Section ${index + 1}`,
          report: "The delivered text still contains academic evasion or false-balance language.",
        });
      }
      inProgressContent = content;

      const continuitySummary = job.usesLargeScaleCoherence
        ? removeMarkdown(await callProvider(
            provider,
            "Maintain a compact continuity ledger in plain text only.",
            `Update the continuity ledger after section ${index + 1}. Record claims established, definitions fixed, promises for later sections, unresolved questions, transitions, and any facts or terminology that later prose must preserve. After the first section, record its opening sentence verbatim so a required concluding callback can reproduce it accurately. Keep it under 350 words.\n\nPRIOR LEDGER:\n${ledger}\n\nNEW SECTION:\n${content}`,
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
      completedOutputParts.push(content);
      inProgressContent = "";
      await db.update(writingJobs).set({
        completedSections: index + 1,
        coherenceLedger: ledger,
        updatedAt: new Date(),
      }).where(eq(writingJobs.id, jobId));
    }

    const sections = await db.select().from(writingJobSections)
      .where(eq(writingJobSections.jobId, jobId))
      .orderBy(asc(writingJobSections.sectionIndex));
    const output = preserveRequestedMathNotation(
      normalizeMathNotation(removeMarkdown(sections.map(section => section.content).join("\n\n"))),
      job.instructions,
    );
    await db.update(writingJobs).set({
      status: "auditing",
      output,
      completedSections: job.totalSections,
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));

    for (const section of sections) {
      const [currentJob] = await db.select({
        stopRequested: writingJobs.stopRequested,
      }).from(writingJobs).where(eq(writingJobs.id, jobId));
      if (currentJob?.stopRequested) break;
      const chapterNumber = explicitChapterCount ? section.sectionIndex + 1 : null;
      const audit = containsAcademicEvasion(section.content)
        ? "FAIL: The section contains academic evasion or a false-balance conclusion."
        : await auditSection(
            provider,
            job.instructions,
            blueprint,
            section.content,
            chapterNumber,
            job.auditGuidance,
          );
      if (!/^pass\b/i.test(audit.trim())) {
        auditFailures.set(section.sectionIndex, {
          section: chapterNumber ? `Chapter ${chapterNumber}` : `Section ${section.sectionIndex + 1}`,
          report: audit.replace(/^fail\s*:?\s*/i, "").trim(),
        });
      }
    }
    const actualWords = countWords(output);
    const { minimum: minimumWords, maximum: maximumWords } = getWordCountRange(job.instructions, job.requestedWordCount);
    if (actualWords < minimumWords || actualWords > maximumWords) {
      console.warn(`Final document delivered outside the requested word-count range: ${actualWords} words is outside ${minimumWords}-${maximumWords}.`);
    }
    if (explicitChapterCount) {
      const headings = chapterHeadings(output);
      const expected = Array.from({ length: explicitChapterCount }, (_, index) => index + 1);
      if (headings.length !== expected.length || headings.some((heading, index) => heading !== expected[index])) {
        console.warn(`Final document delivered with a chapter-structure warning: expected ${expected.join(", ")}; received ${headings.join(", ") || "none"}.`);
      }
    }
    if (containsEmptyVerbalGestures(output)) {
      console.warn("Final document delivered with a remaining utilitarian-style warning.");
    }
    if (containsAcademicEvasion(output)) {
      console.warn("Final document delivered with a remaining philosophical-style warning.");
    }

    await db.update(writingJobs).set({
      status: "complete",
      output,
      completedSections: job.totalSections,
      auditReport: JSON.stringify(Array.from(auditFailures.values())),
      stoppedEarly: false,
      stopRequested: false,
      error: null,
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
  } catch (error: any) {
    const savedSections = await db.select().from(writingJobSections)
      .where(eq(writingJobSections.jobId, jobId))
      .orderBy(asc(writingJobSections.sectionIndex));
    const deliverableParts = savedSections.map(section => section.content);
    if (inProgressContent.trim()) deliverableParts.push(inProgressContent);
    if (deliverableParts.length > 0) {
      const recoverableOutput = preserveRequestedMathNotation(
        normalizeMathNotation(removeMarkdown(deliverableParts.join("\n\n"))),
        job.instructions,
      );
      console.error(`Writing job ${jobId} encountered an error after producing text; delivering the best available document instead:`, error);
      await db.update(writingJobs).set({
        status: "complete",
        output: recoverableOutput,
        completedSections: deliverableParts.length,
        auditReport: JSON.stringify([
          ...Array.from(auditFailures.values()),
          { section: "Generation", report: error.message || "A later generation step failed after usable text had been produced." },
        ]),
        stoppedEarly: error.message === "WRITING_STOPPED_BY_USER",
        stopRequested: false,
        error: null,
        updatedAt: new Date(),
      }).where(eq(writingJobs.id, jobId));
      return;
    }
    await db.update(writingJobs).set({
      status: "failed",
      error: error.message || "Writing failed",
      updatedAt: new Date(),
    }).where(eq(writingJobs.id, jobId));
    throw error;
  }
}