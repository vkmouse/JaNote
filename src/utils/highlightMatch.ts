export function highlightMatch(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const q = query.trim().toLowerCase();
  if (!q || !text) return [{ text: text || "", match: false }];

  const parts: Array<{ text: string; match: boolean }> = [];
  const lowerText = text.toLowerCase();
  let lastIndex = 0;

  let idx = lowerText.indexOf(q, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    lastIndex = idx + q.length;
    idx = lowerText.indexOf(q, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false });
  }

  return parts;
}
