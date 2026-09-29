---
name: Requested writing length
description: Delivery rule for requested word counts and internal staged generation.
---

The user's requested word count is the minimum acceptable final length, not a target that permits ten-percent under-delivery.

**Why:** A 2,000-word request previously returned 423 words because of access truncation, then 1,835 words because a ninety-percent tolerance was treated as completion. Both violated the explicit request.

**How to apply:** Continue generation until the combined document reaches at least the requested count. Internal chunks are an implementation detail and must be assembled automatically into one final document. Access rules must permit a complete 2,000-word request. Removing an input cap alone does not establish that a very large work can finish: planning, cross-section review, and progress storage must also remain bounded and resumable. Never mark a partial output complete merely because a requested number was accepted.