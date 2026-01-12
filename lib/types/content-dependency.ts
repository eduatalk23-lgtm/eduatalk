/**
 * 콘텐츠 의존성(선수학습) 관련 타입 정의
 */

/**
 * 콘텐츠 타입
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 의존성 범위
 * - global: 전역 적용 (모든 플랜에 적용)
 * - plan_group: 특정 플랜 그룹에만 적용
 */
export type DependencyScope = "global" | "plan_group";

/**
 * 콘텐츠 의존성 정보
 */
export interface ContentDependency {
  id: string;
  tenantId: string;
  /** 선수 콘텐츠 ID (먼저 학습해야 함) */
  prerequisiteContentId: string;
  prerequisiteContentType: ContentType;
  /** 선수 콘텐츠 제목 (조인으로 가져옴) */
  prerequisiteTitle?: string;
  /** 의존 콘텐츠 ID (선수 콘텐츠 이후에 학습) */
  dependentContentId: string;
  dependentContentType: ContentType;
  /** 의존 콘텐츠 제목 (조인으로 가져옴) */
  dependentTitle?: string;
  /** 의존성 범위 */
  scope: DependencyScope;
  /** plan_group scope일 때 플랜 그룹 ID */
  planGroupId?: string;
  /** 메모 */
  note?: string;
  createdAt: string;
  createdBy?: string;
}

/**
 * 의존성 생성/수정 입력
 */
export interface ContentDependencyInput {
  prerequisiteContentId: string;
  prerequisiteContentType: ContentType;
  dependentContentId: string;
  dependentContentType: ContentType;
  scope?: DependencyScope;
  planGroupId?: string;
  note?: string;
}

/**
 * 의존성 위반 타입
 * - order_violation: 순서 위반 (선수 콘텐츠가 의존 콘텐츠보다 뒤에 배치됨)
 * - missing_prerequisite: 선수 콘텐츠 누락 (의존 콘텐츠만 있고 선수 콘텐츠가 플랜에 없음)
 */
export type DependencyViolationType = "order_violation" | "missing_prerequisite";

/**
 * 의존성 위반 정보
 */
export interface DependencyViolation {
  /** 선수 콘텐츠 ID */
  prerequisiteContentId: string;
  /** 선수 콘텐츠 제목 */
  prerequisiteTitle: string;
  /** 의존 콘텐츠 ID */
  dependentContentId: string;
  /** 의존 콘텐츠 제목 */
  dependentTitle: string;
  /** 위반 타입 */
  type: DependencyViolationType;
  /** 사용자에게 표시할 메시지 */
  message: string;
  /** 심각도 (항상 warning) */
  severity: "warning";
}

/**
 * 의존성 검증 결과
 */
export interface DependencyValidationResult {
  /** 유효 여부 (경고만 모드이므로 항상 true) */
  valid: boolean;
  /** 위반 목록 */
  violations: DependencyViolation[];
}

/**
 * 콘텐츠와 순서 정보 (검증용)
 */
export interface ContentWithOrder {
  contentId: string;
  contentType: ContentType;
  /** 콘텐츠 순서 (0부터 시작) */
  displayOrder: number;
  /** 콘텐츠 제목 (선택적) */
  title?: string;
}

/**
 * 의존성 조회 옵션
 */
export interface GetDependenciesOptions {
  /** 특정 플랜 그룹에 해당하는 의존성도 포함 */
  planGroupId?: string;
  /** global scope 의존성 포함 여부 (기본: true) */
  includeGlobal?: boolean;
}

/**
 * 의존성 CRUD 응답
 */
export interface ContentDependencyResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
