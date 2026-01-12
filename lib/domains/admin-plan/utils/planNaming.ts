/**
 * Plan Naming Utilities
 *
 * 플랜 및 플랜 그룹 이름 자동 생성 유틸리티
 *
 * @module lib/domains/admin-plan/utils/planNaming
 */

// ============================================
// Types
// ============================================

export type ContentType = "book" | "lecture" | "custom";

export interface GeneratePlanNameInput {
  /** 과목명 (예: "수학", "국어") */
  subject?: string | null;
  /** 콘텐츠 제목 (예: "수학의 정석", "비문학 강의") */
  contentTitle: string;
  /** 시작 범위 (페이지 또는 강 번호) */
  startRange: number;
  /** 종료 범위 (페이지 또는 강 번호) */
  endRange: number;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 회차 (동일 콘텐츠 플랜 생성 순서, 2회차부터 표시) */
  round?: number;
}

export interface GeneratePlanNameResult {
  /** 플랜 그룹 이름 (회차 미포함) */
  groupName: string;
  /** 개별 플랜 이름 (동일) */
  planName: string;
  /** 표시용 이름 (회차 포함) */
  displayName: string;
}

// ============================================
// Main Functions
// ============================================

/**
 * 플랜 이름 자동 생성
 *
 * 형식: [과목] 콘텐츠명 범위 (회차)
 *
 * @example
 * // 교재
 * generatePlanName({
 *   subject: "수학",
 *   contentTitle: "수학의 정석",
 *   startRange: 100,
 *   endRange: 150,
 *   contentType: "book",
 * });
 * // => { groupName: "[수학] 수학의 정석 p.100-150", ... }
 *
 * @example
 * // 강의
 * generatePlanName({
 *   subject: "국어",
 *   contentTitle: "비문학 완성",
 *   startRange: 1,
 *   endRange: 10,
 *   contentType: "lecture",
 *   round: 2,
 * });
 * // => { displayName: "[국어] 비문학 완성 1-10강 (2회차)", ... }
 */
export function generatePlanName(input: GeneratePlanNameInput): GeneratePlanNameResult {
  const { subject, contentTitle, startRange, endRange, contentType, round } = input;

  // 과목 접두사
  const subjectPrefix = subject ? `[${subject}] ` : "";

  // 범위 표시 (타입에 따라 다름)
  const rangeDisplay = formatRange(startRange, endRange, contentType);

  // 기본 이름 조합
  const baseName = `${subjectPrefix}${contentTitle} ${rangeDisplay}`.trim();

  // 회차 표시 (2회차 이상인 경우만)
  const displayName = round && round > 1 ? `${baseName} (${round}회차)` : baseName;

  return {
    groupName: baseName,
    planName: baseName,
    displayName,
  };
}

/**
 * 범위 포맷팅
 *
 * @param startRange - 시작 범위
 * @param endRange - 종료 범위
 * @param contentType - 콘텐츠 타입
 * @returns 포맷된 범위 문자열
 *
 * @example
 * formatRange(100, 150, "book");    // => "p.100-150"
 * formatRange(1, 10, "lecture");    // => "1-10강"
 * formatRange(1, 5, "custom");      // => "1-5"
 */
export function formatRange(
  startRange: number,
  endRange: number,
  contentType: ContentType
): string {
  if (contentType === "book") {
    return `p.${startRange}-${endRange}`;
  }

  if (contentType === "lecture") {
    return `${startRange}-${endRange}강`;
  }

  // custom 또는 기타
  return `${startRange}-${endRange}`;
}

/**
 * 플랜 이름 문자열만 반환하는 간단한 버전
 *
 * PlanPayloadBuilder 등에서 사용
 */
export function generatePlanNameString(input: GeneratePlanNameInput): string {
  return generatePlanName(input).planName;
}

/**
 * 표시용 이름 문자열만 반환 (회차 포함)
 */
export function generateDisplayNameString(input: GeneratePlanNameInput): string {
  return generatePlanName(input).displayName;
}
