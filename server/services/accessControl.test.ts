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

test("guest writing keeps the complete requested length without a preview or quota reservation", async () => {
  const req = writingRequest({ requestedWordCount: 18_000 });
  const result = await enforce(req);

  assert.equal(result.continued, true);
  assert.equal(req.body.requestedWordCount, 18_000);
  assert.equal(req.body.forceSingleSectionPreview, undefined);
  assert.equal(req.body.originalRequestedWordCount, undefined);
  assert.equal(result.state.headers["X-Treatise-Preview"], undefined);
  assert.equal(queryResults.length, 0);
});

test("the independent writer also keeps the full guest request", async () => {
  const req = writingRequest({ requestedWordCount: 75_000 });
  req.path = "/writing-v2/jobs";
  const result = await enforce(req);

  assert.equal(result.continued, true);
  assert.equal(req.body.requestedWordCount, 75_000);
  assert.equal(req.body.forceSingleSectionPreview, undefined);
});

test("a free signed-in writer is not reduced to a subscription preview", async () => {
  const req = writingRequest({ user: { id: 41, username: "free-user" } });
  const result = await enforce(req);

  assert.equal(result.continued, true);
  assert.equal(req.body.requestedWordCount, 6999);
  assert.equal(req.body.previewNextAction, undefined);
});
