"use server";

// ============================================
// 진단 탭 Server Actions
// Phase 5 — 역량 평가 + 활동 태그 + 종합 진단 + 보완전략 + 이수적합도
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as competencyRepo from "../competency-repository";
import * as diagnosisRepo from "../diagnosis-repository";
import { calculateCourseAdequacy } from "../course-adequacy";
import type {
  CompetencyScoreInsert,
  CompetencyScoreUpdate,
  ActivityTagInsert,
  DiagnosisInsert,
  DiagnosisUpdate,
  StrategyInsert,
  StrategyUpdate,
  DiagnosisTabData,
  StudentRecordActionResult,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "diagnosis" };

// ============================================
// 진단 탭 데이터 조회
// ============================================

export async function fetchDiagnosisTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<DiagnosisTabData> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 병렬 조회: 역량(AI+컨설턴트)/태그/진단(AI+컨설턴트)/전략 + 학생정보 + 이수과목
    const [aiScores, consultantScores, activityTags, diagnosisPair, strategies, studentResult, scoresResult] =
      await Promise.all([
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "ai"),
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "manual"),
        competencyRepo.findActivityTags(studentId, tenantId),
        diagnosisRepo.findDiagnosisPair(studentId, schoolYear, tenantId),
        diagnosisRepo.findStrategies(studentId, schoolYear, tenantId),
        supabase.from("students").select("target_major, school_name, target_sub_classification_id, grade").eq("id", studentId).maybeSingle(),
        supabase.from("student_internal_scores")
          .select("subject:subject_id(name)")
          .eq("student_id", studentId),
      ]);

    const targetMajor = studentResult.data?.target_major ?? null;
    const schoolName = studentResult.data?.school_name ?? null;
    const targetSubClassificationId = studentResult.data?.target_sub_classification_id ?? null;

    // 이수 과목명 추출 (중복 제거)
    const takenSubjects = [
      ...new Set(
        (scoresResult.data ?? [])
          .map((s) => {
            const subj = s.subject as unknown as { name: string } | null;
            return subj?.name;
          })
          .filter((n): n is string => !!n),
      ),
    ];

    // 소분류 이름 + 학교 개설 과목 병렬 조회
    const [targetSubClassificationName, offeredSubjects] = await Promise.all([
      // 소분류 이름
      (async (): Promise<string | null> => {
        if (!targetSubClassificationId) return null;
        const { data: dc } = await supabase
          .from("department_classifications")
          .select("sub_name")
          .eq("id", targetSubClassificationId)
          .single();
        return dc?.sub_name ?? null;
      })(),
      // 학교 개설 과목
      (async (): Promise<string[] | null> => {
        if (!schoolName) return null;
        const { data: profile } = await supabase
          .from("school_profiles")
          .select("id")
          .eq("school_name", schoolName)
          .maybeSingle();
        if (!profile) return null;
        const { data: offered } = await supabase
          .from("school_offered_subjects")
          .select("subject:subject_id(name)")
          .eq("school_profile_id", profile.id);
        return (offered ?? [])
          .map((o) => {
            const subj = o.subject as unknown as { name: string } | null;
            return subj?.name;
          })
          .filter((n): n is string => !!n);
      })(),
    ]);

    // 교육과정 연도 판별: 고1 입학 연도 = schoolYear - grade + 1, 2025 이후면 2022 교육과정
    const studentGrade = studentResult.data?.grade ?? 1;
    const enrollmentYear = schoolYear - studentGrade + 1;
    const curriculumYear = enrollmentYear >= 2025 ? 2022 : 2015;

    const courseAdequacy = targetMajor
      ? calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear)
      : null;

    return {
      competencyScores: { ai: aiScores, consultant: consultantScores },
      activityTags,
      aiDiagnosis: diagnosisPair.ai,
      consultantDiagnosis: diagnosisPair.consultant,
      strategies, courseAdequacy, takenSubjects, offeredSubjects, targetMajor,
      targetSubClassificationId, targetSubClassificationName,
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchDiagnosisTabData" }, error, { studentId, schoolYear });
    return {
      competencyScores: { ai: [], consultant: [] },
      activityTags: [],
      aiDiagnosis: null, consultantDiagnosis: null,
      strategies: [], courseAdequacy: null,
      takenSubjects: [], offeredSubjects: null, targetMajor: null,
      targetSubClassificationId: null, targetSubClassificationName: null,
    };
  }
}

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
  inputs: import("../types").ActivityTagInsert[],
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

/** 종합 진단 → 확정 */
export async function confirmDiagnosisAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateDiagnosis(id, { status: "confirmed" });
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmDiagnosis" }, error);
    return { success: false, error: "진단 확정 중 오류가 발생했습니다." };
  }
}

// ============================================
// 종합 진단 CRUD
// ============================================

export async function upsertDiagnosisAction(
  input: DiagnosisInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await diagnosisRepo.upsertDiagnosis(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "upsertDiagnosis" }, error);
    return { success: false, error: "종합 진단 저장 중 오류가 발생했습니다." };
  }
}

