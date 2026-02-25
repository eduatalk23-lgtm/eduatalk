/**
 * 관리자 플랜 관련 네비게이션 유틸리티
 *
 * 플래너, 플랜 그룹, 캠프 템플릿 간의 네비게이션 경로를 중앙화하여 관리합니다.
 */

/**
 * 플랜 그룹 네비게이션 컨텍스트
 */
export interface PlanGroupNavigationContext {
  /** 플랜 그룹 ID */
  groupId: string;
  /** 학생 ID */
  studentId: string;
  /** 캘린더 ID */
  calendarId?: string | null;
  /** 캠프 템플릿 ID (선택적) */
  campTemplateId?: string | null;
  /** 캠프 모드 여부 */
  isCampMode?: boolean;
}

/**
 * 플랜 그룹 상세 페이지에서 뒤로가기 경로 생성
 *
 * 우선순위:
 * 1. 플래너가 연결된 경우 → 플래너 페이지로 이동
 * 2. 캠프 모드인 경우 → 캠프 템플릿 참여자 목록으로 이동
 * 3. 기본값 → 대시보드로 이동
 *
 * @param context 플랜 그룹 네비게이션 컨텍스트
 * @returns 뒤로가기 경로
 */
export function getAdminPlanGroupBackPath(
  context: PlanGroupNavigationContext
): string {
  const { calendarId, studentId, campTemplateId, isCampMode } = context;

  // 캘린더 경로
  if (calendarId && studentId) {
    return getCalendarPagePath(studentId, calendarId);
  }

  // 캠프 모드인 경우 캠프 템플릿 참여자 목록으로 이동
  if (isCampMode && campTemplateId) {
    return `/admin/camp-templates/${campTemplateId}/participants`;
  }

  // 기본값: 대시보드
  return "/admin/dashboard";
}

/**
 * 뒤로가기 버튼 텍스트 생성
 *
 * @param context 플랜 그룹 네비게이션 컨텍스트
 * @returns 뒤로가기 버튼 텍스트
 */
export function getAdminPlanGroupBackLabel(
  context: PlanGroupNavigationContext
): string {
  const { calendarId, campTemplateId, isCampMode } = context;

  if (calendarId) {
    return "캘린더로 돌아가기";
  }

  if (isCampMode && campTemplateId) {
    return "참여자 목록으로";
  }

  return "대시보드로";
}

/**
 * 캘린더 페이지 경로 생성 (Calendar-First)
 *
 * @param studentId 학생 ID
 * @param calendarId 캘린더 ID
 * @param options 쿼리 파라미터 (date 등)
 * @returns 캘린더 페이지 경로
 */
export function getCalendarPagePath(
  studentId: string,
  calendarId: string,
  options?: { date?: string }
): string {
  const basePath = `/admin/students/${studentId}/plans/calendar/${calendarId}`;
  const qs = new URLSearchParams();
  if (options?.date) qs.set('date', options.date);
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

