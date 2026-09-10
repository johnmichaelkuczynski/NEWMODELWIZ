---
name: Long-form claim allocation
description: Why long-form generation needs a separate claim-allocation coordinator rather than relying on rolling summaries and writer self-review.
---

Long-form sections must receive hard reservations for unique claims, examples, obligations, and handoffs before prose generation. Those reservations must be executed as machine-controlled slots, not merely included in a prose prompt. A rolling ledger, prior-text evidence, anti-repetition prompts, and post-draft self-review are insufficient.

**Why:** Repeated live tests produced syntactically distinct paragraphs that redefined and reapplied the same concepts across chapters. Even with separate planning, judgment, and repair models plus paragraph-level instructions, a free-form section writer generated unallocated parallel examples and repeated conclusions. Exact or lexical deduplication removed copied paragraphs but did not solve the repeated-argument problem.

**How to apply:** Use a separate coordinator to allocate claims and examples globally. Persist and generate one approved paragraph slot at a time, reject prose outside the active slot, and advance only after the slot's unique output claim passes against prior manuscript evidence. Do not accept a completed status when the global coherence gate remains unsatisfied.