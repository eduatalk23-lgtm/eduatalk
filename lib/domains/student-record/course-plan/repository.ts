// ============================================
// 수강 계획 Repository — DB CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CoursePlan,
  CoursePlanWithSubject,
  CoursePlanStatus,
  CoursePlanInput,
} from "./types";

/** 학생의 전체 수강 계획 조회 (subject 정보 포함) */
export async function findByStudent(
  studentId: string,
  tenantId?: string,
): Promise<CoursePlanWithSubject[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_course_plans")
    .select(`
      *,
      subject:subject_id (
        id, name,
        subject_type:subject_type_id ( name ),
        subject_group:subject_group_id ( name )
      )
    `)
    .eq("student_id", studentId);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query
    .order("grade")
    .order("semester")
    .order("priority", { ascending: false })
    .returns<CoursePlanWithSubject[]>();

  if (error) throw new Error(`수강 계획 조회 실패: ${error.message}`);
  return data ?? [];
}

/** 단건 조회 */
export async function findById(id: string, tenantId?: string): Promise<CoursePlan | null> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_course_plans")
    .select("*")
    .eq("id", id);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`수강 계획 조회 실패: ${error.message}`);
  }
  return data as CoursePlan;
}

/** 일괄 삽입/갱신 (UPSERT on unique constraint) */
export async function bulkUpsert(
  inputs: CoursePlanInput[],
): Promise<CoursePlan[]> {
  if (inputs.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const rows = inputs.map((i) => ({
    tenant_id: i.tenantId,
    student_id: i.studentId,
    subject_id: i.subjectId,
    grade: i.grade,
    semester: i.semester,
    plan_status: i.planStatus ?? "recommended",
    source: i.source ?? "auto",
    recommendation_reason: i.recommendationReason ?? null,
    is_school_offered: i.isSchoolOffered ?? null,
    priority: i.priority ?? 0,
    notes: i.notes ?? null,
  }));

  const { data, error } = await supabase
    .from("student_course_plans")
    .upsert(rows, {
      onConflict: "tenant_id,student_id,subject_id,grade,semester",
    })
    .select("*");

  if (error) throw new Error(`수강 계획 일괄 저장 실패: ${error.message}`);
  return (data ?? []) as CoursePlan[];
}

/** 상태 변경 */
export async function updateStatus(
  id: string,
  status: CoursePlanStatus,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_course_plans")
    .update({ plan_status: status })
    .eq("id", id);

  if (error) throw new Error(`상태 변경 실패: ${error.message}`);
}

/** 학기 일괄 확정 */
export async function bulkConfirm(
  studentId: string,
  grade: number,
  semester: number,
  tenantId?: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_course_plans")
    .update({ plan_status: "confirmed" })
    .eq("student_id", studentId)
    .eq("grade", grade)
    .eq("semester", semester)
    .eq("plan_status", "recommended");

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.select("id");
  if (error) throw new Error(`일괄 확정 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** 단건 삭제 */
export async function remove(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_course_plans")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

/** 학생의 특정 상태 수강 계획 수 */
export async function countByStatus(
  studentId: string,
  status?: CoursePlanStatus,
  tenantId?: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_course_plans")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (status) query = query.eq("plan_status", status);

  const { count, error } = await query;
  if (error) throw new Error(`카운트 실패: ${error.message}`);
  return count ?? 0;
}

/** 특정 학년/학기의 confirmed plans 조회 */
export async function findConfirmedByGradeSemester(
  studentId: string,
  grade?: number,
  semester?: number,
  tenantId?: string,
): Promise<CoursePlanWithSubject[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_course_plans")
    .select(`
      *,
      subject:subject_id (
        id, name,
        subject_type:subject_type_id ( name ),
        subject_group:subject_group_id ( name )
      )
    `)
    .eq("student_id", studentId)
    .eq("plan_status", "confirmed");

  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (grade != null) query = query.eq("grade", grade);
  if (semester != null) query = query.eq("semester", semester);

  const { data, error } = await query.order("grade").order("semester").returns<CoursePlanWithSubject[]>();
  if (error) throw new Error(`confirmed 조회 실패: ${error.message}`);
  return data ?? [];
}

/** subject_id + grade + semester 매칭으로 confirmed → completed 일괄 전환 */
export async function bulkCompleteBySubjects(
  studentId: string,
  triples: { subjectId: string; grade: number; semester: number }[],
): Promise<number> {
  if (triples.length === 0) return 0;

  const supabase = await createSupabaseServerClient();
  let transitioned = 0;

  // 각 triple에 대해 개별 update (Supabase는 복합 조건 OR 지원 제한)
  for (const t of triples) {
    const { data, error } = await supabase
      .from("student_course_plans")
      .update({ plan_status: "completed" })
      .eq("student_id", studentId)
      .eq("subject_id", t.subjectId)
      .eq("grade", t.grade)
      .eq("semester", t.semester)
      .eq("plan_status", "confirmed")
      .select("id");

    if (!error && data) transitioned += data.length;
  }

  return transitioned;
}

/** 학생의 수강 계획 전체 삭제 (재생성 용) */
export async function removeRecommendedByStudent(
  studentId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_course_plans")
    .delete()
    .eq("student_id", studentId)
    .eq("plan_status", "recommended");

  if (error) throw new Error(`추천 삭제 실패: ${error.message}`);
}

/** P2-C: 우선순위 변경 */
export async function updatePriority(
  id: string,
  newPriority: number,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_course_plans")
    .update({ priority: newPriority })
    .eq("id", id);
  if (error) throw new Error(`우선순위 변경 실패: ${error.message}`);
}
