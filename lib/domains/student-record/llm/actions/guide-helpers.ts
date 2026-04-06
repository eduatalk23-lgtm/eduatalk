// ============================================
// 가이드 생성 공통 헬퍼 (세특/창체/행특 공유)
// ============================================

import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateTextWithRateLimit } from "../ai-client";
import { syncPipelineTaskStatus } from "../../actions/pipeline";
import type { DiagnosisTabData } from "../../types";

/**
 * 세특 subject_id → 과목명 매핑 DB 조회
 */
export async function buildSubjectMap(
  recordDataByGrade: Record<number, { seteks: Array<{ subject_id: string }> }>,
  grades: number[],
): Promise<Map<string, string>> {
  const allSubjectIds = new Set<string>();
  for (const grade of grades) {
    const data = recordDataByGrade[grade];
    if (!data) continue;
    for (const s of data.seteks) allSubjectIds.add(s.subject_id);
  }
  const subjectMap = new Map<string, string>();
  if (allSubjectIds.size > 0) {
    const supabase = await createSupabaseServerClient();
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", [...allSubjectIds]);
    for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
  }
  return subjectMap;
}

/**
 * 진단 데이터에서 역량점수/강점/약점 추출 (컨설턴트 우선, 없으면 AI)
 */
export function extractDiagnosisContext(diagnosisData: DiagnosisTabData): {
  competencyScores: Array<{ item: string; grade: string; narrative?: string }>;
  strengths: string[] | undefined;
  weaknesses: string[] | undefined;
} {
  const competencyScores = (
    diagnosisData.competencyScores.consultant.length > 0
      ? diagnosisData.competencyScores.consultant
      : diagnosisData.competencyScores.ai
  ).map((cs) => ({
    item: cs.competency_item,
    grade: cs.grade_value,
    narrative: cs.narrative ?? undefined,
  }));

  const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
  const strengths = diagnosis?.strengths as string[] | undefined;
  const weaknesses = diagnosis?.weaknesses as string[] | undefined;

  return { competencyScores, strengths, weaknesses };
}

/**
 * 기존 AI 가이드 삭제 (재생성 시 중복 방지)
 * 성공 시 null, 실패 시 ActionResponse 반환
 */
export async function deleteExistingGuides(
  tableName: string,
  filters: {
    studentId: string;
    tenantId: string;
    schoolYear: number;
    source: string;
    guideMode: string;
  },
  logCtx: { domain: string; action: string },
): Promise<ActionResponse<never> | null> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq("student_id", filters.studentId)
    .eq("tenant_id", filters.tenantId)
    .eq("school_year", filters.schoolYear)
    .eq("source", filters.source)
    .eq("guide_mode", filters.guideMode);

  if (error) {
    logActionError(logCtx, error, { studentId: filters.studentId, phase: "delete_before_insert" });
    return { success: false, error: `기존 가이드 삭제 실패: ${error.message}` };
  }
  return null;
}

/**
 * AI 가이드 생성 + 응답 파싱 공통 래퍼
 * 빈 응답 시 null 반환 (호출부에서 에러 처리)
 */
export async function callGuideAI<T>(
  systemPrompt: string,
  userPrompt: string,
  parseResponse: (content: string) => T,
  options?: { maxTokens?: number; temperature?: number },
): Promise<T | null> {
  const result = await generateTextWithRateLimit({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: "standard",
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens ?? 16384,
    responseFormat: "json",
  });

  if (!result.content) return null;
  return parseResponse(result.content);
}

/**
 * 파이프라인 상태 동기화 (fire-and-forget)
 */
export function syncGuideTaskStatus(
  studentId: string,
  taskName: string,
  logCtx: { domain: string; action: string },
): void {
  syncPipelineTaskStatus(studentId, taskName).catch((err) =>
    logActionWarn(logCtx, "파이프라인 상태 동기화 실패", { studentId, task: taskName, error: String(err) }),
  );
}
