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
  /** 클라이언트 UI 상태 스냅샷 (문맥 인식용, null이면 미제공) */
  uiState: import("./ui-state").UIStateSnapshot | null;

  // ── 학생 프로필 (도메인 지식 조건부 주입용, 모두 optional) ──
  /** 학생 현재 학년 (1~3) */
  studentGrade?: number | null;
  /** 학교명 */
  schoolName?: string | null;
  /** 학교 유형 코드 (general, science, autonomous_private 등) */
  schoolCategory?: string | null;
  /** 희망 전공 */
  targetMajor?: string | null;
  /** 교육과정 ("2015 개정" | "2022 개정" 등) */
  curriculumRevision?: string | null;
}

export interface AgentToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** LLM이 재시도 여부를 판단할 수 있도록 */
  retryable?: boolean;
  /** LLM에게 다음 행동을 안내 */
  actionHint?: string;
}

/** 에러 반환 헬퍼 — LLM이 복구 판단할 수 있는 구조화된 에러 */
export function toolError(
  error: string,
  opts?: { retryable?: boolean; actionHint?: string },
): AgentToolResult<never> {
  return {
    success: false,
    error,
    retryable: opts?.retryable ?? false,
    actionHint: opts?.actionHint,
  };
}

/** 공통 에러 패턴 */
export const TOOL_ERRORS = {
  NO_TENANT: toolError("테넌트 정보가 없습니다.", { actionHint: "관리자에게 문의하세요." }),
  NO_DATA: (what: string) => toolError(`${what} 데이터가 없습니다.`, { actionHint: "먼저 데이터를 입력하거나 파이프라인을 실행하세요." }),
  AI_FORMAT: toolError("AI 응답 형식 오류.", { retryable: true, actionHint: "다시 시도하세요." }),
  AI_RATE_LIMIT: toolError("AI 서비스 요청 한도 초과.", { retryable: true, actionHint: "잠시 후 다시 시도하세요." }),
  DB_ERROR: (what: string) => toolError(`${what} DB 조회 실패.`, { retryable: true, actionHint: "다시 시도하세요." }),
};

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
