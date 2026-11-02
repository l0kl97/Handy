/**
 * Word count, the same rules as the Rust stats (dictation_stats.rs
 * `count_words`): whitespace separates words; in Chinese/Japanese each
 * character counts as a word; punctuation alone is not a word.
 */
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/u;
const CJK_ALL = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/gu;
const OTHER_ALNUM = /[\p{L}\p{N}]/u;

export const countWords = (text: string | null | undefined): number => {
  if (!text) return 0;
  let words = 0;
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const cjk = token.match(CJK_ALL)?.length ?? 0;
    const hasOther = [...token].some(
      (c) => OTHER_ALNUM.test(c) && !CJK.test(c),
    );
    words += cjk + (hasOther ? 1 : 0);
  }
  return words;
};
