// ============================================
// DOM → 줄 단위 텍스트 추출 (Python HTMLParser 방식)
// 클라이언트(브라우저) 전용
// ============================================

/** 블록 요소 태그 — 이 태그 앞뒤에서 줄바꿈 삽입 */
const BLOCK_TAGS = new Set([
  "div", "p", "tr", "td", "th", "li", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "section", "article", "header", "footer", "nav",
  "table", "thead", "tbody", "tfoot",
  "ul", "ol", "dl", "dt", "dd",
  "blockquote", "pre", "address",
]);

export function extractTextFromDom(element: Element | null): string {
  if (!element) return "";
  const parts: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // 블록 요소 시작 시 줄바꿈
    if (BLOCK_TAGS.has(tag)) {
      parts.push("\n");
    }

    for (const child of node.childNodes) {
      walk(child);
    }

    // 블록 요소 종료 시 줄바꿈
    if (BLOCK_TAGS.has(tag)) {
      parts.push("\n");
    }
  }

  walk(element);

  // 줄 단위 정리
  return parts
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}
