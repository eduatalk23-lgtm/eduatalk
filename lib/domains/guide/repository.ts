import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  GuideListFilter,
  GuideUpsertInput,
  GuideContentInput,
  AssignmentCreateInput,
  ExplorationGuide,
  ExplorationGuideContent,
  GuideDetail,
  GuideAssignment,
  AssignmentWithGuide,
  CareerField,
  AssignmentStatus,
} from "./types";

// ============================================================
// 1. 가이드 조회
// ============================================================

/** 가이드 목록 (메타만 — content 미포함) */
export async function findGuides(filter: GuideListFilter) {
  const supabase = await createSupabaseServerClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("exploration_guides")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter.guideType) {
    query = query.eq("guide_type", filter.guideType);
  }
  if (filter.status) {
    query = query.eq("status", filter.status);
  }
  if (filter.curriculumYear) {
    query = query.eq("curriculum_year", filter.curriculumYear);
  }
  if (filter.tenantId !== undefined) {
    query = filter.tenantId === null
      ? query.is("tenant_id", null)
      : query.eq("tenant_id", filter.tenantId);
  }
  if (filter.searchQuery) {
    query = query.or(
      `title.ilike.%${filter.searchQuery}%,book_title.ilike.%${filter.searchQuery}%`,
    );
  }

  // subjectId 필터: junction 2단계 쿼리
  if (filter.subjectId) {
    const { data: mappings } = await supabase
      .from("exploration_guide_subject_mappings")
      .select("guide_id")
      .eq("subject_id", filter.subjectId);
    const guideIds = mappings?.map((m) => m.guide_id) ?? [];
    if (guideIds.length === 0) return { data: [], count: 0 };
    query = query.in("id", guideIds);
  }

  // careerFieldId 필터: junction 2단계 쿼리
  if (filter.careerFieldId) {
    const { data: mappings } = await supabase
      .from("exploration_guide_career_mappings")
      .select("guide_id")
      .eq("career_field_id", filter.careerFieldId);
    const guideIds = mappings?.map((m) => m.guide_id) ?? [];
    if (guideIds.length === 0) return { data: [], count: 0 };
    query = query.in("id", guideIds);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as ExplorationGuide[], count: count ?? 0 };
}

/** 가이드 상세 (메타 + 본문 + 과목/계열 매핑) */
export async function findGuideById(guideId: string): Promise<GuideDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: guide, error: guideErr } = await supabase
    .from("exploration_guides")
    .select("*")
    .eq("id", guideId)
    .single();

  if (guideErr || !guide) return null;

  // 본문, 과목매핑, 계열매핑 병렬 조회
  const [contentRes, subjectRes, careerRes] = await Promise.all([
    supabase
      .from("exploration_guide_content")
      .select("*")
      .eq("guide_id", guideId)
      .single(),
    supabase
      .from("exploration_guide_subject_mappings")
      .select("subject_id, subjects(id, name)")
      .eq("guide_id", guideId),
    supabase
      .from("exploration_guide_career_mappings")
      .select("career_field_id, exploration_guide_career_fields(id, code, name_kor)")
      .eq("guide_id", guideId),
  ]);

  return {
    ...(guide as ExplorationGuide),
    content: (contentRes.data as ExplorationGuideContent) ?? null,
    subjects: (subjectRes.data ?? []).map((r) => {
      const s = r.subjects as unknown as { id: string; name: string };
      return { id: s.id, name: s.name };
    }),
    career_fields: (careerRes.data ?? []).map((r) => {
      const c = r.exploration_guide_career_fields as unknown as {
        id: number;
        code: string;
        name_kor: string;
      };
      return { id: c.id, code: c.code, name_kor: c.name_kor };
    }),
  };
}

// ============================================================
// 2. 가이드 CUD
// ============================================================

