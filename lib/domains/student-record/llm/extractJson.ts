/**
 * AI 응답에서 JSON 문자열을 안전하게 추출
 *
 * 처리 순서:
 * 1. ```json ... ``` 마크다운 펜스 제거
 * 2. 펜스 매칭 실패 시 첫 번째 { ~ 마지막 } 또는 [ ~ ] 범위 추출
 * 3. 추출된 문자열을 JSON.parse
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJson<T = any>(raw: string): T {
  let str = raw.trim();

  // 1단계: 마크다운 코드 펜스 제거 (```json ... ``` 또는 ``` ... ```)
  const fenceMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  }

  // 2단계: 여전히 JSON이 아니면 첫 {/[ ~ 마지막 }/] 범위 추출
  if (!str.startsWith("{") && !str.startsWith("[")) {
    const firstBrace = str.indexOf("{");
    const firstBracket = str.indexOf("[");
    let start = -1;
    let end = -1;

    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = str.lastIndexOf("}");
    } else if (firstBracket >= 0) {
      start = firstBracket;
      end = str.lastIndexOf("]");
    }

    if (start >= 0 && end > start) {
      str = str.slice(start, end + 1);
    }
  }

  return JSON.parse(str) as T;
}
