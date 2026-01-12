/**
 * 콘텐츠 의존성 검증 서비스
 * 플랜 내 콘텐츠들의 선수학습 순서를 검증합니다.
 */

import type {
  ContentDependency,
  ContentWithOrder,
  DependencyViolation,
  DependencyValidationResult,
} from "@/lib/types/content-dependency";
import { getDependenciesForContents } from "../actions";

/**
 * 콘텐츠 의존성 검증
 * 주어진 콘텐츠들의 순서가 의존성 규칙을 준수하는지 검증합니다.
 *
 * @param contents - 검증할 콘텐츠 목록 (순서 포함)
 * @param tenantId - 테넌트 ID
 * @param planGroupId - 플랜 그룹 ID (선택적, 그룹 범위 의존성 포함용)
 * @returns 검증 결과 (항상 valid=true, 위반은 warnings로 반환)
 */
export async function validateContentDependencies(
  contents: ContentWithOrder[],
  tenantId: string,
  planGroupId?: string
): Promise<DependencyValidationResult> {
  // 콘텐츠가 없거나 1개면 검증 불필요
  if (contents.length <= 1) {
    return { valid: true, violations: [] };
  }

  // 1. 콘텐츠 ID 추출
  const contentIds = contents.map((c) => c.contentId);

  // 2. 관련 의존성 조회
  const dependencies = await getDependenciesForContents(
    contentIds,
    tenantId,
    planGroupId
  );

  if (dependencies.length === 0) {
    return { valid: true, violations: [] };
  }

  // 3. 순서 맵 생성 (contentId -> displayOrder)
  const orderMap = new Map<string, number>();
  const titleMap = new Map<string, string>();

  for (const content of contents) {
    orderMap.set(content.contentId, content.displayOrder);
    if (content.title) {
      titleMap.set(content.contentId, content.title);
    }
  }

  // 4. 의존성 위반 검사
  const violations: DependencyViolation[] = [];

  for (const dep of dependencies) {
    const prereqOrder = orderMap.get(dep.prerequisiteContentId);
    const depOrder = orderMap.get(dep.dependentContentId);

    const prereqTitle =
      dep.prerequisiteTitle ||
      titleMap.get(dep.prerequisiteContentId) ||
      "알 수 없는 콘텐츠";
    const depTitle =
      dep.dependentTitle ||
      titleMap.get(dep.dependentContentId) ||
      "알 수 없는 콘텐츠";

    if (prereqOrder === undefined && depOrder !== undefined) {
      // Case 1: 선수 콘텐츠 누락
      // 의존 콘텐츠는 있지만 선수 콘텐츠가 플랜에 없음
      violations.push({
        prerequisiteContentId: dep.prerequisiteContentId,
        prerequisiteTitle: prereqTitle,
        dependentContentId: dep.dependentContentId,
        dependentTitle: depTitle,
        type: "missing_prerequisite",
        message: `"${depTitle}"은(는) "${prereqTitle}"을(를) 선수 학습으로 필요로 합니다. 선수 콘텐츠가 플랜에 포함되어 있지 않습니다.`,
        severity: "warning",
      });
    } else if (
      prereqOrder !== undefined &&
      depOrder !== undefined &&
      prereqOrder >= depOrder
    ) {
      // Case 2: 순서 위반
      // 선수 콘텐츠가 의존 콘텐츠보다 뒤에 배치됨
      violations.push({
        prerequisiteContentId: dep.prerequisiteContentId,
        prerequisiteTitle: prereqTitle,
        dependentContentId: dep.dependentContentId,
        dependentTitle: depTitle,
        type: "order_violation",
        message: `"${prereqTitle}"이(가) "${depTitle}" 이전에 배치되어야 합니다.`,
        severity: "warning",
      });
    }
    // prereqOrder !== undefined && depOrder === undefined
    // 선수 콘텐츠만 있고 의존 콘텐츠가 없는 경우는 문제 없음
  }

  return {
    valid: true, // 경고만 모드이므로 항상 true
    violations,
  };
}

/**
 * 단순 의존성 검증 (의존성 데이터를 직접 전달받는 버전)
 * 이미 의존성 데이터가 있는 경우 사용
 */
export function validateDependenciesSync(
  contents: ContentWithOrder[],
  dependencies: ContentDependency[]
): DependencyValidationResult {
  if (contents.length <= 1 || dependencies.length === 0) {
    return { valid: true, violations: [] };
  }

  // 콘텐츠 ID 집합
  const contentIdSet = new Set(contents.map((c) => c.contentId));

  // 순서 및 제목 맵 생성
  const orderMap = new Map<string, number>();
  const titleMap = new Map<string, string>();

  for (const content of contents) {
    orderMap.set(content.contentId, content.displayOrder);
    if (content.title) {
      titleMap.set(content.contentId, content.title);
    }
  }

  // 관련 의존성만 필터링
  const relevantDeps = dependencies.filter(
    (dep) =>
      contentIdSet.has(dep.prerequisiteContentId) ||
      contentIdSet.has(dep.dependentContentId)
  );

  const violations: DependencyViolation[] = [];

  for (const dep of relevantDeps) {
    const prereqOrder = orderMap.get(dep.prerequisiteContentId);
    const depOrder = orderMap.get(dep.dependentContentId);

    const prereqTitle =
      dep.prerequisiteTitle ||
      titleMap.get(dep.prerequisiteContentId) ||
      "알 수 없는 콘텐츠";
    const depTitle =
      dep.dependentTitle ||
      titleMap.get(dep.dependentContentId) ||
      "알 수 없는 콘텐츠";

    if (prereqOrder === undefined && depOrder !== undefined) {
      violations.push({
        prerequisiteContentId: dep.prerequisiteContentId,
        prerequisiteTitle: prereqTitle,
        dependentContentId: dep.dependentContentId,
        dependentTitle: depTitle,
        type: "missing_prerequisite",
        message: `"${depTitle}"은(는) "${prereqTitle}"을(를) 선수 학습으로 필요로 합니다.`,
        severity: "warning",
      });
    } else if (
      prereqOrder !== undefined &&
      depOrder !== undefined &&
      prereqOrder >= depOrder
    ) {
      violations.push({
        prerequisiteContentId: dep.prerequisiteContentId,
        prerequisiteTitle: prereqTitle,
        dependentContentId: dep.dependentContentId,
        dependentTitle: depTitle,
        type: "order_violation",
        message: `"${prereqTitle}"이(가) "${depTitle}" 이전에 배치되어야 합니다.`,
        severity: "warning",
      });
    }
  }

  return { valid: true, violations };
}

/**
 * 의존성 위반 메시지 포맷팅
 */
export function formatViolationMessages(
  violations: DependencyViolation[]
): string[] {
  return violations.map((v) => v.message);
}

/**
 * 위반 타입별 그룹화
 */
export function groupViolationsByType(violations: DependencyViolation[]): {
  orderViolations: DependencyViolation[];
  missingPrerequisites: DependencyViolation[];
} {
  return {
    orderViolations: violations.filter((v) => v.type === "order_violation"),
    missingPrerequisites: violations.filter(
      (v) => v.type === "missing_prerequisite"
    ),
  };
}
