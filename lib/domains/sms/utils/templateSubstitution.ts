/**
 * SMS 템플릿 변수 치환 유틸리티
 * 시스템/커스텀 템플릿 모두에 범용 사용
 */

/**
 * 템플릿 내용에서 {변수명} 패턴의 변수 목록을 추출
 */
export function extractTemplateVariables(content: string): string[] {
  const matches = content.match(/\{([^}]+)\}/g);
  if (!matches) return [];

  const variables = matches.map((m) => m.slice(1, -1));
  return Array.from(new Set(variables));
}

/**
 * 템플릿 변수를 실제 값으로 치환
 */
export function substituteTemplateVariables(
  content: string,
  vars: Record<string, string>
): string {
  let result = content;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return result;
}

/**
 * 메시지 바이트 수 계산 (EUC-KR 기준)
 * - 한글/한자/일본어: 2byte
 * - 나머지 ASCII: 1byte
 */
export function calculateMessageBytes(message: string): number {
  let bytes = 0;
  for (const char of message) {
    const code = char.charCodeAt(0);
    bytes += code > 127 ? 2 : 1;
  }
  return bytes;
}

/**
 * SMS/LMS 구분
 * - SMS: 90 bytes 이하
 * - LMS: 2000 bytes 이하
 */
export function getMessageType(message: string): "SMS" | "LMS" {
  return calculateMessageBytes(message) <= 90 ? "SMS" : "LMS";
}
