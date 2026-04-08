"use server";

// ============================================
// Phase 3: 서버 사이드 Overview (경고 + 진행률)
// 클라이언트 useStudentRecordData에서 15+ 쿼리를 미리 로드하던
// warnings/progressCounts 계산을 서버로 이동.
// Phase 4(Stage별 lazy loading)의 전제조건.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import { getCurriculumYear } from "@/lib/utils/schoolYear";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeWarnings } from "../warnings/engine";
import type { WarningCheckInput } from "../warnings/engine";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { StudentRecordOverview, ProgressCounts, RecordTabData } from "../types";

const LOG_CTX = { domain: "student-record", action: "overview" };

// ============================================
// progressCounts: EXISTS 기반 경량 쿼리
// ============================================

async function computeProgressCountsFromDb(
  studentId: string,
  tenantId: string,
  pipelineTasks: Record<string, string> | null,
): Promise<ProgressCounts> {
  const supabase = await createSupabaseServerClient();

  // 단일 병렬 배치: 12개 EXISTS 쿼리 (각각 인덱스 스캔 1회)
  const [
    seteks, changche, haengteuk, readings, attendance,
    awards, disciplinary,
    diagnosis,
    storylines, roadmap,
    applications, minScoreTargets,
  ] = await Promise.all([
    supabase.from("student_record_seteks").select("id").eq("student_id", studentId).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("student_record_changche").select("id").eq("student_id", studentId).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("student_record_haengteuk").select("id").eq("student_id", studentId).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("student_record_readings").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
    supabase.from("student_record_attendance").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
    supabase.from("student_record_awards").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
    supabase.from("student_record_disciplinary").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
    supabase.from("student_record_diagnosis").select("id").eq("student_id", studentId).eq("tenant_id", tenantId).limit(1).maybeSingle(),
    supabase.from("student_record_storylines").select("id").eq("student_id", studentId).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("student_record_roadmap_items").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
    supabase.from("student_record_applications").select("id").eq("student_id", studentId).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("student_record_min_score_targets").select("id").eq("student_id", studentId).limit(1).maybeSingle(),
  ]);

  const taskDone = (key: string) => pipelineTasks?.[key] === "completed";

  // recordFilled: 7개 중 존재하는 항목 수
  let recordFilled = 0;
  const hasAnyRecord = !!(seteks.data || changche.data || haengteuk.data);
  if (hasAnyRecord) recordFilled++;
  if (attendance.data) recordFilled++;
  if (awards.data || disciplinary.data) recordFilled++;
  if (changche.data) recordFilled++;
  if (seteks.data) recordFilled++;
  if (readings.data) recordFilled++;
  if (haengteuk.data) recordFilled++;

  const diagnosisFilled = diagnosis.data ? 1 : 0;

  const designFilled = [
    storylines.data ? 1 : 0,
    roadmap.data ? 1 : 0,
    taskDone("activity_summary") ? 1 : 0,
    taskDone("setek_guide") ? 1 : 0,
    taskDone("guide_matching") ? 1 : 0,
    taskDone("course_recommendation") ? 1 : 0,
    taskDone("bypass_analysis") ? 1 : 0,
  ].filter((n) => n > 0).length;

  const strategyFilled = [
    applications.data ? 1 : 0,
    minScoreTargets.data ? 1 : 0,
    taskDone("ai_strategy") ? 1 : 0,
    taskDone("interview_generation") ? 1 : 0,
    taskDone("roadmap_generation") ? 1 : 0,
    taskDone("ai_diagnosis") ? 1 : 0,
  ].filter((n) => n > 0).length;

  return { recordFilled, recordTotal: 7, diagnosisFilled, designFilled, strategyFilled };
}

// ============================================
// warnings: 기존 service 함수 재사용
// ============================================

async function computeWarningsFromData(
  studentId: string,
  tenantId: string,
  studentGrade: number,
  initialSchoolYear: number,
) {
  const currentSchoolYear = calculateSchoolYear();

  // 학년-연도 쌍 계산
  const yearPairs: { grade: number; schoolYear: number }[] = [];
  for (let g = 1; g <= studentGrade; g++) {
    yearPairs.push({ grade: g, schoolYear: gradeToSchoolYear(g, studentGrade, currentSchoolYear) });
  }

  // 병렬 로딩: 경고 계산에 필요한 모든 데이터
  const { getRecordTabData, getStorylineTabData } = await import("../service");
  const { getStrategyTabData } = await import("../service-strategy");

  const [recordResults, storylineResult, strategyResult, diagnosisResult] = await Promise.all([
    Promise.all(yearPairs.map((p) => getRecordTabData(studentId, p.schoolYear, tenantId))),
    getStorylineTabData(studentId, initialSchoolYear, tenantId),
    getStrategyTabData(studentId, initialSchoolYear, tenantId),
    (async () => {
      const { fetchDiagnosisTabData } = await import("./diagnosis");
      return fetchDiagnosisTabData(studentId, initialSchoolYear, tenantId);
    })(),
  ]);

  // 학년별 맵 구성
  const recordsByGrade = new Map<number, RecordTabData>();
  yearPairs.forEach((p, i) => {
    recordsByGrade.set(p.grade, recordResults[i]);
  });

  // curriculumYear 계산 (scorePanelData 전체 로딩 대신 경량 계산)
  const enrollmentYear = initialSchoolYear - studentGrade + 1;
  const curriculumYear = getCurriculumYear(enrollmentYear);

  const warningInput: WarningCheckInput = {
    recordsByGrade,
    storylineData: storylineResult,
    diagnosisData: diagnosisResult,
    strategyData: strategyResult,
    currentGrade: studentGrade,
    qualityScores: diagnosisResult?.qualityScores,
    targetMajorField: diagnosisResult?.targetMajor ?? null,
    curriculumYear,
    roadmapItems: storylineResult?.roadmapItems,
  };

  return computeWarnings(warningInput);
}

// ============================================
// Public API
// ============================================

/** 서버 사이드 overview: 경고 + 진행률을 서버에서 계산하여 반환 */
export async function fetchStudentRecordOverview(
  studentId: string,
  studentGrade: number,
  initialSchoolYear: number,
): Promise<ActionResponse<StudentRecordOverview>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });

    // 최신 파이프라인 tasks 1회 조회 (progressCounts용)
    const supabase = await createSupabaseServerClient();
    const { data: latestPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("tasks")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pipelineTasks = (latestPipeline?.tasks ?? null) as Record<string, string> | null;

    // warnings + progressCounts 병렬 계산
    const [warnings, progressCounts] = await Promise.all([
      computeWarningsFromData(studentId, tenantId!, studentGrade, initialSchoolYear),
      computeProgressCountsFromDb(studentId, tenantId!, pipelineTasks),
    ]);

    return { success: true, data: { warnings, progressCounts } };
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId, studentGrade });
    return { success: false, error: "생기부 개요 조회에 실패했습니다." };
  }
}
