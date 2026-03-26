// ============================================
// Agent System — 공통 타입
// Phase B: 오케스트레이터 + Agent 도구
// ============================================

export interface AgentContext {
  /** 인증된 관리자/컨설턴트 userId */
  userId: string;
  /** 관리자 역할 */
  role: "admin" | "consultant" | "superadmin";
  /** 테넌트 ID */
  tenantId: string | null;
  /** 대상 학생 ID */
  studentId: string;
  /** 대상 학생 이름 (시스템 프롬프트용) */
  studentName: string;
  /** 현재 학년도 (기본: 현재 연도) */
  schoolYear: number;
}

export interface AgentToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 문자열을 maxLen으로 절삭하되, 절삭 시 `[... N자 생략]` 마커를 추가하여
 * LLM이 불완전한 데이터임을 인지할 수 있게 합니다.
 */
export function truncateWithMarker(
  text: string | null | undefined,
  maxLen: number,
): string | null {
  if (!text) return null;
  if (text.length <= maxLen) return text;
  const omitted = text.length - maxLen;
  return `${text.slice(0, maxLen)}… [${omitted}자 생략]`;
}