export async function updateDiagnosisAction(
  id: string,
  updates: DiagnosisUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateDiagnosis(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateDiagnosis" }, error);
    return { success: false, error: "종합 진단 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteDiagnosisAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.deleteDiagnosis(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteDiagnosis" }, error);
    return { success: false, error: "종합 진단 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 보완전략 CRUD
// ============================================

export async function addStrategyAction(
  input: StrategyInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await diagnosisRepo.insertStrategy(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addStrategy" }, error);
    return { success: false, error: "보완전략 추가 중 오류가 발생했습니다." };
  }
}

export async function updateStrategyAction(
  id: string,
  updates: StrategyUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateStrategy(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateStrategy" }, error);
    return { success: false, error: "보완전략 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteStrategyAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.deleteStrategy(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteStrategy" }, error);
    return { success: false, error: "보완전략 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// G2-1: 크로스레퍼런스 데이터 조회
// storyline_links + reading_links + reading labels
// ============================================

export interface CrossRefSourceData {
  storylineLinks: import("../types").StorylineLink[];
  readingLinks: import("../types").ReadingLink[];
  /** reading_id → book title */
  readingLabelMap: Record<string, string>;
  /** record_id → display label (세특/창체/행특/독서 등) */
  recordLabelMap: Record<string, string>;
  /** G3-5: record_id → content 텍스트 */
  recordContentMap: Record<string, string>;
}

export async function fetchCrossRefData(
  studentId: string,
  tenantId: string,
): Promise<CrossRefSourceData> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const [storylineLinksResult, readingLinksResult, readingsResult, seteksResult, changcheResult, haengteukResult] =
      await Promise.all([
        // storyline_links (through storylines)
        (async () => {
          const { data: storylines } = await supabase
            .from("student_record_storylines")
            .select("id")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          if (!storylines || storylines.length === 0) return [];
          const { data } = await supabase
            .from("student_record_storyline_links")
            .select("*")
            .in("storyline_id", storylines.map((s) => s.id))
            .order("grade")
            .order("sort_order");
          return data ?? [];
        })(),
        // reading_links
        (async () => {
          const { data: readings } = await supabase
            .from("student_record_reading")
            .select("id")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          if (!readings || readings.length === 0) return [];
          const { data } = await supabase
            .from("student_record_reading_links")
            .select("*")
            .in("reading_id", readings.map((r) => r.id));
          return data ?? [];
        })(),
        // reading labels
        supabase
          .from("student_record_reading")
          .select("id, book_title")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
        // setek labels + content (G3-5)
        supabase
          .from("student_record_seteks")
          .select("id, grade, content, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
        // changche labels + content (G3-5)
        supabase
          .from("student_record_changche")
          .select("id, grade, activity_type, content")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
        // G3-5: haengteuk content
        supabase
          .from("student_record_haengteuk")
          .select("id, grade, content")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
      ]);

    // Build reading label map
    const readingLabelMap: Record<string, string> = {};
    for (const r of readingsResult.data ?? []) {
      readingLabelMap[r.id] = r.book_title ?? "독서";
    }

    // Build record label map
    const changcheTypeLabels: Record<string, string> = {
      autonomy: "자율활동", club: "동아리활동", career: "진로활동",
    };
    const recordLabelMap: Record<string, string> = {};
    for (const s of seteksResult.data ?? []) {
      const subj = s.subject as unknown as { name: string } | null;
      recordLabelMap[s.id] = `${s.grade}학년 ${subj?.name ?? "과목"} 세특`;
    }
    for (const c of changcheResult.data ?? []) {
      recordLabelMap[c.id] = `${c.grade}학년 ${changcheTypeLabels[c.activity_type] ?? c.activity_type}`;
    }
    for (const r of readingsResult.data ?? []) {
      recordLabelMap[r.id] = r.book_title ?? "독서";
    }
    for (const h of haengteukResult.data ?? []) {
      recordLabelMap[h.id] = `${h.grade}학년 행동특성`;
    }

    // G3-5: Build record content map
    const recordContentMap: Record<string, string> = {};
    for (const s of seteksResult.data ?? []) {
      if (s.content) recordContentMap[s.id] = s.content as string;
    }
    for (const c of changcheResult.data ?? []) {
      if (c.content) recordContentMap[c.id] = c.content as string;
    }
    for (const h of haengteukResult.data ?? []) {
      if (h.content) recordContentMap[h.id] = h.content as string;
    }

    return {
      storylineLinks: storylineLinksResult as import("../types").StorylineLink[],
      readingLinks: readingLinksResult as import("../types").ReadingLink[],
      readingLabelMap,
      recordLabelMap,
      recordContentMap,
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchCrossRefData" }, error, { studentId });
    return { storylineLinks: [], readingLinks: [], readingLabelMap: {}, recordLabelMap: {}, recordContentMap: {} };
  }
}