/** 가이드 메타 생성 */
export async function createGuide(input: GuideUpsertInput): Promise<ExplorationGuide> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guides")
    .insert({
      legacy_id: input.legacyId ?? null,
      tenant_id: input.tenantId ?? null,
      guide_type: input.guideType,
      curriculum_year: input.curriculumYear ?? null,
      subject_select: input.subjectSelect ?? null,
      unit_major: input.unitMajor ?? null,
      unit_minor: input.unitMinor ?? null,
      title: input.title,
      book_title: input.bookTitle ?? null,
      book_author: input.bookAuthor ?? null,
      book_publisher: input.bookPublisher ?? null,
      book_year: input.bookYear ?? null,
      status: input.status ?? "approved",
      source_type: input.sourceType ?? "imported",
      source_reference: input.sourceReference ?? null,
      parent_guide_id: input.parentGuideId ?? null,
      content_format: input.contentFormat ?? "plain",
      quality_score: input.qualityScore ?? null,
      quality_tier: input.qualityTier ?? null,
      ai_model_version: input.aiModelVersion ?? null,
      ai_prompt_version: input.aiPromptVersion ?? null,
      registered_by: input.registeredBy ?? null,
      registered_at: input.registeredBy ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExplorationGuide;
}

/** 가이드 메타 업데이트 */
export async function updateGuide(
  guideId: string,
  input: Partial<GuideUpsertInput>,
): Promise<ExplorationGuide> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guides")
    .update({
      ...(input.guideType !== undefined && { guide_type: input.guideType }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.curriculumYear !== undefined && { curriculum_year: input.curriculumYear ?? null }),
      ...(input.subjectSelect !== undefined && { subject_select: input.subjectSelect ?? null }),
      ...(input.unitMajor !== undefined && { unit_major: input.unitMajor ?? null }),
      ...(input.unitMinor !== undefined && { unit_minor: input.unitMinor ?? null }),
      ...(input.bookTitle !== undefined && { book_title: input.bookTitle ?? null }),
      ...(input.bookAuthor !== undefined && { book_author: input.bookAuthor ?? null }),
      ...(input.bookPublisher !== undefined && { book_publisher: input.bookPublisher ?? null }),
      ...(input.bookYear !== undefined && { book_year: input.bookYear ?? null }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.contentFormat !== undefined && { content_format: input.contentFormat }),
      ...(input.sourceType !== undefined && { source_type: input.sourceType }),
      ...(input.sourceReference !== undefined && { source_reference: input.sourceReference ?? null }),
      ...(input.qualityScore !== undefined && { quality_score: input.qualityScore }),
      ...(input.qualityTier !== undefined && { quality_tier: input.qualityTier }),
      ...(input.aiModelVersion !== undefined && { ai_model_version: input.aiModelVersion }),
      ...(input.aiPromptVersion !== undefined && { ai_prompt_version: input.aiPromptVersion }),
    })
    .eq("id", guideId)
    .select()
    .single();

  if (error) throw error;
  return data as ExplorationGuide;
}

/** 가이드 삭제 (cascade: content, mappings) */
export async function deleteGuide(guideId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // content, subject/career mappings는 FK CASCADE로 자동 삭제
  const { error } = await supabase
    .from("exploration_guides")
    .delete()
    .eq("id", guideId);

  if (error) throw error;
}

