// ============================================
// 입시 결과 서비스
// 예측 정확도 조회 + 결과 기반 보정 컨텍스트 생성
// ============================================

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "outcome" };

export interface PredictionAccuracy {
  data_year: number;
  total_predictions: number;
  accurate_count: number;
  inaccurate_count: number;
  pending_count: number;
  accuracy_rate: number;
  level_distribution: Record<string, number>;
}

export interface OutcomeSummary {
  universityName: string;
  departmentName: string;
  admissionType: string;
  predictedLevel: string;
  actualResult: string;
  predictionAccurate: boolean | null;
}

/**
 * 연도별 예측 정확도 조회
 */
export async function getPredictionAccuracy(
  tenantId: string,
  dataYear?: number,
): Promise<PredictionAccuracy[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_prediction_accuracy", {
    p_tenant_id: tenantId,
    p_data_year: dataYear ?? null,
  });

  if (error) {
    logActionError(LOG_CTX, error.message);
    return [];
  }

  return (data ?? []) as PredictionAccuracy[];
}

/**
 * 특정 대학/학과의 과거 예측 결과 조회.
 * 에이전트가 "이 대학에 대한 과거 예측이 얼마나 정확했는지" 참조할 수 있음.
 */
export async function getOutcomesForUniversity(
  tenantId: string,
  universityName: string,
  departmentName?: string,
  limit = 10,
): Promise<OutcomeSummary[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("admission_outcomes")
    .select("university_name, department_name, admission_type, predicted_level, actual_result, prediction_accurate")
    .eq("tenant_id", tenantId)
    .eq("university_name", universityName)
    .not("actual_result", "eq", "pending")
    .order("data_year", { ascending: false })
    .limit(limit);

  if (departmentName) {
    query = query.eq("department_name", departmentName);
  }

  const { data, error } = await query;

  if (error) {
    logActionError(LOG_CTX, error.message);
    return [];
  }

  return (data ?? []).map((d) => ({
    universityName: d.university_name,
    departmentName: d.department_name,
    admissionType: d.admission_type,
    predictedLevel: d.predicted_level,
    actualResult: d.actual_result,
    predictionAccurate: d.prediction_accurate,
  }));
}

/**
 * 시스템 프롬프트용 정확도 요약 생성.
 * 예측 정확도가 낮은 영역을 에이전트에게 알려 보수적 판단을 유도.
 */
export async function buildOutcomeCalibrationBlock(
  tenantId: string,
): Promise<string> {
  const accuracies = await getPredictionAccuracy(tenantId);
  if (accuracies.length === 0) return "";

  const MAX_CHARS = 800;
  const lines = ["\n\n## 예측 정확도 보정 (입시 결과 기반)"];

  for (const a of accuracies.slice(0, 3)) {
    lines.push(`\n### ${a.data_year}년도 (${a.total_predictions}건)`);
    lines.push(`- 정확도: ${a.accuracy_rate}% (정확 ${a.accurate_count}건 / 부정확 ${a.inaccurate_count}건 / 미확인 ${a.pending_count}건)`);

    const dist = a.level_distribution;
    if (dist) {
      const levels = Object.entries(dist)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      if (levels) lines.push(`- 레벨 분포: ${levels}`);
    }

    if (a.accuracy_rate < 60) {
      lines.push(`- **주의**: 정확도가 60% 미만입니다. 배치 분석 시 한 단계 보수적으로 판단하세요.`);
    }
  }

  const result = lines.join("\n");
  return result.slice(0, MAX_CHARS);
}
