/**
 * Admin Plan Validation Utilities
 * 입력값 검증 함수 모음
 */

/**
 * ISO 날짜 문자열 검증 (YYYY-MM-DD)
 */
export function validateDateString(date: string): boolean {
  if (!date || typeof date !== 'string') {
    return false;
  }

  // YYYY-MM-DD 형식 확인
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  // 유효한 날짜인지 확인
  const parsed = new Date(date + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    return false;
  }

  // 파싱된 날짜가 원본과 일치하는지 확인 (2024-02-30 같은 케이스 방지)
  const [year, month, day] = date.split('-').map(Number);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
  );
}

/**
 * 날짜가 과거인지 확인 (오늘 포함)
 */
export function isDateInPast(date: string): boolean {
  if (!validateDateString(date)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date + 'T00:00:00');

  return targetDate <= today;
}

/**
 * 날짜가 미래인지 확인 (오늘 미포함)
 */
export function isDateInFuture(date: string): boolean {
  if (!validateDateString(date)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date + 'T00:00:00');

  return targetDate > today;
}

/**
 * 볼륨 범위 검증 (start < end, 양수)
 */
export function validateVolumeRange(
  start: number,
  end: number
): { valid: boolean; error?: string } {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return { valid: false, error: '시작과 끝 값은 숫자여야 합니다.' };
  }

  if (isNaN(start) || isNaN(end)) {
    return { valid: false, error: '유효하지 않은 숫자입니다.' };
  }

  if (start < 0 || end < 0) {
    return { valid: false, error: '볼륨은 0 이상이어야 합니다.' };
  }

  if (start >= end) {
    return { valid: false, error: '시작 값은 끝 값보다 작아야 합니다.' };
  }

  return { valid: true };
}

/**
 * 페이지네이션 파라미터 검증
 */
export function validatePagination(
  page: number,
  pageSize: number
): { valid: boolean; error?: string } {
  if (typeof page !== 'number' || typeof pageSize !== 'number') {
    return { valid: false, error: '페이지 값은 숫자여야 합니다.' };
  }

  if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
    return { valid: false, error: '페이지 값은 정수여야 합니다.' };
  }

  if (page < 1) {
    return { valid: false, error: '페이지는 1 이상이어야 합니다.' };
  }

  if (pageSize < 1 || pageSize > 100) {
    return { valid: false, error: '페이지 크기는 1-100 사이여야 합니다.' };
  }

  return { valid: true };
}

/**
 * 검색어 정제 (SQL injection 방지용 특수문자 이스케이프)
 */
export function sanitizeSearchTerm(search: string): string {
  if (!search || typeof search !== 'string') {
    return '';
  }

  // Supabase의 ilike에서 사용되는 특수문자 이스케이프
  return search
    .trim()
    .replace(/[%_\\]/g, (match) => '\\' + match)
    .slice(0, 100); // 최대 100자
}

/**
 * UUID 형식 검증
 */
export function validateUUID(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * 컨테이너 타입 검증
 */
export function validateContainerType(
  containerType: string
): containerType is 'daily' | 'weekly' | 'unfinished' {
  return ['daily', 'weekly', 'unfinished'].includes(containerType);
}

/**
 * 상태 타입 검증
 */
export function validatePlanStatus(
  status: string
): status is 'pending' | 'in_progress' | 'completed' {
  return ['pending', 'in_progress', 'completed'].includes(status);
}
