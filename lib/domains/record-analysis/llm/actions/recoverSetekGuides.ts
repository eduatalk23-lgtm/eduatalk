"use server";

// P2-2 (2026-04-28): setek_guide 누락 과목 per-subject 재생성.
//
// 배경: P4 setek_guide 가 LLM 응답 누락(예: 14과목 중 6과목만 응답) 으로 90% 게이트에서 throw 한
// 케이스. 풀런 재실행 없이 누락 과목만 보충 생성한다.
// 메타/본문 분리(P0-1, P1-1) 후 본 액션은 메타(setek_guide row) 만 채우고, 본문은
// ai-guide-gen 비동기 라우트가 background 로 처리.

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "recoverSetekGuides" };

export interface RecoverSetekGuidesResult {
  /** 누락 과목 수 (재생성 요청 시점) */
  missingBefore: number;
  /** 실제 추가 생성된 가이드 수 */
  recovered: number;
  /** 누락 과목 ID 리스트 */
  missingSubjectIds: string[];
}

/**
 * 학생/학년의 setek_guide 누락 과목을 식별하고 per-subject 재생성.
 *
 * 흐름:
 * 1. course_plan 의 confirmed/recommended 과목 ID 집합
 * 2. 해당 학년 school_year 의 ai prospective setek_guide 가 보유한 과목 ID 집합
 * 3. (1) - (2) = missing
 * 4. missing 0 → no-op
 * 5. else → generateSetekDirection 을 recoverySubjectIds 모드로 호출 (누적 insert)
 */
export async function recoverMissingSetekGuidesAction(
  studentId: string,
  tenantId: string,
  grade: number,
): Promise<ActionResponse<RecoverSetekGuidesResult>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
    const { fetchCoursePlanTabData } = await import(
      "@/lib/domains/student-record/actions/coursePlan"
    );

    // 학생 학년 조회 (school_year 산출용)
    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .select("grade")
      .eq("id", studentId)
      .single();
    if (studentErr) throw studentErr;
    const studentGrade = (studentRow?.grade as number | null) ?? grade;
    const currentSchoolYear = calculateSchoolYear();
    const targetSchoolYear = currentSchoolYear - studentGrade + grade;

    // 1. course_plan 과목
    const cpRes = await fetchCoursePlanTabData(studentId);
    if (!cpRes.success) {
      return createErrorResponse("수강 계획 조회 실패");
    }
    const planSubjectIds = new Set(
      (cpRes.data.plans ?? [])
        .filter(
          (p) =>
            (p.plan_status === "confirmed" || p.plan_status === "recommended") &&
            p.grade === grade,
        )
        .map((p) => p.subject_id),
    );

    // 2. 기존 prospective setek_guide 과목
    const { data: existingGuides, error: gErr } = await supabase
      .from("student_record_setek_guides")
      .select("subject_id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai")
      .eq("guide_mode", "prospective");
    if (gErr) throw gErr;
    const existingSubjectIds = new Set(
      (existingGuides ?? []).map((g) => (g as { subject_id: string }).subject_id),
    );

    // 3. 차집합
    const missingSubjectIds: string[] = [];
    for (const id of planSubjectIds) {
      if (!existingSubjectIds.has(id)) missingSubjectIds.push(id);
    }

    if (missingSubjectIds.length === 0) {
      return createSuccessResponse({
        missingBefore: 0,
        recovered: 0,
        missingSubjectIds: [],
      });
    }

    // 4. 보고서 빌드 — generateSetekDirection 진입 조건 만족
    const { fetchReportData } = await import(
      "@/lib/domains/student-record/actions/report"
    );
    const reportRes = await fetchReportData(studentId);
    if (!reportRes.success) {
      return createErrorResponse(`보고서 빌드 실패: ${reportRes.error ?? "unknown"}`);
    }

    // 5. 재생성 — recoverySubjectIds 모드 (누적 insert, 기존 가이드 보존)
    const { generateSetekDirection } = await import("./guide-modules");
    const genRes = await generateSetekDirection(
      studentId,
      tenantId,
      userId,
      reportRes.data,
      [grade],
      undefined, // edgePromptSection
      targetSchoolYear,
      undefined, // pipelineAnalysisContext — fallback 으로 report 기반 빌드
      undefined, // studentProfileCard
      undefined, // narrativeArcSection
      undefined, // midPlanSection
      undefined, // cascadePlanSection
      undefined, // chunkRange
      missingSubjectIds, // recoverySubjectIds
    );
    if (!genRes.success) {
      return createErrorResponse(`재생성 실패: ${genRes.error ?? "unknown"}`);
    }

    const generated = genRes.data?.guides?.length ?? 0;
    return createSuccessResponse({
      missingBefore: missingSubjectIds.length,
      recovered: generated,
      missingSubjectIds,
    });
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId, tenantId, grade });
    return createErrorResponse("누락 과목 재생성 실패");
  }
}
