import type { NextFunction, Request, Response } from "express";
import { createHash, randomUUID } from "crypto";
import { pool } from "../db";
import { storage } from "../storage";
import { isPermanentOwnerEmail } from "../lib/stripe-config";

const ANONYMOUS_ACTION_LIMIT = 5;
const ANONYMOUS_WORD_LIMIT = 6000;
const ANONYMOUS_WRITING_PREVIEW_WORDS = 2000;
const SIGNED_IN_ACTION_LIMIT = 20;
const SIGNED_IN_WORD_LIMIT = 20000;
const SIGNED_IN_WRITING_PREVIEW_WORDS = 2000;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type AccessTier = "anonymous" | "free" | "subscriber";

function wordsIn(value: unknown): number {
  if (typeof value !== "string") return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function requestedWritingWords(req: Request): number {
  const explicit = Number(req.body?.requestedWordCount);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions : "";
  const match = instructions.match(/\b(\d{1,3}(?:,\d{3})+|\d{2,6})\s*[- ]?words?\b/i);
  return match ? Number(match[1].replace(/,/g, "")) : 1000;
}

async function requestedResumeWords(path: string): Promise<number> {
  const jobId = Number(path.match(/^\/api\/writing(?:-v2)?\/jobs\/(\d+)\/(?:resume|redo)$/)?.[1]);
  if (!Number.isInteger(jobId)) return 1000;
  const result = await pool.query(
    `SELECT requested_word_count, completed_sections, total_sections
       FROM writing_jobs WHERE id = $1 LIMIT 1`,
    [jobId],
  );
  const job = result.rows[0];
  if (!job) return 1000;
  const total = Math.max(1, Number(job.total_sections) || 1);
  const remaining = Math.max(0, total - (Number(job.completed_sections) || 0));
  return Math.max(250, Math.ceil((Number(job.requested_word_count) || 1000) * remaining / total));
}

function isMeteredPath(path: string): boolean {
  if (path === "/api/diagnostic/megaglobal") return false;
  if (/\/stop$/.test(path)) return false;
  return /(analy|evaluat|rewrite|writing|coherence|model|chat|translat|speech|search|humanizer|cognitive|fiction|case-assessment|bottomline|objection|validator|gpt-bypass|diagnostic\/run)/i.test(path);
}

function requiresSubscription(path: string): boolean {
  return path === "/api/diagnostic/run";
}

function instructionsRequireMultipleSections(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const chapterNumbers = Array.from(value.matchAll(/\b(?:chapter|section)\s+(\d{1,3})\b/gi))
    .map(match => Number(match[1]))
    .filter(Number.isInteger);
  return chapterNumbers.length > 1 || chapterNumbers.some(number => number > 1);
}

async function requiresSignedInDatabaseOwner(req: Request, path: string): Promise<boolean> {
  if (path === "/api/coherence-analysis-jobs") return true;
  if (path === "/api/writing/jobs" || path === "/api/writing-v2/jobs") {
    if (req.body?.forceSingleSectionPreview === true) return false;
    return requestedWritingWords(req) > 2000 || instructionsRequireMultipleSections(req.body?.instructions);
  }
  if (/^\/api\/writing(?:-v2)?\/jobs\/\d+\/(resume|redo)$/.test(path)) {
    const jobId = Number(path.match(/^\/api\/writing(?:-v2)?\/jobs\/(\d+)\/(?:resume|redo)$/)?.[1]);
    if (!Number.isInteger(jobId)) return false;
    const result = await pool.query(
      `SELECT uses_large_scale_coherence FROM writing_jobs WHERE id = $1 LIMIT 1`,
      [jobId],
    );
    return Boolean(result.rows[0]?.uses_large_scale_coherence);
  }
  return false;
}

async function accessTier(req: Request): Promise<{ tier: AccessTier; identityKey: string; subscribed: boolean }> {
  if (!req.user) {
    const session = req.session as typeof req.session & { usageIdentity?: string };
    if (!session.usageIdentity) session.usageIdentity = randomUUID();
    const identityKey = `anonymous:${createHash("sha256").update(session.usageIdentity).digest("hex")}`;
    return { tier: "anonymous", identityKey, subscribed: false };
  }
  if (
    process.env.NODE_ENV === "development"
    && req.user.username === "dev_johnmichaelkuczynski"
  ) {
    return {
      tier: "subscriber",
      identityKey: `user:${req.user.id}`,
      subscribed: true,
    };
  }
  if (isPermanentOwnerEmail(req.user.email)) {
    return {
      tier: "subscriber",
      identityKey: `user:${req.user.id}`,
      subscribed: true,
    };
  }
  const user = await storage.getUser(req.user.id);
  const legacy = user ? await storage.getUserSubscription(user.id, user.email) : null;
  const status = user?.subscriptionStatus || legacy?.status || null;
  const periodEnd = user?.subscriptionCurrentPeriodEnd;
  const subscribed = Boolean(
    status
    && ACTIVE_SUBSCRIPTION_STATUSES.has(status)
    && (!periodEnd || periodEnd.getTime() > Date.now()),
  );
  return {
    tier: subscribed ? "subscriber" : "free",
    identityKey: `user:${req.user.id}`,
    subscribed,
  };
}

async function currentUsage(identityKey: string) {
  const result = await pool.query(
    `SELECT actions_used, words_reserved FROM ai_usage_quotas WHERE identity_key = $1`,
    [identityKey],
  );
  return {
    actionsUsed: Number(result.rows[0]?.actions_used) || 0,
    wordsReserved: Number(result.rows[0]?.words_reserved) || 0,
  };
}

async function reserveUsage(
  identityKey: string,
  tier: Exclude<AccessTier, "subscriber">,
  words: number,
) {
  const actionLimit = tier === "anonymous" ? ANONYMOUS_ACTION_LIMIT : SIGNED_IN_ACTION_LIMIT;
  const wordLimit = tier === "anonymous" ? ANONYMOUS_WORD_LIMIT : SIGNED_IN_WORD_LIMIT;
  if (words > wordLimit) return null;
  const result = await pool.query(
    `INSERT INTO ai_usage_quotas (identity_key, tier, actions_used, words_reserved, updated_at)
     VALUES ($1, $2, 1, $3, NOW())
     ON CONFLICT (identity_key) DO UPDATE SET
       tier = EXCLUDED.tier,
       actions_used = ai_usage_quotas.actions_used + 1,
       words_reserved = ai_usage_quotas.words_reserved + EXCLUDED.words_reserved,
       updated_at = NOW()
     WHERE ai_usage_quotas.actions_used + 1 <= $4
       AND ai_usage_quotas.words_reserved + EXCLUDED.words_reserved <= $5
     RETURNING actions_used, words_reserved`,
    [identityKey, tier, words, actionLimit, wordLimit],
  );
  if (!result.rows[0]) return null;
  return {
    actionsUsed: Number(result.rows[0].actions_used),
    wordsReserved: Number(result.rows[0].words_reserved),
    actionLimit,
    wordLimit,
  };
}

function quotaResponse(
  res: Response,
  tier: Exclude<AccessTier, "subscriber">,
  usage: { actionsUsed: number; wordsReserved: number },
) {
  const anonymous = tier === "anonymous";
  const actionLimit = anonymous ? ANONYMOUS_ACTION_LIMIT : SIGNED_IN_ACTION_LIMIT;
  const wordLimit = anonymous ? ANONYMOUS_WORD_LIMIT : SIGNED_IN_WORD_LIMIT;
  return res.status(anonymous ? 401 : 402).json({
    code: anonymous ? "SIGN_IN_REQUIRED" : "SUBSCRIPTION_REQUIRED",
    message: anonymous
      ? "You have used your five free operations, or this request exceeds the remaining free size allowance. Sign in with Google to receive 20 additional free operations."
      : "You have used your 20 signed-in free operations, or this request exceeds the remaining free size allowance. Subscribe to continue writing and analysis.",
    nextAction: anonymous ? "sign-in" : "subscribe",
    usage: {
      tier,
      actionsUsed: usage.actionsUsed,
      actionLimit,
      wordsReserved: usage.wordsReserved,
      wordLimit,
      actionsRemaining: Math.max(0, actionLimit - usage.actionsUsed),
      wordsRemaining: Math.max(0, wordLimit - usage.wordsReserved),
    },
  });
}

function requestedProvider(req: Request): string | null {
  const raw = String(req.body?.provider || req.body?.llmProvider || req.body?.selectedProvider || "zhi1").toLowerCase();
  const providers: Record<string, string> = {
    zhi1: "openai",
    openai: "openai",
    zhi2: "anthropic",
    anthropic: "anthropic",
    zhi3: "deepseek",
    deepseek: "deepseek",
    zhi4: "perplexity",
    perplexity: "perplexity",
  };
  return providers[raw] || null;
}

async function consumePurchasedCredits(userId: number, provider: string | null, words: number): Promise<boolean> {
  if (!provider) return false;
  const result = await pool.query(
    `UPDATE user_credits
        SET credits = credits - $3,
            last_updated = NOW()
      WHERE user_id = $1
        AND provider = $2
        AND credits >= $3
      RETURNING credits`,
    [userId, provider, words],
  );
  return Boolean(result.rows[0]);
}

export async function initializeAccessControl(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_quotas (
      identity_key TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      actions_used INTEGER NOT NULL DEFAULT 0,
      words_reserved INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    UPDATE writing_jobs
       SET stop_requested = TRUE,
           stopped_early = TRUE,
           status = 'paused',
           error = 'Anonymous generation paused. Sign in with Google to continue.',
           updated_at = NOW()
     WHERE user_id IS NULL
       AND status IN ('pending', 'planning', 'writing', 'auditing')
  `);
}

export async function getAccessStatus(req: Request) {
  const access = await accessTier(req);
  if (access.tier === "subscriber") {
    return {
      tier: access.tier,
      subscribed: true,
      unlimited: true,
      actionsUsed: 0,
      actionsRemaining: null,
      wordsReserved: 0,
      wordsRemaining: null,
    };
  }
  const usage = await currentUsage(access.identityKey);
  const actionLimit = access.tier === "anonymous" ? ANONYMOUS_ACTION_LIMIT : SIGNED_IN_ACTION_LIMIT;
  const wordLimit = access.tier === "anonymous" ? ANONYMOUS_WORD_LIMIT : SIGNED_IN_WORD_LIMIT;
  return {
    tier: access.tier,
    subscribed: false,
    unlimited: false,
    ...usage,
    actionLimit,
    wordLimit,
    actionsRemaining: Math.max(0, actionLimit - usage.actionsUsed),
    wordsRemaining: Math.max(0, wordLimit - usage.wordsReserved),
  };
}

export async function enforcePaidAiAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const requestPath = `${req.baseUrl || ""}${req.path}`;
    if (req.method !== "POST" || !isMeteredPath(requestPath)) return next();
    const isWritingCreation = requestPath === "/api/writing/jobs" || requestPath === "/api/writing-v2/jobs";
    const access = await accessTier(req);
    const usage = access.subscribed
      ? { actionsUsed: 0, wordsReserved: 0 }
      : await currentUsage(access.identityKey);

    if (!access.subscribed && isWritingCreation) {
      const anonymous = access.tier === "anonymous";
      const actionLimit = anonymous ? ANONYMOUS_ACTION_LIMIT : SIGNED_IN_ACTION_LIMIT;
      const wordLimit = anonymous ? ANONYMOUS_WORD_LIMIT : SIGNED_IN_WORD_LIMIT;
      const previewLimit = anonymous
        ? ANONYMOUS_WRITING_PREVIEW_WORDS
        : SIGNED_IN_WRITING_PREVIEW_WORDS;
      const actionsRemaining = actionLimit - usage.actionsUsed;
      const wordsRemaining = wordLimit - usage.wordsReserved;
      if (actionsRemaining > 0 && wordsRemaining >= 50) {
        const originallyRequestedWords = requestedWritingWords(req);
        const previewWords = Math.min(originallyRequestedWords, wordsRemaining, previewLimit);
        if (previewWords < originallyRequestedWords) {
          req.body.originalRequestedWordCount = originallyRequestedWords;
          req.body.requestedWordCount = previewWords;
          req.body.forceSingleSectionPreview = true;
          req.body.previewNextAction = anonymous ? "sign-in" : "subscribe";
        }
      }
    }

    if (!req.user && await requiresSignedInDatabaseOwner(req, requestPath)) {
      return res.status(401).json({
        code: "SIGN_IN_REQUIRED",
        message: "Sign in with Google before starting database-backed megaglobal coherence. Your account owns the skeleton, section checkpoints, coherence ledger, saved draft, and final document.",
        nextAction: "sign-in",
      });
    }
    if (access.subscribed) return next();
    if (requiresSubscription(requestPath)) {
      return quotaResponse(res, access.tier as "anonymous" | "free", usage);
    }
    let words = 400;
    if (requestPath === "/api/writing/jobs" || requestPath === "/api/writing-v2/jobs") {
      words = requestedWritingWords(req);
    } else if (/^\/api\/writing(?:-v2)?\/jobs\/\d+\/(resume|redo)$/.test(requestPath)) {
      words = await requestedResumeWords(requestPath);
    } else if (requestPath === "/api/direct-model-request" && req.body?.provider === "all") {
      words = 1000;
    } else if (/coherence-global|coherence-outline-guided/.test(requestPath)) {
      words = Math.max(500, Math.min(2500, wordsIn(req.body?.text)));
    }
    const reserved = await reserveUsage(access.identityKey, access.tier as "anonymous" | "free", words);
    if (!reserved) {
      if (
        req.user
        && await consumePurchasedCredits(req.user.id, requestedProvider(req), words)
      ) {
        res.setHeader("X-Treatise-Access-Tier", "purchased-credits");
        return next();
      }
      return quotaResponse(res, access.tier as "anonymous" | "free", usage);
    }
    res.setHeader("X-Treatise-Access-Tier", access.tier);
    res.setHeader("X-Treatise-Actions-Remaining", String(Math.max(0, reserved.actionLimit - reserved.actionsUsed)));
    res.setHeader("X-Treatise-Words-Remaining", String(Math.max(0, reserved.wordLimit - reserved.wordsReserved)));
    if (req.body?.forceSingleSectionPreview) {
      res.setHeader("X-Treatise-Preview", "true");
    }
    next();
  } catch (error) {
    next(error);
  }
}