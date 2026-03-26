import "server-only";

// ============================================================
// 우회학과 3필터 파이프라인
//
// 필터 1: 배치 가능성 (입결) — 선택적
// 필터 2: 가중치 커리큘럼 유사도
// 필터 3: 역량 매칭 — 선택적
// ============================================================

import { generateCandidates } from "./candidate-generator";
import { findDepartmentById, saveCandidates, fetchCurriculumSourceBatch } from "./repository";
import { resolveCareerField, getTopCompetencyItems } from "./competency-matcher";
import { generateExplanation } from "./explanation-generator";
import { findCompetencyScores } from "@/lib/domains/student-record/competency-repository";
import { calculateAverageGrade } from "@/lib/domains/score/service";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "bypass-major", action: "pipeline" };

// ------------------------------------
// 타입
// ------------------------------------

export interface PipelineInput {
  studentId: string;
  tenantId: string;
  targetDeptId: string;
  schoolYear: number;
  maxCandidates?: number;
  similarityThreshold?: number;
  /** 교육과정 미보유 학과에 대해 enrichment 시도 (기본: true, 최대 3개) */
  enableEnrichment?: boolean;
}

export interface PipelineResult {
  totalGenerated: number;
  preMapped: number;
  similarity: number;
  withCompetency: number;
  enriched: number;
}

// ------------------------------------
// 파이프라인 메인
// ------------------------------------

/**
 * 3필터 파이프라인 실행
 *
 * 1. 커리큘럼 유사도 후보 생성 (가중치 Jaccard)
 * 2. 역량 적합도 계산 (계열별 가중치)
 * 3. 복합 점수 + 근거 텍스트 생성
 * 4. DB 저장
 */
