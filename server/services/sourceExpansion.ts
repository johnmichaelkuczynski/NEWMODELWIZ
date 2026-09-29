export function sourceWordCount(source: string | null | undefined): number {
  const trimmed = source?.trim() || "";
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function expandedWordTarget(requested: number, source: string | null | undefined): number {
  const minimum = Math.ceil(sourceWordCount(source) * 1.5);
  const target = Math.max(requested, minimum);
  if (target > 100_000) {
    throw new Error(`This source requires at least ${minimum.toLocaleString()} output words under the 1.5× rule, above the current 100,000-word job limit.`);
  }
  return target;
}

export function sourcePassage(source: string, sectionIndex: number, sectionCount: number): string {
  const words = source.trim().split(/\s+/);
  if (words.length <= 1_800) return source.trim();
  const start = Math.floor(sectionIndex * words.length / sectionCount);
  const end = Math.ceil((sectionIndex + 1) * words.length / sectionCount);
  const overlap = Math.min(100, Math.floor((end - start) / 6));
  return `SOURCE WORDS ${Math.max(0, start - overlap) + 1}–${Math.min(words.length, end + overlap)} OF ${words.length}; SECTION ${sectionIndex + 1} OF ${sectionCount}. The adjacent overlap is for continuity, not a request to repeat it.\n${words.slice(Math.max(0, start - overlap), Math.min(words.length, end + overlap)).join(" ")}`;
}

export function sourceBlocks(source: string, blockWords = 3_000): string[] {
  const words = source.trim().split(/\s+/);
  if (!source.trim()) return [];
  const blocks: string[] = [];
  for (let start = 0; start < words.length; start += blockWords) {
    blocks.push(`SOURCE WORDS ${start + 1}–${Math.min(start + blockWords, words.length)}:\n${words.slice(start, start + blockWords).join(" ")}`);
  }
  return blocks;
}
