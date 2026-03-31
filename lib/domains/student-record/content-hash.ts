// ============================================
// 콘텐츠 해시 유틸리티
// 레코드 변경 감지용 — 파이프라인 stale 판정
// ============================================

/**
 * 레코드 배열에서 변경 감지용 해시 생성
 * id + updated_at 조합으로 결정론적 해시 산출
 *
 * @param records - 생기부 레코드 배열 (setek / changche / haengteuk / reading)
 * @param coursePlans - 수강계획 배열 (optional). 제공 시 해시에 포함되어
 *   수강계획 변경만으로도 파이프라인 재실행이 트리거됨 (prospective 모드 필수)
 */
export function computeContentHash(
  records: Array<{ id: string; updated_at: string | null }>,
  coursePlans?: Array<{ id: string; updated_at: string | null }>,
): string {
  const sortedRecords = [...records].sort((a, b) => a.id.localeCompare(b.id));
  let payload = sortedRecords.map((r) => `${r.id}:${r.updated_at ?? ""}`).join("|");

  if (coursePlans && coursePlans.length > 0) {
    const sortedPlans = [...coursePlans].sort((a, b) => a.id.localeCompare(b.id));
    const plansPayload = sortedPlans.map((p) => `${p.id}:${p.updated_at ?? ""}`).join("|");
    payload += `\x00plans:${plansPayload}`;
  }

  // djb2 해시 — 암호학적 보안 불필요, 변경 감지용
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * DJB2 해시 내부 함수
 */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** 현재 분석에 사용되는 모델 버전 — 변경 시 캐시 자동 무효화 */
/** 프롬프트 또는 모델 변경 시 버전 올리면 전체 캐시 자동 무효화 */
export const ANALYSIS_MODEL_VERSION = "gemini-2.5-pro-v1";

/**
 * 개별 레코드 content + careerContext + 모델 버전 → DJB2 해시
 * 증분 분석: 아래 중 하나라도 변경되면 캐시 미스:
 * - content 텍스트 (임포트 upsert 영향 없음)
 * - careerContext (target_major, 이수과목)
 * - 모델 버전 (Gemini 업그레이드 시)
 */
export function computeRecordContentHash(
  content: string,
  careerContext?: { targetMajor: string; takenSubjects: string[] } | null,
): string {
  let payload = `v:${ANALYSIS_MODEL_VERSION}\x00${content}`;
  if (careerContext) {
    payload += `\x00career:${careerContext.targetMajor}|${careerContext.takenSubjects.sort().join(",")}`;
  }
  return djb2(payload);
}
