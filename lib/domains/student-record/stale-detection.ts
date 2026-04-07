// ============================================
// Stale Detection — 엣지/파이프라인 변경 감지
// Phase E3: 레코드 수정 시 관련 엣지 stale 마킹
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeContentHash } from "./content-hash";
import { markEdgesStale, markAllStudentEdgesStale } from "./repository/edge-repository";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { PIPELINE_THRESHOLDS } from "./constants";

const LOG_CTX = { domain: "student-record", action: "stale-detection" };

/**
 * 레코드 저장 후 관련 엣지를 stale로 마킹 (fire-and-forget safe)
 * 실패해도 무시 — 엣지가 없으면 자연스럽게 0건 반환
 */
export async function markRelatedEdgesStale(recordId: string): Promise<void> {
  try {
    await markEdgesStale(recordId, "source_record_updated");
  } catch (err) {
    // fire-and-forget: 실패해도 주요 저장 플로우에 영향 없음
    logActionWarn(LOG_CTX, "markRelatedEdgesStale failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * 레코드 저장 후 관련 가이드 배정을 stale로 마킹 (fire-and-forget safe)
 * linked_record_id가 일치하는 배정에 is_stale=true 설정
 */
export async function markRelatedAssignmentsStale(recordId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("exploration_guide_assignments")
      .update({ is_stale: true, stale_reason: "linked_record_updated" })
      .eq("linked_record_id", recordId)
      .eq("is_stale", false);
  } catch (err) {
    // fire-and-forget
    logActionWarn(LOG_CTX, "markRelatedAssignmentsStale failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * 학생의 모든 가이드 배정을 stale 처리 (진로 목표 변경 등)
 */
export async function markStudentAssignmentsStale(studentId: string, tenantId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("exploration_guide_assignments")
      .update({ is_stale: true, stale_reason: "target_major_changed" })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("is_stale", false);
  } catch (err) {
    // fire-and-forget
    logActionWarn(LOG_CTX, "markStudentAssignmentsStale failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * 세특 저장 시 관련 로드맵 항목을 자동 매칭 (fire-and-forget safe)
 * subject_id + grade가 일치하는 planning 상태 항목을 in_progress로 전환
 */
export async function autoMatchRoadmapOnSetekSave(
  studentId: string,
  subjectId: string,
  grade: number,
  content: string,
): Promise<void> {
  try {
    if (!content || content.trim().length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) return;
    const supabase = await createSupabaseServerClient();

    // 과목명 조회
    const { data: subject } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject?.name) return;

    // 해당 학년의 setek 영역 planning 로드맵 항목 검색
    const { data: roadmapItems } = await supabase
      .from("student_record_roadmap_items")
      .select("id, plan_content, plan_keywords, status")
      .eq("student_id", studentId)
      .eq("grade", grade)
      .eq("area", "setek")
      .eq("status", "planning");

    if (!roadmapItems || roadmapItems.length === 0) return;

    // plan_content에 과목명이 포함된 항목 찾기
    const normalizedName = subject.name.replace(/\s/g, "").toLowerCase();
    const matched = roadmapItems.filter((item) => {
      const normalizedPlan = item.plan_content.replace(/\s/g, "").toLowerCase();
      return normalizedPlan.includes(normalizedName);
    });

    if (matched.length === 0) return;

    // planning → in_progress 전환
    await Promise.allSettled(
      matched.map((item) =>
        supabase
          .from("student_record_roadmap_items")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("status", "planning"), // 동시 업데이트 방지
      ),
    );
  } catch (err) {
    // fire-and-forget
    logActionWarn(LOG_CTX, "autoMatchRoadmapOnSetekSave failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * 세특 확정 시 관련 로드맵 항목을 in_progress → completed 전환 (fire-and-forget)
 * confirmDraftAction 호출 후 실행
 */
export async function autoMatchRoadmapOnConfirm(
  studentId: string,
  subjectId: string,
  grade: number,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // 과목명 조회
    const { data: subject } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject?.name) return;

    // 해당 학년의 setek 영역 in_progress 로드맵 항목 검색
    const { data: roadmapItems } = await supabase
      .from("student_record_roadmap_items")
      .select("id, plan_content, status")
      .eq("student_id", studentId)
      .eq("grade", grade)
      .eq("area", "setek")
      .eq("status", "in_progress");

    if (!roadmapItems || roadmapItems.length === 0) return;

    // plan_content에 과목명이 포함된 항목 찾기
    const normalizedName = subject.name.replace(/\s/g, "").toLowerCase();
    const matched = roadmapItems.filter((item) => {
      const normalizedPlan = item.plan_content.replace(/\s/g, "").toLowerCase();
      return normalizedPlan.includes(normalizedName);
    });

    if (matched.length === 0) return;

    // in_progress → completed 전환
    await Promise.allSettled(
      matched.map((item) =>
        supabase
          .from("student_record_roadmap_items")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("status", "in_progress"), // 동시 업데이트 방지
      ),
    );
  } catch (err) {
    // fire-and-forget
    logActionWarn(LOG_CTX, "autoMatchRoadmapOnConfirm failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * 수강계획 변경 시 prospective 가이드를 stale로 마킹 (fire-and-forget safe)
 * retrospective 가이드는 NEIS 기반이므로 수강계획과 무관 — 대상에서 제외.
 * 기존 edge stale 패턴(markAllStudentEdgesStale)과 동일 구조.
 */
export async function markRelatedGuidesStale(
  studentId: string,
  reason: string,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const tables = [
      "student_record_setek_guides",
      "student_record_changche_guides",
      "student_record_haengteuk_guides",
    ] as const;
    await Promise.allSettled(
      tables.map((table) =>
        supabase
          .from(table)
          .update({ is_stale: true, stale_reason: reason, updated_at: new Date().toISOString() })
          .eq("student_id", studentId)
          .eq("guide_mode", "prospective")
          .eq("is_stale", false),
      ),
    );
  } catch (err) {
    logActionWarn(LOG_CTX, "markRelatedGuidesStale failed (fire-and-forget)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * 학년 승급 시 모든 분석 결과를 stale 처리
 *
 * 배치 스크립트(semester-transition.ts)에서 호출.
 * Admin 클라이언트를 사용하므로 서버 사이드 전용.
 * 각 단계는 fire-and-forget — 실패해도 다른 단계에 영향 없음.
 */
export async function onGradeAdvanced(
  studentId: string,
  _newGrade: number,
  tenantId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  // 1. 가이드 할당 stale 마킹 (새 학년 재평가 필요)
  // tenant_id 필터를 추가하여 다른 테넌트 데이터에 영향을 주지 않도록 보호
  await supabase
    .from("exploration_guide_assignments")
    .update({ is_stale: true, stale_reason: "grade_advanced" })
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_stale", false)
    .then(() => {})
    .catch((err: unknown) =>
      logActionWarn(LOG_CTX, "가이드 배정 stale 마킹 실패", { error: err instanceof Error ? err.message : String(err) }),
    );

  // 2. 엣지 stale 마킹 (fire-and-forget)
  await markAllStudentEdgesStale(studentId, "grade_advanced").catch((err: unknown) =>
    logActionWarn(LOG_CTX, "엣지 stale 마킹 실패", { error: err instanceof Error ? err.message : String(err) }),
  );

  // 3. prospective 가이드 stale 마킹 (새 학년 재평가 필요)
  await markRelatedGuidesStale(studentId, "grade_advanced").catch((err: unknown) =>
    logActionWarn(LOG_CTX, "가이드 stale 마킹 실패", { error: err instanceof Error ? err.message : String(err) }),
  );

  // 4. 파이프라인 content_hash → null (다음 실행 시 무조건 재분석)
  await supabase
    .from("student_record_analysis_pipelines")
    .update({ content_hash: null })
    .eq("student_id", studentId)
    .then(() => {})
    .catch((err: unknown) =>
      logActionWarn(LOG_CTX, "content_hash 초기화 실패", { error: err instanceof Error ? err.message : String(err) }),
    );
}

/**
 * 교육과정 변경 시 분석 결과를 stale 처리
 *
 * students.curriculum_revision 변경 후 호출.
 * 기존 역량 분석/가이드/엣지가 이전 교육과정 기준이므로 재분석 필요.
 * 각 단계는 fire-and-forget — 실패해도 다른 단계에 영향 없음.
 */
export async function onCurriculumRevisionChanged(
  studentId: string,
  tenantId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const reason = "curriculum_revision_changed";

  // 1. 엣지 stale 마킹
  await markAllStudentEdgesStale(studentId, reason).catch((err: unknown) =>
    logActionWarn(LOG_CTX, "엣지 stale 마킹 실패 (교육과정 변경)", { error: err instanceof Error ? err.message : String(err) }),
  );

  // 2. 가이드 stale 마킹 (교육과정 변경 시 과목 체계 변동 가능)
  await markRelatedGuidesStale(studentId, reason).catch((err: unknown) =>
    logActionWarn(LOG_CTX, "가이드 stale 마킹 실패 (교육과정 변경)", { error: err instanceof Error ? err.message : String(err) }),
  );

  // 3. 가이드 배정 stale 마킹
  await supabase
    .from("exploration_guide_assignments")
    .update({ is_stale: true, stale_reason: reason })
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_stale", false)
    .then(() => {})
    .catch((err: unknown) =>
      logActionWarn(LOG_CTX, "가이드 배정 stale 마킹 실패 (교육과정 변경)", { error: err instanceof Error ? err.message : String(err) }),
    );

  // 4. 파이프라인 content_hash → null (다음 실행 시 무조건 재분석)
  await supabase
    .from("student_record_analysis_pipelines")
    .update({ content_hash: null })
    .eq("student_id", studentId)
    .then(() => {})
    .catch((err: unknown) =>
      logActionWarn(LOG_CTX, "content_hash 초기화 실패 (교육과정 변경)", { error: err instanceof Error ? err.message : String(err) }),
    );
}

/**
 * 파이프라인의 content_hash와 현재 레코드 상태를 비교하여 stale 여부 반환
 */
export async function checkPipelineStaleness(
  studentId: string,
  tenantId: string,
): Promise<{ isStale: boolean; savedHash: string | null; currentHash: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. 최신 완료 synthesis 파이프라인의 content_hash 조회
  // (content_hash를 실제로 저장하는 것은 synthesis뿐 — grade 파이프라인은 null)
  const { data: pipeline } = await supabase
    .from("student_record_analysis_pipelines")
    .select("content_hash")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .eq("pipeline_type", "synthesis")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const savedHash = pipeline?.content_hash ?? null;

  // 2. 현재 레코드 해시 계산 (personal_seteks + 수강계획 포함)
  const [seteks, personalSeteks, changche, haengteuk, coursePlans] = await Promise.all([
    supabase
      .from("student_record_seteks")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("student_record_personal_seteks")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("student_record_changche")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("student_record_haengteuk")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("student_course_plans")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
  ]);

  const allRecords = [
    ...(seteks.data ?? []),
    ...(personalSeteks.data ?? []),
    ...(changche.data ?? []),
    ...(haengteuk.data ?? []),
  ].map((r) => ({ id: r.id, updated_at: r.updated_at }));

  const coursePlanRecords = (coursePlans.data ?? []).map((r) => ({ id: r.id, updated_at: r.updated_at }));
  const currentHash = computeContentHash(allRecords, coursePlanRecords);

  return {
    isStale: savedHash !== null && savedHash !== currentHash,
    savedHash,
    currentHash,
  };
}
