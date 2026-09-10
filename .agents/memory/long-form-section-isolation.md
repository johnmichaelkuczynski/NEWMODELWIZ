---
name: Long-form section isolation
description: Prevent explicit multi-part writing requests from leaking, duplicating, or prematurely answering later sections.
---

For explicitly numbered long-form works, each generated chapter or section must receive only its own directive, applicable global standards, and continuity from already completed sections. Do not expose it to future-section blueprints through drafting, continuation, repair, or polishing paths.

**Why:** Future-section context repeatedly caused models to preview later concepts, duplicate chapter headings, begin rebuttals inside objection chapters, and omit the final required section. Isolating only the initial draft was insufficient because continuation prompts could reintroduce the complete blueprint.

**How to apply:** Keep all generation and repair paths section-scoped. Validate ordered headings deterministically, reserve cross-document callbacks for final assembly, and treat “minimum/at least” word counts as hard floors.