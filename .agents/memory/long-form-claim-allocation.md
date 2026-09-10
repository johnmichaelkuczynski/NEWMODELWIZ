---
name: Long-form claim allocation
description: Why long-form generation needs a separate claim-allocation coordinator rather than relying on rolling summaries and writer self-review.
---

Long-form sections must receive hard reservations for unique claims, examples, obligations, and handoffs before prose generation. A rolling ledger, prior-text evidence, anti-repetition prompts, and post-draft self-review are insufficient when the same model plans, writes, and judges its own work.

**Why:** Repeated live tests produced syntactically distinct paragraphs that redefined and reapplied the same concepts across chapters. The prose generator's own coherence checks often approved these drafts, while an independent whole-document evaluator and read-only audits identified severe semantic repetition. Exact or lexical deduplication removed copied paragraphs but did not solve the repeated-argument problem.

**How to apply:** Use a separate coordinator to allocate claims and examples globally, reject overlap before prose generation, and verify each section against actual prior manuscript evidence. Do not accept a completed status when the global coherence gate remains unsatisfied.