/** 가이드 메타 UPSERT (legacy_id 기준) */
export async function upsertGuideByLegacyId(
  input: GuideUpsertInput & { legacyId: number },
): Promise<ExplorationGuide> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guides")
    .upsert(
      {
        legacy_id: input.legacyId,
        tenant_id: input.tenantId ?? null,
        guide_type: input.guideType,
        curriculum_year: input.curriculumYear ?? null,
        subject_select: input.subjectSelect ?? null,
        unit_major: input.unitMajor ?? null,
        unit_minor: input.unitMinor ?? null,
        title: input.title,
        book_title: input.bookTitle ?? null,
        book_author: input.bookAuthor ?? null,
        book_publisher: input.bookPublisher ?? null,
        book_year: input.bookYear ?? null,
        status: input.status ?? "approved",
        source_type: input.sourceType ?? "imported",
        source_reference: input.sourceReference ?? null,
        parent_guide_id: input.parentGuideId ?? null,
        content_format: input.contentFormat ?? "plain",
        registered_by: input.registeredBy ?? null,
      },
      { onConflict: "legacy_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as ExplorationGuide;
}

/** 가이드 본문 UPSERT */
export async function upsertGuideContent(
  guideId: string,
  input: GuideContentInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("exploration_guide_content").upsert({
    guide_id: guideId,
    motivation: input.motivation ?? null,
    theory_sections: input.theorySections ?? [],
    reflection: input.reflection ?? null,
    impression: input.impression ?? null,
    summary: input.summary ?? null,
    follow_up: input.followUp ?? null,
    book_description: input.bookDescription ?? null,
    related_papers: input.relatedPapers ?? [],
    related_books: input.relatedBooks ?? [],
    image_paths: input.imagePaths ?? [],
    guide_url: input.guideUrl ?? null,
    setek_examples: input.setekExamples ?? [],
    raw_source: input.rawSource ?? null,
  });

  if (error) throw error;
}

/** 과목 매핑 교체 (DELETE + INSERT) */
export async function replaceSubjectMappings(
  guideId: string,
  mappings: Array<{ subjectId: string; curriculumRevisionId?: string }>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 기존 삭제
  const { error: delErr } = await supabase
    .from("exploration_guide_subject_mappings")
    .delete()
    .eq("guide_id", guideId);
  if (delErr) throw delErr;

  if (mappings.length === 0) return;

  // 새로 삽입
  const { error: insErr } = await supabase
    .from("exploration_guide_subject_mappings")
    .insert(
      mappings.map((m) => ({
        guide_id: guideId,
        subject_id: m.subjectId,
        curriculum_revision_id: m.curriculumRevisionId ?? null,
      })),
    );
  if (insErr) throw insErr;
}

/** 계열 매핑 교체 (DELETE + INSERT) */
export async function replaceCareerMappings(
  guideId: string,
  careerFieldIds: number[],
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error: delErr } = await supabase
    .from("exploration_guide_career_mappings")
    .delete()
    .eq("guide_id", guideId);
  if (delErr) throw delErr;

  if (careerFieldIds.length === 0) return;

  const { error: insErr } = await supabase
    .from("exploration_guide_career_mappings")
    .insert(
      careerFieldIds.map((cfId) => ({
        guide_id: guideId,
        career_field_id: cfId,
      })),
    );
  if (insErr) throw insErr;
}

// ============================================================
// 3. 배정 (Assignments)
// ============================================================

/** 학생별 배정 목록 */
export async function findAssignmentsByStudent(
  studentId: string,
  schoolYear?: number,
): Promise<GuideAssignment[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("exploration_guide_assignments")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as GuideAssignment[];
}

/** 배정 생성 */
export async function createAssignment(
  input: AssignmentCreateInput,
): Promise<GuideAssignment> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guide_assignments")
    .insert({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      guide_id: input.guideId,
      assigned_by: input.assignedBy ?? null,
      school_year: input.schoolYear,
      grade: input.grade,
      school_name: input.schoolName ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as GuideAssignment;
}

/** 배정 목록 + 가이드 메타 JOIN */
export async function findAssignmentsWithGuides(
  studentId: string,
  schoolYear?: number,
): Promise<AssignmentWithGuide[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("exploration_guide_assignments")
    .select(
      "*, exploration_guides(id, title, guide_type, book_title, book_author, status)",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as AssignmentWithGuide[];
}

/** 배정 상태 업데이트 */
export async function updateAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const updates: Record<string, unknown> = { status };
  if (status === "submitted") updates.submitted_at = new Date().toISOString();
  if (status === "completed") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("exploration_guide_assignments")
    .update(updates)
    .eq("id", assignmentId);
  if (error) throw error;
}

/** 배정 삭제 */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("exploration_guide_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) throw error;
}

/** 이행률 조회 */
export async function getCompletionRate(
  studentId: string,
): Promise<{ total: number; linked: number; rate: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guide_assignments")
    .select("id, linked_record_id")
    .eq("student_id", studentId)
    .not("status", "in", "(cancelled)");

  if (error) throw error;

  const total = data?.length ?? 0;
  const linked = data?.filter((r) => r.linked_record_id !== null).length ?? 0;
  const rate = total > 0 ? Math.round((linked / total) * 1000) / 10 : 0;

  return { total, linked, rate };
}

// ============================================================
// 4. 참조 테이블 조회
// ============================================================

/** 전체 계열 목록 */
export async function findAllCareerFields(): Promise<CareerField[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guide_career_fields")
    .select("*")
    .order("sort_order");

  if (error) throw error;
  return data as CareerField[];
}

/** 전체 과목 목록 (subjects 테이블) */
export async function findAllSubjects(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}
