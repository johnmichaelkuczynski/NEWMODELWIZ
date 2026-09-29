import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../db";
import { storage } from "../storage";
import { enforcePaidAiAccess } from "./accessControl";

const originalNodeEnv = process.env.NODE_ENV;
const originalPoolQuery = pool.query.bind(pool);
const originalGetUser = storage.getUser.bind(storage);
const originalGetUserSubscription = storage.getUserSubscription.bind(storage);

type QueryResult = { rows: Record<string, unknown>[] };

let queryResults: QueryResult[] = [];

function writingRequest(options: {
  user?: { id: number; username: string };
  requestedWordCount?: number;
} = {}): Request {
  return {
    method: "POST",
    baseUrl: "/api",
    path: "/writing/jobs",
    body: {
      instructions: [
        "Write a 6,999-word work.",
        "Section 1: Establish the argument.",
        "Section 2: Test the argument.",
        "Section 3: State the conclusion.",
      ].join("\n"),
      provider: "zhi1",
      requestedWordCount: options.requestedWordCount ?? 6999,
    },
    session: {},
    user: options.user,
  } as unknown as Request;
}

function responseRecorder(): {
  response: Response;
  state: { status?: number; json?: Record<string, unknown>; headers: Record<string, string> };
} {
  const state: {
    status?: number;
    json?: Record<string, unknown>;
    headers: Record<string, string>;
  } = { headers: {} };
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: Record<string, unknown>) {
      state.json = body;
      return response;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return response;
    },
  } as unknown as Response;
  return { response, state };
}

async function enforce(req: Request) {
  const { response, state } = responseRecorder();
  let continued = false;
  let nextError: unknown;
  const next: NextFunction = error => {
    continued = true;
    nextError = error;
  };
  await enforcePaidAiAccess(req, response, next);
  assert.equal(nextError, undefined);
  return { continued, state };
}

before(() => {
  process.env.NODE_ENV = "production";
});

beforeEach(() => {
  queryResults = [];
  (pool as unknown as { query: (...args: unknown[]) => Promise<QueryResult> }).query =
    async () => queryResults.shift() ?? { rows: [] };
  storage.getUser = async id => ({
    id,
    username: `access-test-${id}`,
    password: "not-used",
    email: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    createdAt: new Date(),
  });
  storage.getUserSubscription = async () => undefined;
});

after(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  (pool as unknown as { query: typeof pool.query }).query = originalPoolQuery;
  storage.getUser = originalGetUser;
  storage.getUserSubscription = originalGetUserSubscription;
});

test("production logged-out oversized multi-section writing starts a 2,000-word sign-in preview", async () => {
  queryResults = [
    { rows: [] },
    { rows: [{ actions_used: 1, words_reserved: 2000 }] },
  ];
  const req = writingRequest();

  const result = await enforce(req);

  assert.equal(result.continued, true, "the preview must reach writing job creation");
  assert.equal(req.body.requestedWordCount, 2000);
  assert.equal(req.body.originalRequestedWordCount, 6999);
  assert.equal(req.body.forceSingleSectionPreview, true);
  assert.equal(req.body.previewNextAction, "sign-in");
  assert.equal(result.state.headers["X-Treatise-Preview"], "true");
});

test("production signed-in unpaid oversized writing starts a 2,000-word subscription preview", async () => {
  queryResults = [
    { rows: [] },
    { rows: [{ actions_used: 1, words_reserved: 2000 }] },
  ];
  const req = writingRequest({ user: { id: 41, username: "free-user" } });

  const result = await enforce(req);

  assert.equal(result.continued, true, "the signed-in preview must reach writing job creation");
  assert.equal(req.body.requestedWordCount, 2000);
  assert.equal(req.body.originalRequestedWordCount, 6999);
  assert.equal(req.body.forceSingleSectionPreview, true);
  assert.equal(req.body.previewNextAction, "subscribe");
  assert.equal(result.state.headers["X-Treatise-Preview"], "true");
});

test("production logged-out 2,000-word writing remains a complete request", async () => {
  queryResults = [
    { rows: [] },
    { rows: [{ actions_used: 1, words_reserved: 2000 }] },
  ];
  const req = writingRequest({ requestedWordCount: 2000 });
  req.body.instructions = "Write a 2,000-word document as one complete work.";

  const result = await enforce(req);

  assert.equal(result.continued, true);
  assert.equal(req.body.requestedWordCount, 2000);
  assert.equal(req.body.originalRequestedWordCount, undefined);
  assert.equal(req.body.forceSingleSectionPreview, undefined);
  assert.equal(req.body.previewNextAction, undefined);
  assert.equal(result.state.headers["X-Treatise-Preview"], undefined);
});

test("production subscribers retain the complete request and megaglobal eligibility", async () => {
  storage.getUser = async id => ({
    id,
    username: "subscriber",
    password: "not-used",
    email: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "active",
    subscriptionCurrentPeriodEnd: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  const req = writingRequest({ user: { id: 42, username: "subscriber" } });

  const result = await enforce(req);

  assert.equal(result.continued, true);
  assert.equal(req.body.requestedWordCount, 6999);
  assert.equal(req.body.originalRequestedWordCount, undefined);
  assert.equal(req.body.forceSingleSectionPreview, undefined);
  assert.equal(req.body.previewNextAction, undefined);
  assert.match(req.body.instructions, /Section 3:/);
});

test("quota exhaustion is returned as a sign-in continuation boundary, not a writing failure", async () => {
  queryResults = [
    { rows: [{ actions_used: 5, words_reserved: 2000 }] },
    { rows: [] },
  ];
  const req = writingRequest({ requestedWordCount: 2000 });
  req.body.instructions = "Write a 2,000-word document as one complete work.";

  const result = await enforce(req);

  assert.equal(result.continued, false);
  assert.equal(result.state.status, 401);
  assert.equal(result.state.json?.code, "SIGN_IN_REQUIRED");
  assert.equal(result.state.json?.nextAction, "sign-in");
  assert.equal((result.state.json?.usage as Record<string, unknown>)?.actionLimit, 5);
  assert.equal("error" in (result.state.json ?? {}), false);
  assert.match(String(result.state.json?.message), /Sign in with Google/i);
});

test("signed-in quota exhaustion is returned as a subscription continuation boundary", async () => {
  queryResults = [
    { rows: [{ actions_used: 20, words_reserved: 8000 }] },
    { rows: [] },
    { rows: [] },
  ];
  const req = writingRequest({ user: { id: 43, username: "free-user" } });

  const result = await enforce(req);

  assert.equal(result.continued, false);
  assert.equal(result.state.status, 402);
  assert.equal(result.state.json?.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(result.state.json?.nextAction, "subscribe");
  assert.equal((result.state.json?.usage as Record<string, unknown>)?.actionLimit, 20);
  assert.equal("error" in (result.state.json ?? {}), false);
  assert.match(String(result.state.json?.message), /Subscribe/i);
});