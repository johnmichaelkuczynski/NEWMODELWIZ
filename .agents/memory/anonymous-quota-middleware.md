---
name: Anonymous quota middleware
description: Non-obvious Express session and mounted-path requirements for enforceable anonymous usage limits.
---

Anonymous paid-API limits must use a database-backed identity stored in the session, and mounted middleware must evaluate the full path formed from `baseUrl` plus `path`.

**Why:** Express removes the mount prefix from `req.path`, so exact route-cost checks silently used generic estimates. With `saveUninitialized: false`, merely reading `sessionID` did not set a browser cookie, so anonymous requests could receive new identities and reset their allowance.

**How to apply:** Mutate the anonymous session with a random opaque identity before metering, hash that identity before database storage, normalize the mounted route path, reserve quota atomically before provider work, and verify oversized requests do not create background jobs.

Database-backed megaglobal work additionally requires an authenticated user owner before job creation or resume. This includes long or multi-section writing, its independent-engine counterpart, and persisted whole-document coherence analysis.

**Why:** A server can technically write anonymous rows, but null-owned skeletons, ledgers, checkpoints, and drafts cannot provide per-user continuity or secure ownership.

**How to apply:** Require Google authentication before creating or advancing persisted megaglobal state, store the authenticated user ID on the job, and repeat the ownership check inside the background processor as defense in depth. For a new anonymous long or multi-section writing request, first generate the largest available bounded, single-section, non-megaglobal preview; never replace the visitor's first result with an ownership error.

Anonymous writing entitlement must produce useful writing before presenting sign-in or subscription as the next step. Access limits are conversion boundaries, not failure states.

**Why:** A visitor who requests more than the anonymous allowance still needs to experience the product's output before deciding whether to create an account or pay.

**How to apply:** Clamp an oversized request to the tier's preview size, preserve the original requested length for the continuation prompt, label the result as a preview, and present access prompts as neutral continuation notices rather than failed-writing errors. Logged-out users get a short sample, signed-in unpaid users get a larger sample, and subscribers get the complete work.

The Replit development preview must automatically use its dedicated development user and receive unlimited access. Google OAuth and anonymous production quotas apply only to production visitors.

**Why:** Google OAuth is not reliably usable from the changing development preview domain; removing development auto-login prevents the owner from testing database-backed writing.

**How to apply:** Keep the bypass conditional on the development runtime and exact development username. Never let the development identity or unlimited treatment activate in production.