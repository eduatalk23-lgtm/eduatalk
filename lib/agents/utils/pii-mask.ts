// ============================================
// PII 마스킹 유틸리티
// 벡터 저장 전 민감정보를 마스킹하여 테넌트 간 노출 방지
// ============================================

/**
 * 전화번호 패턴 (한국)
 * - 010-1234-5678 / 010.1234.5678 / 01012345678
 * - 02-1234-5678 / 031-123-4567
 */
const PHONE_PATTERNS = [
  /01[016789]-?\d{3,4}-?\d{4}/g,
  /0\d{1,2}-?\d{3,4}-?\d{4}/g,
];

/**
 * 이메일 패턴
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * 성적 패턴 (순서 중요: 구체적 → 일반적)
 * - "내신 1등급", "내신1.5등급", "내신 2.3" (등급 포함/미포함 모두)
 * - "1등급", "2.5등급"
 * - "95점", "100점"
 */
const GRADE_PATTERNS = [
  /내신\s*\d+\.?\d*\s*(?:등급)?/g, // "내신 1등급", "내신1.5등급", "내신 2.3"
  /\d+\.?\d*\s*등급/g,         // "1등급", "2.5등급"
  /\d{2,3}\s*점/g,             // "95점", "100점"
];

/**
 * 벡터 저장 전 PII를 마스킹한다.
 *
 * 마스킹 대상:
 * - 전화번호 (010-XXXX-XXXX 등) -> [연락처]
 * - 이메일 (user@example.com) -> [연락처]
 * - 성적 패턴 (N등급, NN점, 내신 N.N) -> [성적]
 *
 * 한글 이름은 정확도가 낮으므로 SKIP.
 * 대신 저장 시 명시적 필드(student_name 등)를 제거하는 방식으로 처리.
 */
export function maskPII(text: string): string {
  let result = text;

  // 1. 전화번호 마스킹
  for (const pattern of PHONE_PATTERNS) {
    result = result.replace(pattern, "[연락처]");
  }

  // 2. 이메일 마스킹
  result = result.replace(EMAIL_PATTERN, "[연락처]");

  // 3. 성적 패턴 마스킹
  for (const pattern of GRADE_PATTERNS) {
    result = result.replace(pattern, "[성적]");
  }

  // 연속 마스킹 태그 정리: "[연락처] [연락처]" -> "[연락처]"
  result = result.replace(/(\[연락처\]\s*){2,}/g, "[연락처] ");
  result = result.replace(/(\[성적\]\s*){2,}/g, "[성적] ");

  return result.trim();
}

/**
 * 케이스 저장용 필드 마스킹.
 * diagnosis_summary, strategy_summary, key_insights 각각에 maskPII 적용.
 */
export function maskCaseFields(fields: {
  diagnosisSummary: string;
  strategySummary: string;
  keyInsights: string[];
}): {
  diagnosisSummary: string;
  strategySummary: string;
  keyInsights: string[];
} {
  return {
    diagnosisSummary: maskPII(fields.diagnosisSummary),
    strategySummary: maskPII(fields.strategySummary),
    keyInsights: fields.keyInsights.map(maskPII),
  };
}
