import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * 필터 파라미터 업데이트 (Shallow Routing)
 * 
 * URL 쿼리 파라미터를 업데이트하되 페이지 새로고침 없이 URL만 변경합니다.
 * scroll: false 옵션으로 스크롤 점프도 방지합니다.
 * 
 * @param router Next.js App Router 인스턴스
 * @param pathname 현재 경로명
 * @param key 업데이트할 쿼리 파라미터 키
 * @param value 업데이트할 값 (null이면 삭제)
 * @param preserveParams 유지할 파라미터 키 목록 (기본값: ['tab'])
 */
export function updateFilterParams(
  router: AppRouterInstance,
  pathname: string,
  key: string,
  value: string | null,
  preserveParams: string[] = ["tab"]
): void {
  const params = new URLSearchParams(window.location.search);

  // 유지할 파라미터 보존
  const preserved: Record<string, string> = {};
  preserveParams.forEach((preserveKey) => {
    const preservedValue = params.get(preserveKey);
    if (preservedValue) {
      preserved[preserveKey] = preservedValue;
    }
  });

  // 새 파라미터 객체 생성
  const newParams = new URLSearchParams();

  // 유지할 파라미터 먼저 추가
  Object.entries(preserved).forEach(([k, v]) => {
    newParams.set(k, v);
  });

  // 기존 파라미터 복사 (유지할 파라미터 제외)
  params.forEach((v, k) => {
    if (!preserveParams.includes(k) && k !== key) {
      newParams.set(k, v);
    }
  });

  // 새 값 설정 또는 삭제
  if (value) {
    newParams.set(key, value);
  } else {
    newParams.delete(key);
  }

  // Shallow Routing 적용 (scroll: false로 스크롤 점프 방지)
  const queryString = newParams.toString();
  router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
    scroll: false,
  });
}

/**
 * 여러 필터 파라미터를 한 번에 업데이트
 * 
 * @param router Next.js App Router 인스턴스
 * @param pathname 현재 경로명
 * @param updates 업데이트할 키-값 쌍 (값이 null이면 삭제)
 * @param preserveParams 유지할 파라미터 키 목록
 */
export function updateMultipleFilterParams(
  router: AppRouterInstance,
  pathname: string,
  updates: Record<string, string | null>,
  preserveParams: string[] = ["tab"]
): void {
  const params = new URLSearchParams(window.location.search);

  // 유지할 파라미터 보존
  const preserved: Record<string, string> = {};
  preserveParams.forEach((preserveKey) => {
    const preservedValue = params.get(preserveKey);
    if (preservedValue) {
      preserved[preserveKey] = preservedValue;
    }
  });

  // 새 파라미터 객체 생성
  const newParams = new URLSearchParams();

  // 유지할 파라미터 먼저 추가
  Object.entries(preserved).forEach(([k, v]) => {
    newParams.set(k, v);
  });

  // 기존 파라미터 복사 (유지할 파라미터와 업데이트할 키 제외)
  params.forEach((v, k) => {
    if (!preserveParams.includes(k) && !(k in updates)) {
      newParams.set(k, v);
    }
  });

  // 새 값들 설정 또는 삭제
  Object.entries(updates).forEach(([key, value]) => {
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
  });

  // Shallow Routing 적용
  const queryString = newParams.toString();
  router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
    scroll: false,
  });
}

/**
 * 모든 필터 파라미터 초기화
 * 
 * @param router Next.js App Router 인스턴스
 * @param pathname 현재 경로명
 * @param preserveParams 유지할 파라미터 키 목록
 */
export function clearFilterParams(
  router: AppRouterInstance,
  pathname: string,
  preserveParams: string[] = ["tab"]
): void {
  const params = new URLSearchParams(window.location.search);
  const newParams = new URLSearchParams();

  // 유지할 파라미터만 보존
  preserveParams.forEach((preserveKey) => {
    const preservedValue = params.get(preserveKey);
    if (preservedValue) {
      newParams.set(preserveKey, preservedValue);
    }
  });

  const queryString = newParams.toString();
  router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
    scroll: false,
  });
}

