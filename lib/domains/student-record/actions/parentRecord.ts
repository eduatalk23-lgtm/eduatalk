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
