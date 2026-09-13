---
name: Streaming response contracts
description: Rules for converting completed AI responses to incremental transport without changing generation behavior or breaking callers.
---

Add streaming at the provider boundary while preserving the existing prompt builder, presets, cleanup, fallback order, and final metadata. Treat a JSON-to-NDJSON response change as an API migration: find and update every direct component and exported client helper that consumes the endpoint.

**Why:** A transport-only change can silently alter output quality if it bypasses the established provider service, and secondary callers can break even when the primary screen works.

**How to apply:** Before changing an AI endpoint response format, inventory all callers. Keep ordinary non-generating endpoints on JSON, stream real provider chunks, emit one authoritative final record, and ensure loading state clears in both success and failure paths.