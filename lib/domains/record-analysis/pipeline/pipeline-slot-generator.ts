// ============================================
// 파이프라인 슬롯 자동 생성
// consultingGrades (NEIS 없는 학년)에 대해
// 세특/창체/행특 빈 레코드(슬롯)를 자동 생성
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { logActionWarn } from "@/lib/logging/actionLogger";
import type { CoursePlanTabData } from "@/lib/domains/student-record/course-plan/types";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

// 창체 활동 유형 (고정 3종)
const CHANGCHE_ACTIVITY_TYPES = ["autonomy", "club", "career"] as const;

export interface SlotGenerationResult {
  setekCount: number;
  changcheCount: number;
  haengteukCount: number;
}

/**
 * consultingGrades에 해당하는 학년의 세특/창체/행특 빈 레코드(슬롯)를 생성.
 * 이미 존재하는 레코드는 건너뜀 (upsert).
 *
 * - 세특: 수강계획(confirmed + recommended) 과목으로 슬롯 생성. 수강계획 없으면 스킵.
 * - 창체: autonomy / club / career 3개 고정 생성.
 * - 행특: 학년당 1건 고정 생성.
 */
export async function ensureConsultingGradeSlots(params: {
  studentId: string;
  tenantId: string;
  studentGrade: number;
  consultingGrades: number[];
  coursePlanData: CoursePlanTabData | null;
  supabase: SupabaseClient;
}): Promise<SlotGenerationResult> {
  const { studentId, tenantId, studentGrade, consultingGrades, coursePlanData, supabase } = params;

  let setekCount = 0;
  let changcheCount = 0;
  let haengteukCount = 0;

  const baseSchoolYear = calculateSchoolYear();

  for (const grade of consultingGrades) {
    // 해당 학년의 학교년도 계산
    // 현재 학년(studentGrade)이 baseSchoolYear에 해당하므로
    // grade 학년의 학교년도 = baseSchoolYear - studentGrade + grade
    const schoolYear = baseSchoolYear - studentGrade + grade;

    // ── 1. 세특 슬롯 ──
    // 수강계획에서 해당 학년의 과목(confirmed + recommended) 추출
    if (coursePlanData?.plans && coursePlanData.plans.length > 0) {
      const gradePlans = coursePlanData.plans.filter(
        (p) =>
          p.grade === grade &&
          (p.plan_status === "confirmed" || p.plan_status === "recommended"),
      );

      // semester × subject_id 조합으로 슬롯 생성 (중복 제거)
      const seen = new Set<string>();
      for (const plan of gradePlans) {
        const key = `${plan.semester}:${plan.subject_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { error } = await supabase
          .from("student_record_seteks")
          .upsert(
            {
              tenant_id: tenantId,
              student_id: studentId,
              school_year: schoolYear,
              grade,
              semester: plan.semester,
              subject_id: plan.subject_id,
              content: "",
              status: "draft",
            },
            {
              onConflict: "tenant_id,student_id,school_year,grade,semester,subject_id",
              ignoreDuplicates: true,
            },
          );

        if (error) {
          logActionWarn({ domain: "record-analysis", action: "slot-generator" }, `세특 슬롯 생성 실패: ${error.message}`, { subjectId: plan.subject_id, grade });
        } else {
          setekCount++;
        }
      }
    }

    // ── 2. 창체 슬롯 (3개 고정) ──
    for (const activityType of CHANGCHE_ACTIVITY_TYPES) {
      const { error } = await supabase
        .from("student_record_changche")
        .upsert(
          {
            tenant_id: tenantId,
            student_id: studentId,
            school_year: schoolYear,
            grade,
            activity_type: activityType,
            content: "",
            status: "draft",
          },
          {
            onConflict: "tenant_id,student_id,school_year,grade,activity_type",
            ignoreDuplicates: true,
          },
        );

      if (error) {
        logActionWarn({ domain: "record-analysis", action: "slot-generator" }, `창체 슬롯 생성 실패: ${error.message}`, { activityType, grade });
      } else {
        changcheCount++;
      }
    }

    // ── 3. 행특 슬롯 (1건 고정) ──
    const { error: haengteukError } = await supabase
      .from("student_record_haengteuk")
      .upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          school_year: schoolYear,
          grade,
          content: "",
          status: "draft",
        },
        {
          onConflict: "tenant_id,student_id,school_year,grade",
          ignoreDuplicates: true,
        },
      );

    if (haengteukError) {
      logActionWarn({ domain: "record-analysis", action: "slot-generator" }, `행특 슬롯 생성 실패: ${haengteukError.message}`, { grade });
    } else {
      haengteukCount++;
    }
  }

  return { setekCount, changcheCount, haengteukCount };
}
