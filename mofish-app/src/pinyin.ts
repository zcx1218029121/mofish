// @ts-ignore - pinyin-pro types are incorrect
import { pinyin } from "pinyin-pro";

/**
 * Convert Chinese text to full pinyin
 * e.g. "全职高手" -> "quanzhigaoshou"
 */
function toFullPinyin(text: string): string {
  const result = pinyin(text, {
    toneType: "none",
    type: "array",
  });
  return result.join("");
}

/**
 * Convert Chinese text to pinyin initials
 * e.g. "全职高手" -> "QZGS"
 */
function toPinyinInitials(text: string): string {
  const result = pinyin(text, {
    toneType: "none",
    type: "array",
    pattern: "first",
  });
  return result.join("").toUpperCase();
}

/**
 * Search books by title or pinyin initials
 * e.g. search "qzgj" matches "全职高手"
 */
export function searchBooks<T extends { title: string }>(
  books: T[],
  query: string
): T[] {
  if (!query.trim()) {
    return books;
  }

  const lowerQuery = query.toLowerCase();

  return books.filter((book) => {
    const title = book.title.toLowerCase();
    // Direct title match
    if (title.includes(lowerQuery)) {
      return true;
    }
    // Pinyin initials match (e.g., "qzgj" -> "QZGS")
    const initials = toPinyinInitials(book.title);
    if (initials.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // Full pinyin match (e.g., "quanzhigaoshou")
    const fullPinyin = toFullPinyin(book.title);
    if (fullPinyin.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    return false;
  });
}

export { toPinyinInitials, toFullPinyin as toPinyin };
