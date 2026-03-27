"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResponse } from "@/lib/types/actionResponse";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import {
  matchSubjects,
  applyManualMappings,
  buildSubjectIdMap,
} from "../import/subject-matcher";
import { mapAllRecords } from "../import/mapper";
import type { GradeMapperContext, SubjectDetail } from "../import/mapper";
import { executeImport } from "../import/importer";
import type {
  RecordImportData,
  ImportPreviewData,
  ImportResult,
  ManualSubjectMapping,
} from "../import/types";

const LOG_CTX = { domain: "student-record", action: "" };

// ============================================
// 1단계: 클라이언트에서 파싱된 결과 → 과목 매칭 → 미리보기
// (Gemini 호출은 클라이언트에서 직접 수행)
// ============================================

export async function matchAndPreviewAction(
  parsed: RecordImportData,
): Promise<ActionResponse<ImportPreviewData>> {
  try {
    await requireAdminOrConsultant();

    // 세특 + 성적 과목명을 모두 매칭 풀에 포함
    const setekSubjects = parsed.detailedCompetencies.map((d) => d.subject);
    const gradeSubjects = parsed.grades.map((g) => g.subject);
    const allSubjectNames = [...new Set([...setekSubjects, ...gradeSubjects])];

    const subjectMatches = await matchSubjects(allSubjectNames);

    const unmatchedCount = subjectMatches.filter(
      (m) => m.confidence === "unmatched",
    ).length;

    const preview: ImportPreviewData = {
      parsed,
      subjectMatches,
      summary: {
        setekCount: parsed.detailedCompetencies.length,
        changcheCount: parsed.creativeActivities.length,
        haengteukCount: parsed.behavioralCharacteristics.length,
        readingCount: parsed.readingActivities.length,
        attendanceCount: parsed.attendance.length,
        gradeCount: parsed.grades.length,
        unmatchedSubjectCount: unmatchedCount,
        awardCount: parsed.awards.length,
        volunteerCount: parsed.volunteerActivities.length,
        classInfoCount: parsed.classInfo.length,
      },
    };

    return createSuccessResponse(preview);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "matchAndPreviewAction" }, error);
    return createErrorResponse("과목 매칭 중 오류가 발생했습니다.");
  }
}

// ============================================
// 2단계: 미리보기 확인 후 DB 저장
// ============================================

export async function executeImportAction(
  preview: ImportPreviewData,
  options: {
    studentId: string;
    overwriteExisting: boolean;
    manualMappings: ManualSubjectMapping[];
  },
): Promise<ActionResponse<ImportResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    if (!tenantId) return createErrorResponse("테넌트 정보를 확인할 수 없습니다.");

    const finalMatches = applyManualMappings(
      preview.subjectMatches,
      options.manualMappings,
    );
    const subjectIdMap = buildSubjectIdMap(finalMatches);

    const baseCtx = {
      studentId: options.studentId,
      tenantId,
      subjectIdMap,
    };

    // 성적 매핑 컨텍스트 구성
    const gradeCtx = await buildGradeMapperContext(baseCtx, subjectIdMap);

    const mapped = mapAllRecords(preview.parsed, baseCtx, gradeCtx);

    const result = await executeImport(mapped, {
      overwriteExisting: options.overwriteExisting,
    });

    if (!result.success) {
      return createErrorResponse(result.error ?? "저장 중 오류가 발생했습니다.");
    }

    // Phase R4: 임포트 후 학생의 전체 엣지 stale 마킹 (파이프라인 재분석 필요 알림)
    try {
      const { markAllStudentEdgesStale } = await import("../edge-repository");
      await markAllStudentEdgesStale(options.studentId, "import_updated");
    } catch { /* fire-and-forget */ }

    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "executeImportAction" }, error);
    return createErrorResponse("생기부 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 성적 매핑 컨텍스트 빌더
// ============================================

async function buildGradeMapperContext(
  baseCtx: { studentId: string; tenantId: string; subjectIdMap: Map<string, string | null> },
  subjectIdMap: Map<string, string | null>,
): Promise<GradeMapperContext | undefined> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return undefined;

  // 매칭된 과목 ID 수집
  const matchedIds = [...subjectIdMap.values()].filter((id): id is string => id != null);
  if (matchedIds.length === 0) return undefined;

  // 과목 상세 정보 (subject_group_id, subject_type_id) 조회
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, subject_group_id, subject_type_id")
    .in("id", matchedIds);

  const subjectDetailMap = new Map<string, SubjectDetail>();
  for (const s of subjects ?? []) {
    subjectDetailMap.set(s.id, {
      id: s.id,
      name: s.name,
      subject_group_id: s.subject_group_id,
      subject_type_id: s.subject_type_id,
    });
  }

  // 기본 curriculum_revision_id (최신 개정 사용)
  const { data: revisions } = await supabase
    .from("curriculum_revisions")
    .select("id")
    .order("year", { ascending: false })
    .limit(1);

  const curriculumRevisionId = revisions?.[0]?.id;
  if (!curriculumRevisionId) return undefined;

  // 기본 subject_type_id (첫 번째 타입)
  const { data: types } = await supabase
    .from("subject_types")
    .select("id")
    .limit(1);

  const defaultSubjectTypeId = types?.[0]?.id;
  if (!defaultSubjectTypeId) return undefined;

  return {
    ...baseCtx,
    subjectDetailMap,
    curriculumRevisionId,
    defaultSubjectTypeId,
  };
}
