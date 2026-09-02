/**
 * Orders fixture results by keyword overlap so demo discovery responds to the
 * founder's actual ICP rather than returning a fixed list. A live adapter would
 * delegate this to the platform's own search ranking instead.
 */
export function rankByKeywords<T>(
  items: T[],
  toText: (item: T) => string,
  keywords: string[],
): T[] {
  if (keywords.length === 0) return items;

  const needles = keywords
    .map((keyword) => keyword.toLowerCase().trim())
    .filter((keyword) => keyword.length > 2);

  return items
    .map((item) => {
      const haystack = toText(item).toLowerCase();
      const hits = needles.filter((needle) => haystack.includes(needle)).length;
      return { item, hits };
    })
    .sort((a, b) => b.hits - a.hits)
    .map(({ item }) => item);
}
