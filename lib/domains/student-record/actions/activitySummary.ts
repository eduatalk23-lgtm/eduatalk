"use server";

// ============================================
// Phase 9.2 — 활동 요약서 CRUD Server Actions
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { ActivitySummaryStatus } from "../types";

const LOG_CTX = { domain: "student-record", action: "activitySummary" };

/** 학생의 활동 요약서 목록 조회 */
export async function fetchActivitySummaries(
  studentId: string,
): Promise<ActionResponse<Array<{
  id: string;
  school_year: number;
  target_grades: number[];
  summary_title: string;
  summary_sections: unknown;
  summary_text: string;
  status: string;
  edited_text: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}>>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_activity_summaries")
      .select(
        "id, school_year, target_grades, summary_title, summary_sections, summary_text, status, edited_text, admin_notes, created_at, updated_at",
      )
      .eq("student_id", studentId)
      .eq("prompt_version", "v1")
      .order("created_at", { ascending: false });

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "요약서 조회 실패" };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "요약서 조회 실패" };
  }
}

/** 학생의 세특 방향 가이드 목록 조회 (setek_guides 테이블) */
export async function fetchSetekGuides(
  studentId: string,
): Promise<ActionResponse<Array<{
  id: string;
  school_year: number;
  subject_id: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  overall_direction: string | null;
  prompt_version: string | null;
  guide_mode: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}>>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_setek_guides")
      .select(
        "id, school_year, subject_id, source, status, direction, keywords, competency_focus, cautions, teacher_points, overall_direction, prompt_version, guide_mode, confirmed_at, created_at, updated_at",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "가이드 조회 실패" };
    }

    return { success: true, data: (data as typeof data) ?? [] };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "가이드 조회 실패" };
  }
}

/** 활동 요약서 상태 변경 */
export async function updateActivitySummaryStatus(
  id: string,
  status: ActivitySummaryStatus,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_record_activity_summaries")
      .update({ status })
      .eq("id", id);

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "상태 변경 실패" };
    }

    return { success: true };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "상태 변경 실패" };
  }
}

/** 활동 요약서 수동 편집 저장 */
export async function editActivitySummary(
  id: string,
  editedText: string,
  adminNotes?: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_record_activity_summaries")
      .update({
        edited_text: editedText,
        ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}),
      })
      .eq("id", id);

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "편집 저장 실패" };
    }

    return { success: true };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "편집 저장 실패" };
  }
}

/** 학생의 창체 방향 가이드 목록 조회 */
export async function fetchChangcheGuides(
  studentId: string,
): Promise<ActionResponse<Array<{
  id: string;
  school_year: number;
  activity_type: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  overall_direction: string | null;
  prompt_version: string | null;
  guide_mode: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}>>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_changche_guides")
      .select(
        "id, school_year, activity_type, source, status, direction, keywords, competency_focus, cautions, teacher_points, overall_direction, prompt_version, guide_mode, confirmed_at, created_at, updated_at",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "창체 가이드 조회 실패" };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "창체 가이드 조회 실패" };
  }
}

/** 학생의 행특 방향 가이드 목록 조회 (전 학년 — Phase V2: 다학년 가상본 지원) */
export async function fetchHaengteukGuide(
  studentId: string,
): Promise<ActionResponse<Array<{
  id: string;
  school_year: number;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  evaluation_items: unknown;
  overall_direction: string | null;
  prompt_version: string | null;
  guide_mode: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}>> > {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_haengteuk_guides")
      .select(
        "id, school_year, source, status, direction, keywords, competency_focus, cautions, teacher_points, evaluation_items, overall_direction, prompt_version, guide_mode, confirmed_at, created_at, updated_at",
      )
      .eq("student_id", studentId)
      .order("school_year", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "행특 가이드 조회 실패" };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "행특 가이드 조회 실패" };
  }
}

/** 활동 요약서 삭제 */
export async function deleteActivitySummary(id: string): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_record_activity_summaries")
      .delete()
      .eq("id", id);

    if (error) {
      logActionError(LOG_CTX, error);
      return { success: false, error: "삭제 실패" };
    }

    return { success: true };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return { success: false, error: error instanceof Error ? error.message : "삭제 실패" };
  }
}
