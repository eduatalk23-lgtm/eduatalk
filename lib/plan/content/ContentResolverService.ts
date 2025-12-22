/**
 * ContentResolverService
 *
 * 마스터 콘텐츠 ID 해석을 위한 통합 서비스
 * - master_content_id와 master_lecture_id 처리 로직 통합
 * - 콘텐츠 타입별 해석 전략 제공
 * - 배치 처리 지원으로 N+1 쿼리 문제 방지
 */

/**
 * 콘텐츠 타입 정의
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 마스터 콘텐츠 ID를 가질 수 있는 콘텐츠 인터페이스
 */
export interface MasterContentHolder {
  id: string;
  master_content_id?: string | null;
  master_lecture_id?: string | null;
}

/**
 * 마스터 콘텐츠 ID 해석 결과
 */
export interface ResolvedMasterId {
  /** 학생 콘텐츠 ID */
  studentContentId: string;
  /** 마스터 콘텐츠 ID (없으면 null) */
  masterContentId: string | null;
  /** 마스터 콘텐츠 여부 */
  isFromMaster: boolean;
}

/**
 * 콘텐츠에서 마스터 콘텐츠 ID를 추출합니다.
 *
 * 강의(lecture)의 경우:
 * - master_lecture_id를 우선 확인
 * - 없으면 master_content_id를 확인
 *
 * 책(book), 커스텀(custom)의 경우:
 * - master_content_id만 확인
 *
 * @param content - 마스터 콘텐츠 정보를 가진 콘텐츠 객체
 * @param contentType - 콘텐츠 타입 (선택사항, 타입별 우선순위 적용)
 * @returns 마스터 콘텐츠 ID (없으면 null)
 *
 * @example
 * ```typescript
 * // 강의: master_lecture_id 우선
 * getMasterContentId({ master_lecture_id: "a", master_content_id: "b" }, "lecture"); // "a"
 *
 * // 강의: master_lecture_id 없으면 master_content_id
 * getMasterContentId({ master_content_id: "b" }, "lecture"); // "b"
 *
 * // 책: master_content_id만 확인
 * getMasterContentId({ master_content_id: "b" }, "book"); // "b"
 * ```
 */
export function getMasterContentId(
  content: MasterContentHolder,
  contentType?: ContentType
): string | null {
  if (contentType === "lecture") {
    // 강의는 master_lecture_id 우선, 없으면 master_content_id
    return content.master_lecture_id || content.master_content_id || null;
  }

  // 책, 커스텀은 master_content_id만 확인
  // 타입이 명시되지 않은 경우도 둘 다 체크 (하위 호환성)
  return content.master_content_id || content.master_lecture_id || null;
}

/**
 * 콘텐츠가 마스터에서 가져온 것인지 확인합니다.
 *
 * @param content - 마스터 콘텐츠 정보를 가진 콘텐츠 객체
 * @returns 마스터에서 가져온 콘텐츠인지 여부
 *
 * @example
 * ```typescript
 * isFromMaster({ master_content_id: "123" }); // true
 * isFromMaster({ master_lecture_id: "456" }); // true
 * isFromMaster({ master_content_id: null }); // false
 * ```
 */
export function isFromMaster(content: MasterContentHolder): boolean {
  return !!(content.master_content_id || content.master_lecture_id);
}

/**
 * 콘텐츠에서 마스터 콘텐츠 ID를 해석합니다.
 *
 * @param content - 마스터 콘텐츠 정보를 가진 콘텐츠 객체
 * @param contentType - 콘텐츠 타입
 * @returns 해석 결과
 */
export function resolveMasterId(
  content: MasterContentHolder,
  contentType?: ContentType
): ResolvedMasterId {
  const masterContentId = getMasterContentId(content, contentType);

  return {
    studentContentId: content.id,
    masterContentId,
    isFromMaster: masterContentId !== null,
  };
}

/**
 * 여러 콘텐츠에서 마스터 콘텐츠 ID를 배치로 해석합니다.
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @param contentType - 콘텐츠 타입
 * @returns 학생 콘텐츠 ID를 키로 하는 마스터 콘텐츠 ID 맵
 *
 * @example
 * ```typescript
 * const lectures = [
 *   { id: "s1", master_lecture_id: "m1" },
 *   { id: "s2", master_content_id: "m2" },
 *   { id: "s3" }, // 마스터 없음
 * ];
 *
 * const map = resolveMasterIdBatch(lectures, "lecture");
 * // Map { "s1" => "m1", "s2" => "m2" }
 * ```
 */
export function resolveMasterIdBatch(
  contents: MasterContentHolder[],
  contentType?: ContentType
): Map<string, string> {
  const result = new Map<string, string>();

  for (const content of contents) {
    const masterId = getMasterContentId(content, contentType);
    if (masterId) {
      result.set(content.id, masterId);
    }
  }

  return result;
}

/**
 * 학생 콘텐츠 ID에서 마스터 콘텐츠 ID로의 매핑을 생성합니다.
 * (마스터 콘텐츠가 없는 학생 콘텐츠는 제외)
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @param contentType - 콘텐츠 타입
 * @returns 학생 콘텐츠 ID를 키, 마스터 콘텐츠 ID를 값으로 하는 맵
 */
export function createStudentToMasterMap(
  contents: MasterContentHolder[],
  contentType?: ContentType
): Map<string, string> {
  return resolveMasterIdBatch(contents, contentType);
}

/**
 * 마스터 콘텐츠 ID에서 학생 콘텐츠 ID로의 매핑을 생성합니다.
 * (하나의 마스터가 여러 학생 콘텐츠에 연결될 수 있으므로 배열로 반환)
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @param contentType - 콘텐츠 타입
 * @returns 마스터 콘텐츠 ID를 키, 학생 콘텐츠 ID 배열을 값으로 하는 맵
 */
export function createMasterToStudentMap(
  contents: MasterContentHolder[],
  contentType?: ContentType
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const content of contents) {
    const masterId = getMasterContentId(content, contentType);
    if (masterId) {
      const existing = result.get(masterId) || [];
      existing.push(content.id);
      result.set(masterId, existing);
    }
  }

  return result;
}

/**
 * 마스터 콘텐츠 ID 목록을 추출합니다.
 * (중복 제거)
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @param contentType - 콘텐츠 타입
 * @returns 중복이 제거된 마스터 콘텐츠 ID 배열
 */
export function extractMasterIds(
  contents: MasterContentHolder[],
  contentType?: ContentType
): string[] {
  const masterIds = new Set<string>();

  for (const content of contents) {
    const masterId = getMasterContentId(content, contentType);
    if (masterId) {
      masterIds.add(masterId);
    }
  }

  return Array.from(masterIds);
}

/**
 * 마스터 콘텐츠가 있는 콘텐츠만 필터링합니다.
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @returns 마스터 콘텐츠가 있는 콘텐츠만 포함된 배열
 */
export function filterWithMaster<T extends MasterContentHolder>(
  contents: T[]
): T[] {
  return contents.filter(isFromMaster);
}

/**
 * 마스터 콘텐츠가 없는 콘텐츠만 필터링합니다.
 *
 * @param contents - 마스터 콘텐츠 정보를 가진 콘텐츠 객체 배열
 * @returns 마스터 콘텐츠가 없는 콘텐츠만 포함된 배열
 */
export function filterWithoutMaster<T extends MasterContentHolder>(
  contents: T[]
): T[] {
  return contents.filter((c) => !isFromMaster(c));
}
