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
// 배치 판정 점수 정규화 (0-100)
// ------------------------------------

const PLACEMENT_SCORE_MAP: Record<string, number> = {
  safe: 100,
  possible: 80,
  bold: 60,
  unstable: 40,
  danger: 20,
};

function compositeScore(
  curriculum: number | null,
  placement: string | null,
  competency: number | null,
): number {
  const weights = { curriculum: 0.40, placement: 0.30, competency: 0.30 };
  let score = 0;
  let totalWeight = 0;

  if (curriculum != null) {
    score += curriculum * weights.curriculum;
    totalWeight += weights.curriculum;
  }
  if (placement && PLACEMENT_SCORE_MAP[placement] != null) {
    score += PLACEMENT_SCORE_MAP[placement] * weights.placement;
    totalWeight += weights.placement;
  }
  if (competency != null) {
    score += competency * weights.competency;
    totalWeight += weights.competency;
  }

  return totalWeight > 0 ? Math.round((score / totalWeight) * 10) / 10 : 0;
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

  // 후보별 학과 mid_classification 조회 캐시
  const deptCache = new Map<string, { mid: string | null; name: string; univ: string }>();

  let withCompetencyCount = 0;

  // Phase 3: 각 후보에 역량 적합도 + 복합 점수 + 근거 텍스트 적용
  const targetDept = await findDepartmentById(input.targetDeptId);
  const targetDeptName = targetDept?.department_name ?? "";

  for (const candidate of genResult.candidates) {
    // 후보 학과 정보 조회
    let deptInfo = deptCache.get(candidate.candidate_department_id);
    if (!deptInfo) {
      try {
        const dept = await findDepartmentById(candidate.candidate_department_id);
        deptInfo = {
          mid: dept?.mid_classification ?? null,
          name: dept?.department_name ?? "",
          univ: dept?.university_name ?? "",
        };
      } catch {
        deptInfo = { mid: null, name: "", univ: "" };
      }
      deptCache.set(candidate.candidate_department_id, deptInfo);
    }

    // 역량 적합도
    let fitScore: number | null = null;
    let highlights: string[] = [];
    if (competencyScores.length > 0) {
      const careerField = resolveCareerField(deptInfo.mid);
      fitScore = calculateCompetencyFitScore(competencyScores, careerField);
      highlights = getTopCompetencyItems(competencyScores, careerField);
      if (fitScore != null) withCompetencyCount++;
    }

    candidate.competency_fit_score = fitScore;

    // 복합 점수
    candidate.composite_score = compositeScore(
      candidate.curriculum_similarity_score,
      candidate.placement_grade,
      fitScore,
    );

    // 근거 텍스트
    const sharedCount = candidate.rationale?.match(/공통 (\d+)과목/)?.[1];
    candidate.rationale = generateExplanation({
      targetDeptName,
      candidateDeptName: deptInfo.name,
      candidateUnivName: deptInfo.univ,
      curriculumSimilarity: candidate.curriculum_similarity_score,
      sharedCourseCount: sharedCount ? parseInt(sharedCount) : 0,
      topSharedCourses: [],
      placementGrade: candidate.placement_grade,
      competencyFitScore: fitScore,
      competencyHighlights: highlights,
    });
  }

  // Phase 4: 복합 점수로 재정렬 + DB 저장
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
