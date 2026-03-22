"use server";

import { requireParent } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessStudent } from "@/lib/domains/parent/utils";
import type {
  RecordApplication,
  MinScoreTarget,
  MinScoreSimulation,
  Storyline,
  RoadmapItem,
  RecordAttendance,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "" };

/** 학부모 열람용 생기부 요약 데이터 (세특/창체 원문 제외) */
export interface ParentRecordSummary {
  applications: RecordApplication[];
  minScoreTargets: MinScoreTarget[];
  minScoreSimulations: MinScoreSimulation[];
  storylines: Storyline[];
  roadmapItems: RoadmapItem[];
  attendance: RecordAttendance | null;
  stats: {
    setekCount: number;
    changcheCount: number;
    readingCount: number;
    awardCount: number;
    volunteerHours: number;
  };
}

export async function fetchParentRecordSummary(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<ParentRecordSummary>> {
  try {
    const { userId } = await requireParent();
    const supabase = await createSupabaseServerClient();

    // 접근 권한 확인
    const hasAccess = await canAccessStudent(supabase, userId, studentId);
    if (!hasAccess) {
      return createErrorResponse("이 학생의 정보를 조회할 권한이 없습니다.");
    }

    // 학생의 tenant_id 조회
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student) {
      return createErrorResponse("학생 정보를 찾을 수 없습니다.");
    }

    const tenantId = student.tenant_id;

    // 병렬 조회 — 세특/창체 원문은 count만
    const [
      applications,
      minScoreTargets,
      minScoreSimulations,
      storylines,
      roadmapItems,
      attendance,
      setekCountResult,
      changcheCountResult,
      readingCountResult,
      awardCountResult,
      volunteerResult,
    ] = await Promise.all([
      supabase.from("student_record_applications").select("*").eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId),
      supabase.from("student_record_min_score_targets").select("*").eq("student_id", studentId).eq("tenant_id", tenantId).order("priority"),
      supabase.from("student_record_min_score_simulations").select("*").eq("student_id", studentId).eq("tenant_id", tenantId).order("mock_score_date", { ascending: false }),
      supabase.from("student_record_storylines").select("*").eq("student_id", studentId).eq("tenant_id", tenantId).order("sort_order"),
      supabase.from("student_record_roadmap_items").select("*").eq("student_id", studentId).eq("tenant_id", tenantId).order("grade").order("sort_order"),
      supabase.from("student_record_attendance").select("*").eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("student_record_seteks").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId).is("deleted_at", null),
      supabase.from("student_record_changche").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId).is("deleted_at", null),
      supabase.from("student_record_reading").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId),
      supabase.from("student_record_awards").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId),
      supabase.from("student_record_volunteer").select("hours").eq("student_id", studentId).eq("school_year", schoolYear).eq("tenant_id", tenantId),
    ]);

    const totalVolunteerHours = (volunteerResult.data ?? []).reduce((sum, v) => sum + (v.hours ?? 0), 0);

    return createSuccessResponse<ParentRecordSummary>({
      applications: (applications.data ?? []) as RecordApplication[],
      minScoreTargets: (minScoreTargets.data ?? []) as MinScoreTarget[],
      minScoreSimulations: (minScoreSimulations.data ?? []) as MinScoreSimulation[],
      storylines: (storylines.data ?? []) as Storyline[],
      roadmapItems: (roadmapItems.data ?? []) as RoadmapItem[],
      attendance: attendance.data as RecordAttendance | null,
      stats: {
        setekCount: setekCountResult.count ?? 0,
        changcheCount: changcheCountResult.count ?? 0,
        readingCount: readingCountResult.count ?? 0,
        awardCount: awardCountResult.count ?? 0,
        volunteerHours: totalVolunteerHours,
      },
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchParentRecordSummary" }, error, { studentId });
    return createErrorResponse("생기부 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// G2-7: 학부모용 생기부 진행률 데이터
// ============================================

export interface ParentRecordProgress {
  stages: {
    record: { filled: number; total: number };
    diagnosis: { filled: number; total: number };
    design: { filled: number; total: number };
    strategy: { filled: number; total: number };
  };
  overallRate: number;
  details: {
    setekCount: number;
    changcheCount: number;
    haengteukExists: boolean;
    readingCount: number;
    personalSetekCount: number;
    attendanceExists: boolean;
    storylineCount: number;
    roadmapItemCount: number;
    guideAssignmentCount: number;
    applicationCount: number;
  };
}

/** 학부모용 생기부 진행률 (전 학년 합산) */
export async function fetchParentRecordProgress(
  studentId: string,
): Promise<ActionResponse<ParentRecordProgress>> {
  try {
    const { userId } = await requireParent();
    const supabase = await createSupabaseServerClient();

    const hasAccess = await canAccessStudent(supabase, userId, studentId);
    if (!hasAccess) {
      return createErrorResponse("이 학생의 정보를 조회할 권한이 없습니다.");
    }

    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();
    if (!student) return createErrorResponse("학생 정보를 찾을 수 없습니다.");

    const tid = student.tenant_id;

    // 병렬 count 쿼리
    const [
      setekRes, changcheRes, haengteukRes, readingRes, personalSetekRes,
      attendanceRes, storylineRes, roadmapRes, guideAssignRes, applicationRes,
      diagnosisRes, competencyRes,
    ] = await Promise.all([
      supabase.from("student_record_seteks").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid).is("deleted_at", null),
      supabase.from("student_record_changche").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid).is("deleted_at", null),
      supabase.from("student_record_haengteuk").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_reading").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_personal_seteks").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid).is("deleted_at", null),
      supabase.from("student_record_attendance").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_storylines").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_roadmap_items").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("exploration_guide_assignments").select("id", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("student_record_applications").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_diagnosis").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
      supabase.from("student_record_competency_scores").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("tenant_id", tid),
    ]);

    const setekCount = setekRes.count ?? 0;
    const changcheCount = changcheRes.count ?? 0;
    const haengteukExists = (haengteukRes.count ?? 0) > 0;
    const readingCount = readingRes.count ?? 0;
    const personalSetekCount = personalSetekRes.count ?? 0;
    const attendanceExists = (attendanceRes.count ?? 0) > 0;
    const storylineCount = storylineRes.count ?? 0;
    const roadmapItemCount = roadmapRes.count ?? 0;
    const guideAssignmentCount = guideAssignRes.count ?? 0;
    const applicationCount = applicationRes.count ?? 0;
    const diagnosisCount = diagnosisRes.count ?? 0;
    const competencyCount = competencyRes.count ?? 0;

    // 4단계 계산
    // 기록: 세특/창체/행특/독서/개인세특/출결/수상 중 데이터 있는 섹션 수 (max 7)
    const recordFilled = [
      setekCount > 0,
      changcheCount > 0,
      haengteukExists,
      readingCount > 0,
      personalSetekCount > 0,
      attendanceExists,
      true, // 인적/학적 (항상 존재)
    ].filter(Boolean).length;

    // 진단: 역량평가 + 종합진단 (max 2)
    const diagnosisFilled = [competencyCount > 0, diagnosisCount > 0].filter(Boolean).length;

    // 설계: 스토리라인/로드맵/가이드배정 (max 3)
    const designFilled = [storylineCount > 0, roadmapItemCount > 0, guideAssignmentCount > 0].filter(Boolean).length;

    // 전략: 지원현황 (max 1)
    const strategyFilled = [applicationCount > 0].filter(Boolean).length;

    const totalFilled = recordFilled + diagnosisFilled + designFilled + strategyFilled;
    const totalMax = 7 + 2 + 3 + 1;
    const overallRate = Math.round((totalFilled / totalMax) * 100);

    return createSuccessResponse<ParentRecordProgress>({
      stages: {
        record: { filled: recordFilled, total: 7 },
        diagnosis: { filled: diagnosisFilled, total: 2 },
        design: { filled: designFilled, total: 3 },
        strategy: { filled: strategyFilled, total: 1 },
      },
      overallRate,
      details: {
        setekCount, changcheCount, haengteukExists, readingCount,
        personalSetekCount, attendanceExists, storylineCount,
        roadmapItemCount, guideAssignmentCount, applicationCount,
      },
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchParentRecordProgress" }, error, { studentId });
    return createErrorResponse("진행률 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}