export async function runBypassPipeline(
  input: PipelineInput,
): Promise<PipelineResult> {
  logActionDebug(LOG_CTX, `파이프라인 시작: target=${input.targetDeptId}`);

  // Phase 0: 교육과정 미보유 학과 사전 보강 (enrichment)
  let enrichedCount = 0;
  if (input.enableEnrichment !== false) {
    try {
      const { enrichDepartmentCurriculum, enrichDepartmentsBatch } = await import("./enrichment/service");
      const { findDepartmentsWithoutCurriculum } = await import("./repository");

      // 0a. 목표 학과 자체 교육과정 확인 + enrichment (비교 기준이 없으면 분석 불가)
      const { fetchCurriculumWithTypeBatch } = await import("./repository");
      const targetCurrMap = await fetchCurriculumWithTypeBatch([input.targetDeptId]);
      if ((targetCurrMap.get(input.targetDeptId)?.length ?? 0) === 0) {
        logActionDebug(LOG_CTX, `목표 학과 교육과정 0건 — enrichment 시도`);
        const targetResult = await enrichDepartmentCurriculum(input.targetDeptId, { maxTier: 3 });
        if (targetResult && !targetResult.cached && targetResult.coursesAdded > 0) {
          enrichedCount++;
          logActionDebug(LOG_CTX, `목표 학과 교육과정 확충: ${targetResult.coursesAdded}건 (${targetResult.tier})`);
        }
      }

      // 0b. 동일 중분류 우선, fallback 대분류 — 후보 학과 enrichment (최대 3개)
      const targetDeptForEnrich = await findDepartmentById(input.targetDeptId);
      if (targetDeptForEnrich?.major_classification) {
        const noCurrDeptIds = await findDepartmentsWithoutCurriculum(
          targetDeptForEnrich.major_classification,
          input.targetDeptId,
          3,
          targetDeptForEnrich.mid_classification,
        );
        if (noCurrDeptIds.length > 0) {
          logActionDebug(LOG_CTX, `후보 학과 enrichment 대상: ${noCurrDeptIds.length}개`);
          const enrichResults = await enrichDepartmentsBatch(noCurrDeptIds, { maxTier: 3 }, 2);
          enrichedCount += enrichResults.filter((r) => !r.cached && r.coursesAdded > 0).length;
        }
      }

      if (enrichedCount > 0) {
        logActionDebug(LOG_CTX, `enrichment 완료: ${enrichedCount}개 학과 교육과정 확충`);
      }
    } catch (err) {
      logActionDebug(LOG_CTX, `enrichment 스킵: ${err}`);
    }
  }

  // Phase 1: 커리큘럼 유사도 후보 생성
  const genResult = await generateCandidates({
    studentId: input.studentId,
    targetDeptId: input.targetDeptId,
    schoolYear: input.schoolYear,
    tenantId: input.tenantId,
    maxCandidates: input.maxCandidates,
    similarityThreshold: input.similarityThreshold,
  });

  if (genResult.candidates.length === 0) {
    logActionDebug(LOG_CTX, "유사도 후보 0건");
    return { totalGenerated: 0, preMapped: 0, similarity: 0, withCompetency: 0, enriched: enrichedCount };
  }

  // Phase 2: 역량 적합도 (학생 역량 데이터가 있는 경우)
  let competencyScores: Array<{ competency_item: string; grade_value: string }> = [];
  try {
    const scores = await findCompetencyScores(
      input.studentId,
      input.schoolYear,
      input.tenantId,
    );
    competencyScores = scores.map((s) => ({
      competency_item: s.competency_item,
      grade_value: s.grade_value,
    }));
  } catch {
    logActionDebug(LOG_CTX, "역량 데이터 없음 — 스킵");
  }

  // Phase 2b: 내신 평균 등급 조회 (배치 데이터 없는 학생의 실현가능성 근사치)
  let internalGpaAvg: number | null = null;
  let hasMockScores = false;
  try {
    const { schoolAvg, mockAvg } = await calculateAverageGrade(input.studentId, input.tenantId);
    internalGpaAvg = schoolAvg;
    hasMockScores = mockAvg != null;
    if (internalGpaAvg != null) {
      logActionDebug(LOG_CTX, `내신 평균 ${internalGpaAvg.toFixed(1)}등급, 모의 ${hasMockScores ? "있음" : "없음"}`);
    }
  } catch {
    logActionDebug(LOG_CTX, "내신 데이터 조회 실패 — 스킵");
  }

  let withCompetencyCount = 0;

  // Phase 3: 후보 학과 정보 + 커리큘럼 출처 일괄 조회 (N+1 방지)
  const targetDept = await findDepartmentById(input.targetDeptId);
  const targetDeptName = targetDept?.department_name ?? "";

  const candidateDeptIds = [...new Set(genResult.candidates.map((c) => c.candidate_department_id))];
  const deptCache = new Map<string, { mid: string | null; name: string; univ: string }>();

  if (candidateDeptIds.length > 0) {
    const { createSupabaseServerClient: createClient } = await import("@/lib/supabase/server");
    const batchSupabase = await createClient();
    const { data: batchDepts } = await batchSupabase
      .from("university_departments")
      .select("id, department_name, university_name, mid_classification")
      .in("id", candidateDeptIds);

    for (const d of batchDepts ?? []) {
      deptCache.set(d.id, {
        mid: d.mid_classification ?? null,
        name: d.department_name ?? "",
        univ: d.university_name ?? "",
      });
    }
  }

  // Phase 3b: 커리큘럼 출처 일괄 조회 (confidence 조정용)
  const sourceCache = await fetchCurriculumSourceBatch(candidateDeptIds);

  const { calculateThreeAxisScore } = await import("./scoring/three-axis-scorer");

  for (const candidate of genResult.candidates) {
    const deptInfo = deptCache.get(candidate.candidate_department_id)
      ?? { mid: null, name: "", univ: "" };
    const sourceInfo = sourceCache.get(candidate.candidate_department_id);
    const curriculumSource = sourceInfo?.source ?? "import";
    // candidate-generator가 rationale에 실제 공통과목 수를 포함하므로, 여기서는 0 전달
    // (sourceInfo.courseCount는 해당 학과의 총 과목 수이지 공통 과목 수가 아님)
    const sharedCourseCount = 0;

    const axisResult = calculateThreeAxisScore({
      candidateDeptName: deptInfo.name,
      candidateUnivName: deptInfo.univ,
      candidateMidClassification: deptInfo.mid,
      competencyScores,
      curriculumSimilarity: candidate.curriculum_similarity_score,
      sharedCourseCount,
      curriculumSource,
      placementLevel: candidate.placement_grade,
      internalGpaAvg,
      hasMockScores,
    });

    candidate.competency_fit_score = axisResult.competencyFit.score;
    candidate.composite_score = axisResult.composite;
    if (axisResult.competencyFit.confidence > 0) withCompetencyCount++;

    // 배치 축 수치 + 출처 저장
    candidate.placement_score = axisResult.placementFeasibility.score;
    candidate.placement_source = candidate.placement_grade
      ? "mock"
      : internalGpaAvg != null
        ? "gpa"
        : "none";

    // 구조화 사유 저장 + confidence 태그
    const noData = axisResult.compositeConfidence === 0 ? " [데이터 부족]" : "";
    candidate.competency_rationale = axisResult.competencyFit.reasoning;
    candidate.curriculum_rationale = axisResult.curriculumSimilarity.reasoning;
    candidate.placement_rationale = axisResult.placementFeasibility.reasoning + noData;

    // 기존 종합 근거 텍스트도 유지
    candidate.rationale = generateExplanation({
      targetDeptName,
      candidateDeptName: deptInfo.name,
      candidateUnivName: deptInfo.univ,
      curriculumSimilarity: candidate.curriculum_similarity_score,
      sharedCourseCount,
      topSharedCourses: [],
      placementGrade: candidate.placement_grade,
      competencyFitScore: axisResult.competencyFit.score,
      competencyHighlights: getTopCompetencyItems(competencyScores, resolveCareerField(deptInfo.mid)),
    });
  }

  // Phase 4: C-4 피드백 부스트 적용
  if (targetDept?.mid_classification) {
    try {
      const { getFeedbackPatterns } = await import("./feedback/repository");
      const { applyFeedbackBoost } = await import("./feedback/pattern-matcher");

      const patterns = await getFeedbackPatterns(targetDept.mid_classification);
      if (patterns.length > 0) {
        const boostResult = applyFeedbackBoost(genResult.candidates, patterns);
        if (boostResult.boostedCount > 0) {
          logActionDebug(LOG_CTX, `피드백 부스트 적용: ${boostResult.boostedCount}건 (최대 ${boostResult.maxBoost}점)`);
        }
      }
    } catch (err) {
      logActionDebug(LOG_CTX, `피드백 부스트 스킵: ${err}`);
    }
  }

  // Phase 5: 복합 점수로 재정렬 + DB 저장
  genResult.candidates.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0));

  try {
    await saveCandidates(genResult.candidates);
  } catch (error) {
    logActionError(LOG_CTX, error);
    throw new Error("후보 저장에 실패했습니다.");
  }

  logActionDebug(
    LOG_CTX,
    `파이프라인 완료: ${genResult.candidates.length}건 (역량 ${withCompetencyCount}건)`,
  );

  return {
    totalGenerated: genResult.candidates.length,
    preMapped: genResult.stats.preMapped,
    similarity: genResult.stats.similarity,
    withCompetency: withCompetencyCount,
    enriched: enrichedCount,
  };
}
