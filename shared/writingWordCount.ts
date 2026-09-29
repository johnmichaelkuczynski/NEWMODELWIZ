// PostgreSQL stores writing_jobs.requested_word_count as a signed integer.
// This is a storage boundary, not a product or subscription allowance.
export const MAX_STORED_WORD_COUNT = 2_147_483_647;

export function isValidWritingWordCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 50 && value <= MAX_STORED_WORD_COUNT;
}