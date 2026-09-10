---
name: Unicode math in PDF exports
description: Font requirement for reliable mathematical notation in generated prose PDFs.
---

Use a full Unicode font for prose PDFs that contain mathematical notation. Do not assume jsPDF's standard fonts or a single KaTeX text font cover Greek letters, subscripts, arrows, relations, and set symbols together.

**Why:** Both standard PDF fonts and partial math fonts can silently omit selected glyphs while rendering others, producing plausible but mathematically damaged exports. Text extraction alone and successful PDF creation do not prove visual correctness.

**How to apply:** When changing PDF generation or fonts, verify a rendered page and extracted text containing Greek, subscripted variables, arrows, inequality, and set-membership symbols.