# Cognitive Analysis Platform

## Overview
The Cognitive Analysis Platform is designed to analyze written text to assess the intelligence and cognitive fingerprint of authors using multi-model AI evaluation. Its primary purpose is to offer deep insights into cognitive abilities and thought processes from written content. Key capabilities include document analysis, AI detection, multi-language translation, comprehensive cognitive profiling, and intelligent text rewriting with advanced features for maximizing intelligence scores.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a monorepo structure, separating client and server components.

**UI/UX Decisions:**
- Frontend uses React with TypeScript, TailwindCSS, and shadcn/ui for a modern and responsive user interface.
- Data visualization is handled by Chart.js.
- Detailed card-based layouts are used for analysis reports.
- Supports PDF/text downloads, document upload, and output downloads.

**Technical Implementations & Feature Specifications:**
- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui, wouter, React Query, Chart.js.
- **Backend**: Express.js with TypeScript, integrating multiple LLMs, document processing (Mathpix OCR), speech-to-text (AssemblyAI), and email services (SendGrid).
- **Database**: PostgreSQL with Drizzle ORM for user, document, analysis, and cognitive profile data.
- **Core Services**:
    - **Multi-Model Intelligence Evaluation**: A 4-phase system assessing 17 cognitive dimensions, supporting genre-aware analysis.
    - **Intelligent Rewrite Function (MAXINTEL)**: Recursively optimizes text for intelligence scores, with custom instructions and external knowledge integration.
    - **GPT Bypass Humanizer**: Transforms AI-generated text to bypass AI detection.
    - **Coherence Meter**: Offers simple chunking and outline-guided processing with specialized modes:
      - **Mathematical Proof System** (Four distinct modes):
        1. **COHERENCE** - Evaluates structural coherence ONLY (logical flow, notation consistency, step justification, structural clarity). Does NOT evaluate whether the theorem is true. A well-structured proof of a false theorem can score high.
        2. **COGENCY** - Evaluates whether the theorem is TRUE and whether the proof is mathematically valid. Includes claim truth analysis, inference validity, boundary conditions, and soundness subscores. Shows counterexamples and flaws.
        3. **MAX COHERENCE** (Rewrite) - Improves structural coherence without changing mathematical content. Preserves all claims (even incorrect ones) while improving flow, notation, and organization.
        4. **MAXIMIZE TRUTH** (Rewrite) - Corrects defective proofs using Claude with extended thinking. If theorem is TRUE, fixes the proof. If FALSE, finds a similar true theorem and proves that instead. Returns theorem status, corrected proof, and key corrections.
      - **Scientific-Explanatory Coherence Type**: Performs dual assessment evaluating both logical consistency (internal contradictions, structural coherence) AND scientific accuracy (factual correctness, alignment with established science), displaying separate scores for each dimension. The REWRITE function specifically corrects pseudoscientific claims, replacing them with accurate scientific explanations.
    - **Text Model Validator**: Includes "Truth Select" and "Math Truth Select" for literal truth verification, configurable with various AI models (ZHI 1-5, default Grok). Features:
      - **Batch Mode**: Run multiple functions simultaneously with enforced aggressive settings
      - **BOTTOMLINE Function**: Synthesizes analysis results into polished final output tailored to specific audience, objective, tone, length, and emphasis. Uses intelligent weighting to prioritize intermediate results based on relevance to stated objectives.
    - **AI Chat Assistant**: Provides conversation history and context from the Zhi Database.
    - **Instruction-to-Writing Generator**: Must return within 10% above or below the requested word count and use plain text without Markdown. Prose must be as succinct and utilitarian as the instructions and subject permit, begin directly with substance, and exclude ceremonial framing or empty verbal gestures. Execute the work the user requested: the requested thesis, premises, definitions, stance, narrative facts, mathematical assumptions, and structure are assignment constraints, not invitations to substitute a different argument. Criticize or reverse them only when the user explicitly assigns that operation. When clarity conflicts with academic vagueness or self-protective qualification, always choose the stark, precise, potentially refutable claim. Philosophical prose must state its thesis early, define disputed terms by explicit contrasts or conditions, reconstruct an opponent's inference before identifying its exact error, answer strong objections directly, and avoid false balance or prestige vocabulary substituted for reasoning. Every non-self-evident substantive statement must have a nearby concrete example, case, counterexample, or application; vague categories such as "modes of expression" must name representative instances. Mathematical expressions must render with proper symbols and preserve requested Greek letters, subscripts, superscripts, relations, and operators; raw LaTeX delimiters or commands must not appear in final output or downloads. Requests over 2,000 target words must use database-backed large-scale coherence with a global blueprint, persisted sections, and an evolving continuity ledger. Quality audits are read-only: they inspect the authored draft and report remaining defects beneath it but never trigger an automatic repair, rewrite, polishing pass, or canned conclusion. Redo creates a fresh draft using prior audit findings only where compatible with the original assignment; the original assignment always controls. Keep the original essay visible while redo runs and replace it only when the new essay is complete. Stream generated work to the page in approximately 500-word installments as it is produced. For requests above 1,500 words, persist each installment and pause five seconds before starting the next. During those pauses and before every new provider request, honor “Stop and Save” immediately; mark the accumulated text complete and preserve Copy, TXT, PDF, and Word access to it. After a complete or stopped-and-saved result, provide one-click transfer of the entire generated work into the Text Model Validator input, scroll to that function, and leave the original work intact. Explicit chapter counts override length-based section heuristics; distribute the requested length across exactly the requested chapters.
    - **Independent Writing Generator**: Keep the current and independent writing engines available side by side through the Writing Engine selector until the user explicitly chooses which one to retain. The independent engine must keep its own create, read, stop, redo, generation, continuation, audit, and persistence control path and must not import or call the current writing processor. It shares only the provider credentials, database schema, and user-facing result controls.
    - **Incremental Output and Resume**: Both writing engines must publish small persisted chunks, allow Stop and Save, and resume from the exact saved database checkpoint without changing any saved bytes. Long generation pauses for 10 seconds at approximately 1,000-word boundaries. Other generated text panels use the shared progressive viewer with visible-prefix Stop, Save, Resume, Copy, and Download controls; do not describe those presentation controls as provider cancellation until their legacy synchronous endpoints have been migrated to persisted generation jobs.
    - **Conservative Reconstruction**: "Charitable Interpretation" mode for generating coherent essays articulating a text's unified argument.

