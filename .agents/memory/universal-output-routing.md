---
name: Universal output routing
description: Product rule and architecture for moving generated text among all AI functions.
---

Every generated text result must be reusable as input for every AI function, including the function that generated it.

**Why:** Outputs are intermediate intellectual material, not terminal reports. Excluding the originating function prevents recursive revision, while per-component destination lists drift and make capabilities inconsistent.

**How to apply:** Use one shared destination registry and routing event for all output controls. Each destination must populate its real input state and focus or reveal that input. Any new function or output renderer must join the shared registry rather than defining a private subset.