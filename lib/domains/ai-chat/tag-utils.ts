/**
 * Phase B-3 이월: 태그 추출 유틸 (client/server 공용)
 *
 * "use server" 파일은 동기 export 불가하므로 별도 모듈로 분리.
 */

/** 한글/영문/숫자/_/- 1~30자. 공백이나 '#' 포함 불가. */
const TAG_PATTERN = /#([a-zA-Z가-힣0-9_-]{1,30})/g;

export function extractTagsFromText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TAG_PATTERN)) {
    const raw = m[1];
    if (!raw) continue;
    out.add(raw.toLowerCase());
  }
  return Array.from(out);
}
