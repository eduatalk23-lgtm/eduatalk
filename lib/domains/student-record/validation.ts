// ============================================
// 생기부 도메인 검증
// NEIS 바이트 카운팅, 글자수 제한, 공통과목 쌍, 이모지 감지
// ============================================

/**
 * NEIS 바이트 계산 (정본 구현)
 *
 * NEIS "500자" 제한은 실제로 1,500바이트(Byte) 제한이다.
 * - 한글: 1자 = 3바이트
 * - 영문/숫자/공백/문장부호: 1자 = 1바이트
 * - 줄바꿈(엔터): 1회 = 2바이트 (NEIS 시스템 기준)
 *
 * 주의: DB octet_length(content)와는 줄바꿈 부분이 다를 수 있음.
 * (DB는 LF=1B, NEIS는 줄바꿈=2B)
 */
export function countNeisBytes(text: string): number {
  // CRLF/CR → LF 로 정규화하여 줄바꿈 1회를 일관되게 처리
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let bytes = 0;
  for (const char of normalized) {
    const code = char.codePointAt(0)!;
    if (code === 0x000A) bytes += 2;                           // LF → 줄바꿈 1회 = 2B (NEIS 기준)
    else if (code >= 0xAC00 && code <= 0xD7A3) bytes += 3;    // 한글 완성형
    else if (code >= 0x3131 && code <= 0x318E) bytes += 3;    // 한글 자모
    else if (code >= 0x4E00 && code <= 0x9FFF) bytes += 3;    // CJK 한자
    else if (code >= 0xFF01 && code <= 0xFF5E) bytes += 3;    // 전각 특수문자
    else if (code <= 0x007F) bytes += 1;                       // ASCII (영문/숫자/공백/문장부호)
    else if (code >= 0x10000) bytes += 4;                      // 4B (이모지 등)
    else bytes += 3;                                            // 기타 → 3B (안전 쪽)
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
 *
 * NEIS의 "500자" 제한은 실제로 바이트 기준 (500 × 3 = 1,500B).
 * 영문/공백이 많으면 500자를 넘어도 바이트 제한 이내일 수 있다.
 * → isOverByte가 실제 NEIS 기준 초과 여부.
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
  isOver: boolean; // NEIS 기준 초과 (= isOverByte)
  invalidChars: { char: string; position: number }[];
} {
  const chars = content.length;
  const bytes = countNeisBytes(content);
  const byteLimit = charLimit * 3;
  const isOverByte = bytes > byteLimit;
  return {
    chars,
    bytes,
    charLimit,
    byteLimit,
    isOverChar: chars > charLimit,
    isOverByte,
    isOver: isOverByte, // NEIS 기준 = 바이트 기준
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
