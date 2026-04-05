// ============================================
// 세특(교과/개인) + 창체 + 행특 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecordSetek, RecordSetekInsert, RecordSetekUpdate,
  RecordPersonalSetek, RecordPersonalSetekInsert, RecordPersonalSetekUpdate,
  RecordChangche, RecordChangcheInsert, RecordChangcheUpdate,
  RecordHaengteuk, RecordHaengteukInsert, RecordHaengteukUpdate,
  SubjectPair,
} from "../types";

// ============================================
// 1. 교과 세특 (seteks)
// ============================================

export async function findSeteksByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordSetek[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_seteks")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("grade")
    .order("semester")
    .order("subject_id");
  if (error) throw error;
  return (data as RecordSetek[]) ?? [];
}

export async function upsertSetek(
  input: RecordSetekInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_seteks")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade,semester,subject_id",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** 임포트 전용 upsert — imported_content에 저장, content 비어있으면 편집 시작점으로 복사 */
export async function upsertSetekImport(
  input: RecordSetekInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  // imported_content/imported_at만 upsert — content(컨설턴트 가안)는 건드리지 않음
  const { data, error } = await supabase
    .from("student_record_seteks")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade,semester,subject_id",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSetekById(
  id: string,
  updates: RecordSetekUpdate,
  expectedUpdatedAt?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_seteks")
    .update(updates)
    .eq("id", id);

  // 낙관적 잠금
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { error, count } = await query;
  if (error) throw error;
  if (expectedUpdatedAt && count === 0) {
    throw new Error("CONFLICT: 다른 사용자가 수정했습니다. 새로고침 후 다시 시도해주세요.");
  }
}

export async function deleteSetekById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_seteks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 2. 개인 세특 (personal_seteks)
// ============================================

export async function findPersonalSeteksByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordPersonalSetek[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_personal_seteks")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw error;
  return (data as RecordPersonalSetek[]) ?? [];
}

export async function insertPersonalSetek(
  input: RecordPersonalSetekInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_personal_seteks")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePersonalSetekById(
  id: string,
  updates: RecordPersonalSetekUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_personal_seteks")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePersonalSetekById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_personal_seteks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 3. 창체 (changche)
// ============================================

export async function findChangcheByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordChangche[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_changche")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("grade")
    .order("activity_type");
  if (error) throw error;
  return (data as RecordChangche[]) ?? [];
}

export async function upsertChangche(
  input: RecordChangcheInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_changche")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade,activity_type",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateChangcheById(
  id: string,
  updates: RecordChangcheUpdate,
  expectedUpdatedAt?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_changche")
    .update(updates)
    .eq("id", id);

  // 낙관적 잠금
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { error, count } = await query;
  if (error) throw error;
  if (expectedUpdatedAt && count === 0) {
    throw new Error("CONFLICT: 다른 사용자가 수정했습니다. 새로고침 후 다시 시도해주세요.");
  }
}

/** 임포트 전용 upsert — imported_content에 저장, content 비어있으면 복사 */
export async function upsertChangcheImport(
  input: RecordChangcheInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_changche")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade,activity_type",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ============================================
// 4. 행특 (haengteuk)
// ============================================

export async function findHaengteukByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordHaengteuk | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_haengteuk")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as RecordHaengteuk | null;
}

export async function upsertHaengteuk(
  input: RecordHaengteukInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_haengteuk")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateHaengteukById(
  id: string,
  updates: RecordHaengteukUpdate,
  expectedUpdatedAt?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_haengteuk")
    .update(updates)
    .eq("id", id);

  // 낙관적 잠금
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { error, count } = await query;
  if (error) throw error;
  if (expectedUpdatedAt && count === 0) {
    throw new Error("CONFLICT: 다른 사용자가 수정했습니다. 새로고침 후 다시 시도해주세요.");
  }
}

/** 임포트 전용 upsert — imported_content에 저장, content 비어있으면 복사 */
export async function upsertHaengteukImport(
  input: RecordHaengteukInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_haengteuk")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ============================================
// 7. 공통과목 쌍 (subject_pairs)
// ============================================

export async function findSubjectPair(
  subjectId: string,
  curriculumRevisionId: string,
): Promise<SubjectPair | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_subject_pairs")
    .select("*")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .or(`subject_id_1.eq.${subjectId},subject_id_2.eq.${subjectId}`)
    .maybeSingle();
  if (error) throw error;
  return data as SubjectPair | null;
}
