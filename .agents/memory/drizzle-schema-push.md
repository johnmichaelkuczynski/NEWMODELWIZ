---
name: Non-interactive Drizzle schema pushes
description: How to handle drizzle-kit push confirmations safely in this Replit environment.
---

`drizzle-kit push` can pause for a truncate-or-preserve confirmation in the non-interactive shell, including when run with `--force`. Do not assume a zero exit code means the schema was applied when prompt text is present.

**Why:** The command returned after displaying its confirmation without applying the requested additive user-table changes, and piping a newline did not select the default.

**How to apply:** For additive schema changes, keep a versioned SQL migration and execute the same idempotent `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements directly, then verify through `information_schema`. Never choose truncation to bypass the prompt.