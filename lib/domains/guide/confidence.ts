/**
 * 궤적 confidence 소스별 정규화
 *
 * 소스마다 생성 신뢰도가 다르므로 raw confidence에 가중치를 곱해 정규화.
 * DB 저장 시점과 UI 표시 양쪽 모두 이 함수를 사용.
 */

/** 소스별 신뢰 가중치 — raw confidence에 곱하여 보정 */
export const SOURCE_CONFIDENCE_WEIGHT: Record<string, number> = {
  consultant_manual: 1.0,
  auto_from_assignment: 0.9,
  auto_from_pipeline: 0.85,
  extracted_from_neis: 0.75,
  seed_from_major: 0.6,
};

/** raw confidence × 소스 가중치 → 0~1 범위 정규화 값 */
export function normalizeConfidence(raw: number, source: string): number {
  const weight = SOURCE_CONFIDENCE_WEIGHT[source] ?? 0.7;
  return Math.min(1, raw * weight);
}
