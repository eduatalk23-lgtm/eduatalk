// ============================================
// 생기부 도메인 Repository
// 순수한 데이터 접근만을 담당
// - Supabase 쿼리만 수행
// - 비즈니스 로직 없음
// - 에러는 상위 레이어에서 처리
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecordSetek, RecordSetekInsert, RecordSetekUpdate,
  RecordPersonalSetek, RecordPersonalSetekInsert, RecordPersonalSetekUpdate,
  RecordChangche, RecordChangcheInsert, RecordChangcheUpdate,
  RecordHaengteuk, RecordHaengteukInsert, RecordHaengteukUpdate,
  RecordReading, RecordReadingInsert, RecordReadingUpdate,
  RecordAttendance, RecordAttendanceInsert, RecordAttendanceUpdate,
  SubjectPair,
  Storyline, StorylineInsert, StorylineUpdate,
  StorylineLink, StorylineLinkInsert,
  RoadmapItem, RoadmapItemInsert, RoadmapItemUpdate,
  RecordApplication, RecordApplicationInsert, RecordApplicationUpdate,
  RecordAward, RecordAwardInsert,
  RecordVolunteer, RecordVolunteerInsert,
  RecordDisciplinary, RecordDisciplinaryInsert,
  MinScoreTarget, MinScoreTargetInsert, MinScoreTargetUpdate,
  MinScoreSimulation, MinScoreSimulationInsert,
} from "./types";

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

  // imported_content/imported_at만 upsert (content 건드리지 않음)
  const { data, error } = await supabase
    .from("student_record_seteks")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade,semester,subject_id",
    })
    .select("id, content")
    .single();
  if (error) throw error;

  // content가 비어있으면 imported_content를 content에 복사 (편집 시작점)
  if (!data.content && input.imported_content) {
    await supabase
      .from("student_record_seteks")
      .update({ content: input.imported_content })
      .eq("id", data.id);
  }
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
    .select("id, content")
    .single();
  if (error) throw error;

  if (!data.content && input.imported_content) {
    await supabase
      .from("student_record_changche")
      .update({ content: input.imported_content })
      .eq("id", data.id);
  }
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
    .select("id, content")
    .single();
  if (error) throw error;

  if (!data.content && input.imported_content) {
    await supabase
      .from("student_record_haengteuk")
      .update({ content: input.imported_content })
      .eq("id", data.id);
  }
  return data.id;
}

// ============================================
// 5. 독서활동 (reading)
// ============================================

export async function findReadingsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordReading[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_reading")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw error;
  return (data as RecordReading[]) ?? [];
}

export async function insertReading(
  input: RecordReadingInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_reading")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteReadingById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_reading")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 6. 출결 (attendance)
// ============================================

export async function findAttendanceByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordAttendance | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as RecordAttendance | null;
}

export async function upsertAttendance(
  input: RecordAttendanceInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_attendance")
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

// ============================================
// 8. 스토리라인 (storylines)
// ============================================

export async function findStorylinesByStudent(
  studentId: string,
  tenantId: string,
): Promise<Storyline[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("sort_order");
  if (error) throw error;
  return (data as Storyline[]) ?? [];
}

export async function insertStoryline(
  input: StorylineInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateStorylineById(
  id: string,
  updates: StorylineUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStorylineById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 9. 스토리라인 링크 (storyline_links)
// ============================================

export async function findStorylineLinksByStoryline(
  storylineId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .eq("storyline_id", storylineId)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function findAllStorylineLinksByStudent(
  studentId: string,
  tenantId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  // Join through storylines to get all links for a student
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);
  if (!storylines || storylines.length === 0) return [];

  const storylineIds = storylines.map(s => s.id);
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .in("storyline_id", storylineIds)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function insertStorylineLink(
  input: StorylineLinkInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteStorylineLinkById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storyline_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 10. 로드맵 (roadmap_items)
// ============================================

export async function findRoadmapItemsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RoadmapItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("grade")
    .order("semester", { nullsFirst: false })
    .order("sort_order");
  if (error) throw error;
  return (data as RoadmapItem[]) ?? [];
}

export async function findAllRoadmapItemsByStudent(
  studentId: string,
  tenantId: string,
): Promise<RoadmapItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year")
    .order("grade")
    .order("semester", { nullsFirst: false })
    .order("sort_order");
  if (error) throw error;
  return (data as RoadmapItem[]) ?? [];
}

export async function insertRoadmapItem(
  input: RoadmapItemInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRoadmapItemById(
  id: string,
  updates: RoadmapItemUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_roadmap_items")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRoadmapItemById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_roadmap_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 11. 지원현황 (applications)
// ============================================

export async function findApplicationsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordApplication[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_applications")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("round")
    .order("university_name");
  if (error) throw error;
  return (data as RecordApplication[]) ?? [];
}

export async function insertApplication(
  input: RecordApplicationInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_applications")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateApplicationById(
  id: string,
  updates: RecordApplicationUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_applications")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteApplicationById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_applications")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 12. 수상 (awards)
// ============================================

export async function findAwardsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordAward[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_awards")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("award_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordAward[]) ?? [];
}

export async function insertAward(
  input: RecordAwardInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_awards")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteAwardById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_awards")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 13. 봉사 (volunteer)
// ============================================

export async function findVolunteerByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordVolunteer[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("activity_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordVolunteer[]) ?? [];
}

export async function insertVolunteer(
  input: RecordVolunteerInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteVolunteerById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_volunteer")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 14. 징계 (disciplinary)
// ============================================

export async function findDisciplinaryByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordDisciplinary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_disciplinary")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("decision_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordDisciplinary[]) ?? [];
}

export async function insertDisciplinary(
  input: RecordDisciplinaryInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_disciplinary")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteDisciplinaryById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_disciplinary")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 15. 수능최저 목표 (min_score_targets)
// ============================================

export async function findMinScoreTargetsByStudent(
  studentId: string,
  tenantId: string,
): Promise<MinScoreTarget[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_targets")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("priority");
  if (error) throw error;
  return (data as MinScoreTarget[]) ?? [];
}

export async function insertMinScoreTarget(
  input: MinScoreTargetInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_targets")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateMinScoreTargetById(
  id: string,
  updates: MinScoreTargetUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_targets")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMinScoreTargetById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_targets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 16. 수능최저 시뮬레이션 (min_score_simulations)
// ============================================

export async function findMinScoreSimulationsByStudent(
  studentId: string,
  tenantId: string,
): Promise<MinScoreSimulation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_simulations")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("mock_score_date", { ascending: false });
  if (error) throw error;
  return (data as MinScoreSimulation[]) ?? [];
}

export async function insertMinScoreSimulation(
  input: MinScoreSimulationInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_simulations")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMinScoreSimulationById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_simulations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
