import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  GuideVersionItem,
  CurriculumUnit,
  SuggestedTopic,
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
  // 최신 버전만 (latestOnly !== false 일 때)
  if (filter.latestOnly !== false) {
    query = query.eq("is_latest", true);
  }

  // junction 필터: 복수 조건 시 교집합 처리 (Supabase .in() 중복 방지)
  const junctionIdSets: Set<string>[] = [];

  if (filter.subjectId) {
    const { data: mappings } = await supabase
      .from("exploration_guide_subject_mappings")
      .select("guide_id")
      .eq("subject_id", filter.subjectId);
    const ids = new Set((mappings ?? []).map((m) => m.guide_id));
    if (ids.size === 0) return { data: [], count: 0 };
    junctionIdSets.push(ids);
  }

  if (filter.careerFieldId) {
    const { data: mappings } = await supabase
      .from("exploration_guide_career_mappings")
      .select("guide_id")
      .eq("career_field_id", filter.careerFieldId);
    const ids = new Set((mappings ?? []).map((m) => m.guide_id));
    if (ids.size === 0) return { data: [], count: 0 };
    junctionIdSets.push(ids);
  }

  if (filter.classificationId) {
    const { data: mappings } = await supabase
      .from("exploration_guide_classification_mappings")
      .select("guide_id")
      .eq("classification_id", filter.classificationId);
    const ids = new Set((mappings ?? []).map((m) => m.guide_id));
    if (ids.size === 0) return { data: [], count: 0 };
    junctionIdSets.push(ids);
  }

  // 복수 junction 필터 → 교집합
  if (junctionIdSets.length > 0) {
    let intersected = junctionIdSets[0];
    for (let i = 1; i < junctionIdSets.length; i++) {
      intersected = new Set([...intersected].filter((id) => junctionIdSets[i].has(id)));
    }
    if (intersected.size === 0) return { data: [], count: 0 };
    query = query.in("id", [...intersected]);
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
      .select(
        "career_field_id, exploration_guide_career_fields(id, code, name_kor)",
      )
      .eq("guide_id", guideId),
  ]);

  // 분류매핑
  const { data: classificationData } = await supabase
    .from("exploration_guide_classification_mappings")
    .select(
      "classification_id, department_classification(id, mid_name, sub_name)",
    )
    .eq("guide_id", guideId);

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
    classifications: (classificationData ?? []).map((r) => {
      const dc = r.department_classification as unknown as {
        id: number;
        mid_name: string;
        sub_name: string;
      };
      return { id: dc.id, mid_name: dc.mid_name, sub_name: dc.sub_name };
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
      subject_area: input.subjectArea ?? null,
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
      version: input.version ?? 1,
      is_latest: input.isLatest ?? true,
      original_guide_id: input.originalGuideId ?? null,
      parent_version_id: input.parentVersionId ?? null,
      version_message: input.versionMessage ?? null,
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
      ...(input.subjectArea !== undefined && { subject_area: input.subjectArea ?? null }),
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
      ...(input.isLatest !== undefined && { is_latest: input.isLatest }),
      ...(input.parentVersionId !== undefined && { parent_version_id: input.parentVersionId ?? null }),
      ...(input.versionMessage !== undefined && { version_message: input.versionMessage ?? null }),
      ...(input.reviewResult !== undefined && { review_result: input.reviewResult }),
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
        subject_area: input.subjectArea ?? null,
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
    content_sections: input.contentSections ?? [],
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

/** 소분류 매핑 교체 (DELETE + INSERT) */
export async function replaceClassificationMappings(
  guideId: string,
  classificationIds: number[],
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error: delErr } = await supabase
    .from("exploration_guide_classification_mappings")
    .delete()
    .eq("guide_id", guideId);
  if (delErr) throw delErr;

  if (classificationIds.length === 0) return;

  const { error: insErr } = await supabase
    .from("exploration_guide_classification_mappings")
    .insert(
      classificationIds.map((clId) => ({
        guide_id: guideId,
        classification_id: clId,
      })),
    );
  if (insErr) throw insErr;
}

/** 가이드의 소분류 매핑 조회 */
export async function findClassificationMappings(
  guideId: string,
): Promise<Array<{ id: number; mid_name: string; sub_name: string }>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("exploration_guide_classification_mappings")
    .select("classification_id, department_classification(id, mid_name, sub_name)")
    .eq("guide_id", guideId);

  if (error) return [];
  return (data ?? [])
    .filter((d) => d.department_classification)
    .map((d) => {
      const dc = d.department_classification as unknown as { id: number; mid_name: string; sub_name: string };
      return { id: dc.id, mid_name: dc.mid_name, sub_name: dc.sub_name };
    });
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

// ============================================================
// 5. 버전 관리 (C4)
// ============================================================

/** 버전 히스토리 조회 (original_guide_id 기준) */
export async function findVersionHistory(
  guideId: string,
): Promise<GuideVersionItem[]> {
  const supabase = await createSupabaseServerClient();

  // 먼저 현재 가이드의 original_guide_id 확인
  const { data: current, error: curErr } = await supabase
    .from("exploration_guides")
    .select("id, original_guide_id")
    .eq("id", guideId)
    .single();

  if (curErr || !current) return [];

  // 원본 ID: original_guide_id가 있으면 그것, 없으면 자기 자신
  const originalId = current.original_guide_id ?? current.id;

  // 동일 체인의 모든 버전 조회
  const { data, error } = await supabase
    .from("exploration_guides")
    .select(
      "id, version, is_latest, status, source_type, parent_version_id, version_message, registered_by, quality_score, created_at, updated_at",
    )
    .or(`id.eq.${originalId},original_guide_id.eq.${originalId}`)
    .order("version", { ascending: false });

  if (error) throw error;
  return (data ?? []) as GuideVersionItem[];
}

/** 새 버전 생성 (기존 가이드 복제 → version+1, is_latest=true) */
export async function createNewVersion(
  sourceGuideId: string,
  userId: string,
): Promise<ExplorationGuide> {
  const supabase = await createSupabaseServerClient();

  // 1. 원본 가이드 조회
  const source = await findGuideById(sourceGuideId);
  if (!source) throw new Error("원본 가이드를 찾을 수 없습니다.");

  // 2. 원본 ID 결정
  const originalId = source.original_guide_id ?? source.id;

  // 3. 이전 버전 is_latest = false
  const { error: updateErr } = await supabase
    .from("exploration_guides")
    .update({ is_latest: false })
    .eq("id", sourceGuideId);
  if (updateErr) throw updateErr;

  // 4. 새 가이드 메타 생성
  const newGuide = await createGuide({
    guideType: source.guide_type,
    title: source.title,
    bookTitle: source.book_title ?? undefined,
    bookAuthor: source.book_author ?? undefined,
    bookPublisher: source.book_publisher ?? undefined,
    bookYear: source.book_year ?? undefined,
    curriculumYear: source.curriculum_year ?? undefined,
    subjectSelect: source.subject_select ?? undefined,
    unitMajor: source.unit_major ?? undefined,
    unitMinor: source.unit_minor ?? undefined,
    status: "draft",
    sourceType: source.source_type,
    contentFormat: source.content_format,
    qualityTier: source.quality_tier ?? undefined,
    registeredBy: userId,
    version: source.version + 1,
    isLatest: true,
    originalGuideId: originalId,
    parentVersionId: sourceGuideId,
  });

  // 5. 본문 복제
  if (source.content) {
    await upsertGuideContent(newGuide.id, {
      motivation: source.content.motivation ?? undefined,
      theorySections: source.content.theory_sections,
      reflection: source.content.reflection ?? undefined,
      impression: source.content.impression ?? undefined,
      summary: source.content.summary ?? undefined,
      followUp: source.content.follow_up ?? undefined,
      bookDescription: source.content.book_description ?? undefined,
      relatedPapers: source.content.related_papers,
      relatedBooks: source.content.related_books,
      setekExamples: source.content.setek_examples,
      guideUrl: source.content.guide_url ?? undefined,
    });
  }

  // 6. 매핑 복제 (과목 + 계열 + 분류)
  await Promise.all([
    replaceSubjectMappings(
      newGuide.id,
      source.subjects.map((s) => ({ subjectId: s.id })),
    ),
    replaceCareerMappings(
      newGuide.id,
      source.career_fields.map((c) => c.id),
    ),
    source.classifications.length > 0
      ? replaceClassificationMappings(
          newGuide.id,
          source.classifications.map((c) => c.id),
        )
      : Promise.resolve(),
  ]);

  return newGuide;
}

/** 특정 버전으로 되돌리기 (대상 버전 내용 → 새 버전 생성) */
export async function revertToVersion(
  targetVersionId: string,
  userId: string,
): Promise<ExplorationGuide> {
  // 대상 버전의 내용으로 새 버전 생성
  const newGuide = await createNewVersion(targetVersionId, userId);

  // 되돌리기 메타 설정
  const supabase = await createSupabaseServerClient();
  const { data: targetVersion } = await supabase
    .from("exploration_guides")
    .select("version")
    .eq("id", targetVersionId)
    .single();

  await updateGuide(newGuide.id, {
    sourceType: "revert",
    versionMessage: `v${targetVersion?.version ?? "?"}로 되돌리기`,
  });

  return newGuide;
}

// ============================================================
// 6. 참조 테이블 조회
// ============================================================

/** 전체 소분류 목록 (department_classification, sub_name IS NOT NULL) */
export async function findAllClassifications(): Promise<
  Array<{ id: number; mid_name: string; sub_name: string }>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_classification")
    .select("id, mid_name, sub_name")
    .not("sub_name", "is", null)
    .order("mid_name");

  if (error) throw error;
  return (data ?? []) as Array<{ id: number; mid_name: string; sub_name: string }>;
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

// ============================================================
// 7. 키워드 추천 / 자동완성
// ============================================================

/** 과목명으로 교육과정 단원 목록 조회 */
export async function findCurriculumUnitsBySubject(
  subjectName: string,
): Promise<CurriculumUnit[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guide_curriculum_units")
    .select("*")
    .eq("subject_name", subjectName)
    .order("id");

  if (error) throw error;
  return (data ?? []) as CurriculumUnit[];
}

/** 가이드 제목 자동완성 (trigram 인덱스 활용) */
export async function searchGuideTitles(
  query: string,
  limit: number = 10,
): Promise<Array<{ id: string; title: string; guide_type: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exploration_guides")
    .select("id, title, guide_type")
    .eq("status", "approved")
    .ilike("title", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    title: string;
    guide_type: string;
  }>;
}

/** 유사 제목 가이드 개수 조회 */
export async function countSimilarGuides(query: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("exploration_guides")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .ilike("title", `%${query}%`);

  if (error) throw error;
  return count ?? 0;
}

/** 학생 진로 정보 간이 조회 */
export async function fetchStudentCareerInfo(
  studentId: string,
): Promise<{
  target_major: string | null;
  target_sub_classification_id: number | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("target_major, target_sub_classification_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** 분류 기반 인기 가이드 (배정 횟수 집계) */
export async function findPopularGuidesByClassification(
  classificationIds: number[],
  limit: number = 10,
): Promise<
  Array<{
    id: string;
    title: string;
    guide_type: string;
    assignment_count: number;
  }>
> {
  if (classificationIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  // Step 1: classification → guide_ids
  const { data: mappings, error: mapError } = await supabase
    .from("exploration_guide_classification_mappings")
    .select("guide_id")
    .in("classification_id", classificationIds);

  if (mapError) throw mapError;
  const guideIds = [...new Set((mappings ?? []).map((m) => m.guide_id))];
  if (guideIds.length === 0) return [];

  // Step 2: guide 메타데이터
  const { data: guides, error: guideError } = await supabase
    .from("exploration_guides")
    .select("id, title, guide_type")
    .in("id", guideIds)
    .eq("status", "approved");

  if (guideError) throw guideError;
  if (!guides || guides.length === 0) return [];

  // Step 3: 배정 횟수 집계
  const approvedIds = guides.map((g) => g.id);
  const { data: assignments, error: assignError } = await supabase
    .from("exploration_guide_assignments")
    .select("guide_id")
    .in("guide_id", approvedIds);

  if (assignError) throw assignError;

  const countMap = new Map<string, number>();
  for (const a of assignments ?? []) {
    countMap.set(a.guide_id, (countMap.get(a.guide_id) ?? 0) + 1);
  }

  return guides
    .map((g) => ({
      id: g.id,
      title: g.title,
      guide_type: g.guide_type ?? "topic_exploration",
      assignment_count: countMap.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.assignment_count - a.assignment_count)
    .slice(0, limit);
}

// ============================================================
// 8. AI 추천 주제 축적 저장소
// ============================================================

/** 조건으로 축적된 주제 조회 (인기순) */
export async function findSuggestedTopics(filter: {
  guideType?: string;
  subjectName?: string;
  careerField?: string;
  curriculumYear?: number;
  targetMajor?: string;
  limit?: number;
}): Promise<SuggestedTopic[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("suggested_topics")
    .select("*")
    .order("used_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 20);

  if (filter.guideType) {
    query = query.eq("guide_type", filter.guideType);
  }
  if (filter.subjectName) {
    query = query.eq("subject_name", filter.subjectName);
  }
  if (filter.careerField) {
    query = query.eq("career_field", filter.careerField);
  }
  if (filter.curriculumYear) {
    query = query.eq("curriculum_year", filter.curriculumYear);
  }
  if (filter.targetMajor) {
    query = query.eq("target_major", filter.targetMajor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SuggestedTopic[];
}

/** AI 생성 결과 벌크 저장 (중복 무시, RLS 우회) */
export async function saveSuggestedTopics(
  topics: Array<{
    tenantId: string | null;
    guideType: string;
    subjectName?: string;
    careerField?: string;
    curriculumYear?: number;
    targetMajor?: string;
    title: string;
    reason?: string;
    relatedSubjects?: string[];
    aiModelVersion?: string;
    createdBy?: string;
  }>,
): Promise<number> {
  if (topics.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return 0;
  const rows = topics.map((t) => ({
    tenant_id: t.tenantId,
    guide_type: t.guideType,
    subject_name: t.subjectName ?? null,
    career_field: t.careerField ?? null,
    curriculum_year: t.curriculumYear ?? null,
    target_major: t.targetMajor ?? null,
    title: t.title,
    reason: t.reason ?? null,
    related_subjects: t.relatedSubjects ?? [],
    ai_model_version: t.aiModelVersion ?? null,
    created_by: t.createdBy ?? null,
  }));

  // 개별 INSERT (중복 시 skip — UNIQUE 제약으로 보호)
  let savedCount = 0;
  for (const row of rows) {
    const { error: insertErr } = await supabase
      .from("suggested_topics")
      .insert(row);
    if (!insertErr) savedCount++;
  }
  return savedCount;
}

/** 사용 횟수 증가 (+1, RLS 우회) */
export async function incrementTopicUsedCount(
  topicId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const sb = supabase;
  const { data } = await sb
    .from("suggested_topics")
    .select("used_count")
    .eq("id", topicId)
    .single();

  if (data) {
    await sb
      .from("suggested_topics")
      .update({ used_count: (data.used_count ?? 0) + 1 })
      .eq("id", topicId);
  }
}
