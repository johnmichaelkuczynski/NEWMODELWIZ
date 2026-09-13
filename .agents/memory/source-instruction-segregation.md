---
name: Source–instruction segregation
description: Strict boundary between user writing directives and uploaded source documents.
---

Uploaded source documents must remain separate from writing instructions in the interface, API payload, persistence layer, structural parsing, retries, and resumes.

**Why:** Source prose can contain headings, numbers, imperatives, and references such as “Chapter 18.” Treating that prose as instructions caused the engine to invent structural requirements and reject otherwise valid writing.

**How to apply:** Parse word count, chapter count, titles, standards, and directives only from the instruction field. Supply source text to providers in an explicitly separate evidence block. Preserve the distinction through every writing engine and job lifecycle operation.