---
name: Unbounded coherence analysis
description: Durable protocol for evaluating a document that exceeds one model request without losing whole-document scope.
---

Never reject a document as too large for coherence analysis or substitute independent chunk judgments. Treat size as a routing decision: checkpoint bounded local maps, fuse them hierarchically into one immutable global skeleton, evaluate every chunk against that skeleton and cumulative prior findings, then synthesize one document-level verdict.

**Why:** Independent chunk analysis cannot detect contradictions, terminology drift, repeated argumentation, or broken dependencies across distant sections. Streaming alone prevents ordinary request timeouts but still loses in-flight work on a process restart.

**How to apply:** Persist the source chunks, maps, skeleton, cross-chunk deltas, progress, and final report after each provider call. Resume from the first missing checkpoint after interruption. Split on ordinary line boundaries and subdivide oversized paragraphs so source formatting cannot bypass bounded processing.