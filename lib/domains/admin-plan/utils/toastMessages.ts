/**
 * Admin Plan 토스트 메시지 상수 및 유틸리티
 *
 * 모달 및 컴포넌트에서 사용하는 에러/성공 메시지를 중앙 관리
 */

// ============================================
// 검증 에러 메시지 (사용자 입력 오류)
// ============================================

export const VALIDATION = {
  // 공통
  NO_SELECTION: '선택된 항목이 없습니다.',
  NO_CHANGES: '변경된 내용이 없습니다.',

  // 플랜 관련
  SELECT_PLANS: '선택된 플랜이 없습니다.',
  SELECT_DATE: '날짜를 선택해주세요.',
  SELECT_DATES: '복사할 날짜를 추가해주세요.',
  SAME_GROUP: '현재 그룹과 동일한 그룹입니다.',
  NO_PLANS_TO_DELETE: '삭제할 플랜이 없습니다.',
  CONFIRM_DELETE: '삭제를 확인해주세요.',
  SELECT_ITEMS_TO_EDIT: '변경할 항목을 선택해주세요.',

  // 블록셋 관련
  SELECT_WEEKDAYS: '요일을 선택해주세요.',
  ENTER_TIME: '시간을 입력해주세요.',
  INVALID_TIME_RANGE: '종료 시간은 시작 시간보다 늦어야 합니다.',
  ENTER_BLOCKSET_NAME: '블록셋 이름을 입력해주세요.',
  ADD_TIME_BLOCK: '최소 1개 이상의 시간 블록을 추가해주세요.',

  // 템플릿 관련
  ENTER_TEMPLATE_NAME: '템플릿 이름을 입력해주세요.',
  NO_PLANS_TO_SAVE: '저장할 플랜이 없습니다.',
  SELECT_TEMPLATE: '적용할 템플릿을 선택해주세요.',
  SELECT_STUDENTS: '적용할 학생을 선택해주세요.',

  // 콘텐츠 관련
  SELECT_CONTENT: '콘텐츠를 선택해주세요.',
} as const;

// ============================================
// 작업 실패 기본 메시지 (API 오류 fallback)
// ============================================

export const ERROR = {
  // 플랜 관련
  PLAN_LOAD: '플랜을 불러올 수 없습니다.',
  PLAN_UPDATE: '수정에 실패했습니다.',
  PLAN_DELETE: '삭제에 실패했습니다.',
  PLAN_COPY: '플랜 복사에 실패했습니다.',
  PLAN_MOVE: '플랜 이동에 실패했습니다.',
  PLAN_QUERY: '플랜 조회에 실패했습니다.',

  // 상태/날짜 변경
  STATUS_CHANGE: '상태 변경에 실패했습니다.',
  DATE_SHIFT: '날짜 이동에 실패했습니다.',
  ORDER_SAVE: '순서 저장에 실패했습니다.',

  // 일괄 작업
  BULK_UPDATE: '일괄 수정에 실패했습니다.',
  BATCH_DELETE: '일괄 삭제에 실패했습니다.',

  // 블록셋/그룹
  BLOCKSET_CREATE: '블록셋 생성에 실패했습니다.',
  GROUP_SAVE: '저장에 실패했습니다.',
  GROUP_DELETE: '삭제에 실패했습니다.',
  GROUP_COPY: '복사에 실패했습니다.',
  GROUP_ACTIVATE: '활성화에 실패했습니다.',

  // 템플릿
  TEMPLATE_SAVE: '템플릿 저장에 실패했습니다.',
  TEMPLATE_APPLY: '템플릿 적용에 실패했습니다.',
  TEMPLATE_DELETE: '템플릿 삭제에 실패했습니다.',
  TEMPLATE_UPDATE: '템플릿 수정에 실패했습니다.',
  TEMPLATE_DUPLICATE: '템플릿 복제에 실패했습니다.',

  // 의존성
  DEPENDENCY_LOAD: '의존성 조회에 실패했습니다.',
  DEPENDENCY_ADD: '의존성 추가에 실패했습니다.',
  DEPENDENCY_DELETE: '의존성 삭제에 실패했습니다.',

  // 일반
  UNKNOWN: '알 수 없는 오류가 발생했습니다.',
} as const;

// ============================================
// 성공 메시지
// ============================================

