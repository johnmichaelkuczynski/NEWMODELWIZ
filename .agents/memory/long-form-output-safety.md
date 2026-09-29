---
name: Long-form output safety
description: How to preserve recoverable writing drafts without exposing internal planning text as finished prose.
---

Long-form formatting and content checks must apply to every user-visible output state, including streamed progress, paused drafts, failed jobs, and final assembly. Preserve the raw draft in a recoverable checkpoint, but do not use that checkpoint as the displayed manuscript when it contains planning instructions.

**Why:** A failed generation displayed its raw numbered paragraph allocation and next-section instructions even though final structural validation had rejected the text. A final-only guard could not protect progress or error views.

**How to apply:** Treat persisted recovery text and displayable prose as separate surfaces. When a draft is unsafe or underlength, keep the checkpoint for retry and withhold the displayed manuscript rather than implying it is complete.