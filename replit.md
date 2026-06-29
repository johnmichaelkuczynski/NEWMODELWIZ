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
    - **Conservative Reconstruction**: "Charitable Interpretation" mode for generating coherent essays articulating a text's unified argument.

## Recent Changes (December 2024)
- **Axiomatic System Transformer**: NEW - Transforms natural language theoretical text into complete formal axiomatization with three components: (1) Axiomatization with primitive terms, axioms, and defined terms, (2) Uninterpreted formal calculus with pure symbolic logic, (3) Semantic model that satisfies all axioms. Never refuses - always produces output even for difficult inputs.
- **Full Suite Pipeline**: One-click execution of the entire analysis pipeline: Batch (5 modes) → BOTTOMLINE → Objections. Shows real-time progress through each stage with visual indicators. Includes "Additional Information" field for extra context and **"Copy All Results" button** that copies all outputs (Batch + BOTTOMLINE + Objections) in one click with formatted sections.
- **Objections Function**: STANDALONE function that generates 25 likely objections with compelling counter-arguments. Can be used independently with any input text OR as a follow-up to BOTTOMLINE. Features its own audience/objective fields, custom instructions, and a "Use BOTTOMLINE Output" button for convenience.
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