export const SUCCESS = {
  // 플랜 관련
  PLAN_UPDATED: '플랜이 수정되었습니다.',
  PLAN_DELETED: '플랜이 삭제되었습니다.',
  PLAN_COPIED: '플랜이 복사되었습니다.',

  // 상태/순서
  STATUS_CHANGED: '상태가 변경되었습니다.',
  ORDER_SAVED: '순서가 저장되었습니다.',

  // 블록셋/그룹
  BLOCKSET_CREATED: '블록셋이 생성되었습니다.',
  GROUP_SAVED: '저장되었습니다.',
  GROUP_DELETED: '삭제되었습니다.',

  // 템플릿
  TEMPLATE_SAVED: '템플릿이 저장되었습니다.',
  TEMPLATE_APPLIED: '템플릿이 적용되었습니다.',
  TEMPLATE_DELETED: '템플릿이 삭제되었습니다.',
  TEMPLATE_UPDATED: '템플릿이 수정되었습니다.',
  TEMPLATE_DUPLICATED: '템플릿이 복제되었습니다.',

  // 의존성
  DEPENDENCY_ADDED: '의존성이 추가되었습니다.',
  DEPENDENCY_DELETED: '의존성이 삭제되었습니다.',
} as const;

// ============================================
// 유틸리티 함수
// ============================================

/**
 * API 에러를 포맷팅하여 반환
 * 서버 에러 메시지가 있으면 사용하고, 없으면 fallback 사용
 *
 * @example
 * showError(formatError(result.error, ERROR.PLAN_UPDATE));
 */
export function formatError(
  serverError: string | null | undefined,
  fallback: string
): string {
  return serverError || fallback;
}

/**
 * 개수가 포함된 성공 메시지 생성
 *
 * @example
 * formatCountSuccess(5, '수정') // '5개 플랜이 수정되었습니다.'
 * formatCountSuccess(3, '삭제') // '3개 플랜이 삭제되었습니다.'
 */
export function formatCountSuccess(count: number, action: string): string {
  return `${count}개 플랜이 ${action}되었습니다.`;
}

/**
 * 날짜 이동 성공 메시지 생성
 *
 * @example
 * formatDateShiftSuccess(5, 7)  // '5개 플랜의 날짜가 7일 뒤로 이동되었습니다.'
 * formatDateShiftSuccess(3, -3) // '3개 플랜의 날짜가 3일 앞으로 이동되었습니다.'
 */
export function formatDateShiftSuccess(count: number, days: number): string {
  const direction = days > 0 ? '뒤로' : '앞으로';
  return `${count}개 플랜의 날짜가 ${Math.abs(days)}일 ${direction} 이동되었습니다.`;
}

/**
 * 상태 변경 성공 메시지 생성
 *
 * @example
 * formatStatusChangeSuccess(5, '완료') // '5개 플랜의 상태가 "완료"로 변경되었습니다.'
 */
export function formatStatusChangeSuccess(count: number, statusLabel: string): string {
  return `${count}개 플랜의 상태가 "${statusLabel}"로 변경되었습니다.`;
}

/**
 * 그룹 이동 성공 메시지 생성
 *
 * @example
 * formatMoveSuccess(3, '이동')   // '3개 플랜이 이동되었습니다.'
 * formatMoveSuccess(2, '해제')   // '2개 플랜이 해제되었습니다.'
 */
export function formatMoveSuccess(count: number, action: string): string {
  return `${count}개 플랜이 ${action}되었습니다.`;
}

/**
 * 복사 성공 메시지 생성 (여러 날짜에 복사)
 *
 * @example
 * formatCopySuccess(3, 5) // '3개 플랜이 5개 날짜에 복사되었습니다. (총 15개)'
 */
export function formatCopySuccess(planCount: number, dateCount: number): string {
  const total = planCount * dateCount;
  return `${planCount}개 플랜이 ${dateCount}개 날짜에 복사되었습니다. (총 ${total}개)`;
}

/**
 * 템플릿 적용 성공 메시지 생성
 *
 * @example
 * formatTemplateApplySuccess(10, 2) // '2명 학생에게 총 10개 플랜이 생성되었습니다.'
 * formatTemplateApplySuccess(5, 1)  // '5개 플랜이 생성되었습니다.'
 */
export function formatTemplateApplySuccess(createdCount: number, studentCount?: number): string {
  if (studentCount && studentCount > 1) {
    return `${studentCount}명 학생에게 총 ${createdCount}개 플랜이 생성되었습니다.`;
  }
  return `${createdCount}개 플랜이 생성되었습니다.`;
}

/**
 * 삭제 결과 메시지 생성 (부분 실패 포함)
 *
 * @example
 * formatDeleteResult(5, 0) // '5개가 삭제되었습니다.'
 * formatDeleteResult(3, 2) // '3개가 삭제되었습니다. (2개 실패)'
 */
export function formatDeleteResult(
  successCount: number,
  failedCount: number,
  failReason?: string
): string {
  if (failedCount === 0) {
    return `${successCount}개가 삭제되었습니다.`;
  }
  const reason = failReason ? ` (${failReason})` : '';
  return `${successCount}개가 삭제되었습니다. ${failedCount}개 삭제 실패${reason}`;
}
