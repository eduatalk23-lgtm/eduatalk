import "server-only";

// ============================================================
// 우회학과 3필터 파이프라인
//
// 필터 1: 배치 가능성 (입결) — 선택적
// 필터 2: 가중치 커리큘럼 유사도
// 필터 3: 역량 매칭 — 선택적
// ============================================================

import { generateCandidates } from "./candidate-generator";
import { findDepartmentById, saveCandidates } from "./repository";
import { calculateCompetencyFitScore, resolveCareerField, getTopCompetencyItems } from "./competency-matcher";
import { generateExplanation } from "./explanation-generator";
import { findCompetencyScores } from "@/lib/domains/student-record/competency-repository";
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
}

export interface PipelineResult {
  totalGenerated: number;
  preMapped: number;
  similarity: number;
  withCompetency: number;
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
    return { totalGenerated: 0, preMapped: 0, similarity: 0, withCompetency: 0 };
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

  let withCompetencyCount = 0;

  // Phase 3: 후보 학과 정보 일괄 조회 (N+1 방지)
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

  const { calculateThreeAxisScore } = await import("./scoring/three-axis-scorer");

  for (const candidate of genResult.candidates) {
    const deptInfo = deptCache.get(candidate.candidate_department_id)
      ?? { mid: null, name: "", univ: "" };

    const axisResult = calculateThreeAxisScore({
      candidateDeptName: deptInfo.name,
      candidateUnivName: deptInfo.univ,
      candidateMidClassification: deptInfo.mid,
      competencyScores,
      curriculumSimilarity: candidate.curriculum_similarity_score,
      sharedCourseCount: 0,
      curriculumSource: null, // TODO: enrichment 연동 시 source 전달
      placementLevel: candidate.placement_grade,
      internalGpaAvg: null, // TODO: D-3에서 내신 데이터 전달
      hasMockScores: false,
    });

    candidate.competency_fit_score = axisResult.competencyFit.score;
    candidate.composite_score = axisResult.composite;
    if (axisResult.competencyFit.confidence > 0) withCompetencyCount++;

    // 구조화 사유 저장 (C-0에서 추가한 컬럼)
    candidate.competency_rationale = axisResult.competencyFit.reasoning;
    candidate.curriculum_rationale = axisResult.curriculumSimilarity.reasoning;
    candidate.placement_rationale = axisResult.placementFeasibility.reasoning;

    // 기존 종합 근거 텍스트도 유지
    candidate.rationale = generateExplanation({
      targetDeptName,
      candidateDeptName: deptInfo.name,
      candidateUnivName: deptInfo.univ,
      curriculumSimilarity: candidate.curriculum_similarity_score,
      sharedCourseCount: 0,
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
  };
}
