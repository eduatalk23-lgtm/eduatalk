// ============================================
// 생기부 도메인 검증
// NEIS 바이트 카운팅, 글자수 제한, 공통과목 쌍, 이모지 감지
// ============================================

/**
 * NEIS 바이트 계산 (정본 구현)
 *
 * NEIS 2.0 이후 UTF-8 기반이지만, 글자수 제한은 "한글 1자 = 3바이트" 기준.
 * DB의 GENERATED COLUMN `octet_length(content)`과 일치하되,
 * CRLF/이모지 등 edge case를 명시적으로 처리한다.
 */
export function countNeisBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0xAC00 && code <= 0xD7A3) bytes += 3;       // 한글 완성형
    else if (code >= 0x3131 && code <= 0x318E) bytes += 3;   // 한글 자모
    else if (code >= 0x4E00 && code <= 0x9FFF) bytes += 3;   // CJK 한자
    else if (code >= 0xFF01 && code <= 0xFF5E) bytes += 3;   // 전각 특수문자
    else if (code === 0x000D || code === 0x000A) bytes += 1;  // CR/LF
    else if (code <= 0x007F) bytes += 1;                      // ASCII
    else if (code >= 0x10000) bytes += 4;                     // 4B (이모지 등)
    else bytes += 3;                                           // 기타 → 3B (안전 쪽)
  }
  return bytes;
}

/**
 * NEIS 입력 불가 문자 감지 (이모지, 특수 유니코드)
 */
export function detectNeisInvalidChars(text: string): { char: string; position: number }[] {
  const invalid: { char: string; position: number }[] = [];
  let i = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0x10000) {
      invalid.push({ char, position: i });
    }
    i++;
  }
  return invalid;
}

/**
 * NEIS 글자수/바이트 종합 검증
 */
export function validateNeisContent(
  content: string,
  charLimit: number,
): {
  chars: number;
  bytes: number;
  charLimit: number;
  byteLimit: number;
  isOverChar: boolean;
  isOverByte: boolean;
  invalidChars: { char: string; position: number }[];
} {
  const chars = content.length;
  const bytes = countNeisBytes(content);
  const byteLimit = charLimit * 3;
  return {
    chars,
    bytes,
    charLimit,
    byteLimit,
    isOverChar: chars > charLimit,
    isOverByte: bytes > byteLimit,
    invalidChars: detectNeisInvalidChars(content),
  };
}

/**
 * 줄바꿈 정규화 (CRLF → LF)
 * DB 저장 전 호출하여 content_bytes(octet_length)와 countNeisBytes() 결과 일치 보장
 */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