## Recent Changes (December 2024)
- **Axiomatic System Transformer**: NEW - Transforms natural language theoretical text into complete formal axiomatization with three components: (1) Axiomatization with primitive terms, axioms, and defined terms, (2) Uninterpreted formal calculus with pure symbolic logic, (3) Semantic model that satisfies all axioms. Never refuses - always produces output even for difficult inputs.
- **Full Suite Pipeline**: One-click execution of the entire analysis pipeline: Batch (5 modes) → BOTTOMLINE → Objections. Shows real-time progress through each stage with visual indicators. Includes "Additional Information" field for extra context and **"Copy All Results" button** that copies all outputs (Batch + BOTTOMLINE + Objections) in one click with formatted sections.
- **Objections Function**: STANDALONE function that generates 25 likely objections with compelling counter-arguments. Can be used independently with any input text OR as a follow-up to BOTTOMLINE. Features its own audience/objective fields, custom instructions, and a "Use BOTTOMLINE Output" button for convenience. After the objections exist, provide an optional-instructions field and one-click objection-resistant rewrite. Preserve the source and objection list as separate visible results. The rewrite must retain the source's controlling position, address all 25 objections organically in a standalone document, and ignore every initial word-count ceiling so it may expand as much as necessary.
- **Batch Processing UI**: Fully implemented with color-coded stacked results display (emerald, teal, blue, orange, indigo) and per-mode status tracking
- **BOTTOMLINE Function**: Completed with three operational modes - synthesize from all batch functions, synthesize from selected functions, or synthesize from raw input only
- **Enhanced BOTTOMLINE Weighting**: Algorithm incorporates audience, tone, and emphasis parameters alongside objective keywords for intelligent result prioritization
- **Debug Logging**: Added comprehensive console logging for batch results handler to aid troubleshooting
- **Batch Mode Settings**: Enforces aggressive defaults (fidelity=aggressive, maximal formalization with axiomatic set theory, maximal truth objective enabled)
- **UI Refinements**: BOTTOMLINE panel defaults to expanded for better discoverability; Auto-Decide excluded from batch selection (single-mode only)

## External Dependencies
- **AI Service Providers**: OpenAI API (GPT-4), Anthropic API (Claude), DeepSeek API, Perplexity AI, Grok API (xAI).
- **Supporting Services**: Mathpix OCR, AssemblyAI, SendGrid, Google Custom Search, Stripe (for credit purchases), AnalyticPhilosophy.net Zhi API.
- **Database & Infrastructure**: Neon/PostgreSQL, Drizzle ORM, Replit.