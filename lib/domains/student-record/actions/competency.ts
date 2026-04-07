"use server";

// ============================================
// 역량 평가 + 활동 태그 + 분석 캐시 Server Actions
// diagnosis.ts에서 분리 (M1 구조 개선)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as competencyRepo from "../repository/competency-repository";
import type {
  CompetencyScoreInsert,
  CompetencyScoreUpdate,
  ActivityTagInsert,
  StudentRecordActionResult,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "competency" };

// ============================================
// 역량 평가 CRUD
// ============================================

export async function upsertCompetencyScoreAction(
  input: CompetencyScoreInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await competencyRepo.upsertCompetencyScore(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "upsertCompetencyScore" }, error);
    return { success: false, error: "역량 평가 저장 중 오류가 발생했습니다." };
  }
}

export async function updateCompetencyScoreAction(
  id: string,
  updates: CompetencyScoreUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.updateCompetencyScore(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateCompetencyScore" }, error);
    return { success: false, error: "역량 평가 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteCompetencyScoreAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteCompetencyScore(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteCompetencyScore" }, error);
    return { success: false, error: "역량 평가 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 활동 태그 CRUD
// ============================================

export async function addActivityTagAction(
  input: ActivityTagInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await competencyRepo.insertActivityTag(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addActivityTag" }, error);
    return { success: false, error: "활동 태그 추가 중 오류가 발생했습니다." };
  }
}

export async function deleteActivityTagAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteActivityTag(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteActivityTag" }, error);
    return { success: false, error: "활동 태그 삭제 중 오류가 발생했습니다." };
  }
}

/** 활동 태그 배치 추가 */
export async function addActivityTagsBatchAction(
  inputs: ActivityTagInsert[],
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const ids = await competencyRepo.insertActivityTags(inputs);
    return { success: true, id: ids[0] };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addActivityTagsBatch" }, error);
    return { success: false, error: "활동 태그 배치 추가 중 오류가 발생했습니다." };
  }
}

/** 특정 레코드의 AI 생성 태그 일괄 삭제 (재분석 전 정리) */
export async function deleteAiTagsForRecordAction(
  recordType: string,
  recordId: string,
  tenantId: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteAiActivityTagsByRecord(recordType, recordId, tenantId);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteAiTagsForRecord" }, error);
    return { success: false, error: "AI 태그 정리 중 오류가 발생했습니다." };
  }
}

/** AI 제안 태그 → 확정 */
export async function confirmActivityTagAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.updateActivityTag(id, { status: "confirmed" });
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmActivityTag" }, error);
    return { success: false, error: "태그 확정 중 오류가 발생했습니다." };
  }
}

// ============================================
// 분석 캐시
// ============================================

/** 분석 결과 캐시 저장 (UI에서 개별 분석 후 호출) + 증분 분석용 content_hash */
export async function saveAnalysisCacheAction(input: {
  tenant_id: string;
  student_id: string;
  record_type: string;
  record_id: string;
  source: "ai" | "consultant";
  analysis_result: unknown;
  content_hash?: string;
}): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.upsertAnalysisCache(input);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveAnalysisCache" }, error);
    return { success: false, error: "분석 캐시 저장 실패" };
  }
}

/** 학생의 AI 분석 캐시 조회 (하이라이트 복원 + 증분 분석) */
export async function fetchAnalysisCacheAction(
  studentId: string,
  tenantId: string,
): Promise<{ success: true; data: Array<{ record_type: string; record_id: string; source: string; analysis_result: unknown; content_hash: string | null }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const data = await competencyRepo.findAnalysisCacheByStudent(studentId, tenantId, "ai");
    return { success: true, data };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAnalysisCache" }, error, { studentId });
    return { success: false, error: "분석 캐시 조회 실패" };
  }
}

/** 배치 캐시+해시 조회 — 증분 분석에서 스킵 판별용 */
export async function fetchAnalysisCacheWithHashAction(
  recordIds: string[],
  tenantId: string,
): Promise<{ success: true; data: Array<{ record_id: string; analysis_result: unknown; content_hash: string | null }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const data = await competencyRepo.findAnalysisCacheByRecordIds(recordIds, tenantId, "ai");
    return { success: true, data };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAnalysisCacheWithHash" }, error);
    return { success: false, error: "캐시 조회 실패" };
  }
}

// ============================================
// 결정론적 진로 등급 계산
// ============================================

/** 결정론적 진로 등급 계산 (이수율+성적 기반) — 클라이언트에서 호출 */
export async function computeDeterministicCareerGradesAction(
  studentId: string,
): Promise<{ success: true; data: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: student } = await supabase
      .from("students")
      .select("target_major, grade")
      .eq("id", studentId)
      .maybeSingle();

    const tgtMajor = student?.target_major as string | null;
    if (!tgtMajor) return { success: true, data: [] };

    type ScoreRow = { subject: { name: string } | null; rank_grade: number | null; grade: number | null; semester: number | null };
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .returns<ScoreRow[]>();

    const typedScoreRows = scoreRows ?? [];

    const subjectScores = typedScoreRows
      .map((s) => ({
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade ?? 5,
      }))
      .filter((s: { subjectName: string }) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s: { subjectName: string }) => s.subjectName))];

    const gradedSubjects = typedScoreRows
      .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
      .map((s) => ({
        subjectName: s.subject!.name,
        grade: s.grade!,
        semester: s.semester!,
      }));

    const { calculateCourseAdequacy } = await import("../course-adequacy");
    const { computeCourseEffortGrades, computeCourseAchievementGrades } = await import("../rubric-matcher");
    const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");

    const studentGrade = (student?.grade as number) ?? 3;
    const enrollYear = calculateSchoolYear() - studentGrade + 1;
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const curYear = getCurriculumYear(enrollYear);
    const adequacy = calculateCourseAdequacy(tgtMajor, takenNames, null, curYear);

    if (!adequacy) return { success: true, data: [] };

    const grades = [
      computeCourseEffortGrades(adequacy, gradedSubjects),
      computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy),
    ];

    return { success: true, data: grades };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "computeDeterministicCareerGrades" }, error, { studentId });
    return { success: false, error: "결정론적 등급 계산 실패" };
  }
}
