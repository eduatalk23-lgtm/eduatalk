import "server-only";

import {
  findDepartmentById,
  findBypassPairs,
  findDepartmentsByMajorClassification,
  fetchCurriculumWithTypeBatch,
} from "./repository";
import { calculateWeightedCurriculumSimilarity } from "./similarity-engine";
import type {
  BypassMajorCandidate,
  BypassCandidateSource,
} from "./types";

// ============================================================
// 우회학과 후보 자동 생성
// ============================================================

export interface GenerateCandidatesInput {
  studentId: string;
  targetDeptId: string;
  schoolYear: number;
  tenantId: string;
  maxCandidates?: number;
  similarityThreshold?: number;
}

export interface GenerateCandidatesResult {
  candidates: Array<
    Omit<BypassMajorCandidate, "id" | "created_at" | "updated_at">
  >;
  stats: {
    totalGenerated: number;
    preMapped: number;
    similarity: number;
  };
}

/**
 * 우회학과 후보 자동 생성
 *
 * 1. 사전 매핑 페어 → source: "pre_mapped"
 * 2. 동일 대분류 학과 → Jaccard 유사도 → source: "similarity"
 * 3. 중복 제거 + threshold 필터 + 상위 N개 선택
 */
export async function generateCandidates(
  input: GenerateCandidatesInput,
): Promise<GenerateCandidatesResult> {
  const {
    studentId,
    targetDeptId,
    schoolYear,
    tenantId,
    maxCandidates = 20,
    similarityThreshold = 10,
  } = input;

  // 1. 목표 학과 조회
  const targetDept = await findDepartmentById(targetDeptId);
  if (!targetDept) {
    throw new Error("목표 학과를 찾을 수 없습니다.");
  }

  // 2. 사전 매핑 페어 → 후보 생성
  const pairs = await findBypassPairs(targetDeptId);
  const preMappedCandidateIds = new Set<string>();
  const preMappedCandidates: Array<{
    deptId: string;
    source: BypassCandidateSource;
    rationale: string;
  }> = [];

  for (const pair of pairs) {
    if (pair.bypass_department_id) {
      // 이미 해소된 페어
      preMappedCandidateIds.add(pair.bypass_department_id);
      preMappedCandidates.push({
        deptId: pair.bypass_department_id,
        source: "pre_mapped",
        rationale: `사전 매핑: ${pair.bypass_department_name}`,
      });
    } else {
      // 이름으로 학과 검색 시도 (bypass_department_name에서 대학명/학과명 추출)
      // bypass_department_name 형식: "대학명 학과명" 또는 "학과명"
      // 현재는 해소되지 않은 페어는 건너뜀
      continue;
    }
  }

  // 3. 동일 대분류 학과 조회
  let similarityCandidateDepts: Array<{ id: string }> = [];
  if (targetDept.major_classification) {
    similarityCandidateDepts = await findDepartmentsByMajorClassification(
      targetDept.major_classification,
      targetDeptId,
    );
  }

  // 4. 교육과정 일괄 조회 (target + 사전매핑 + 동일대분류, course_type 포함)
  const allDeptIds = new Set<string>([targetDeptId]);
  for (const c of preMappedCandidates) allDeptIds.add(c.deptId);
  for (const d of similarityCandidateDepts) allDeptIds.add(d.id);

  const curriculumMap = await fetchCurriculumWithTypeBatch(Array.from(allDeptIds));
  const targetCourses = curriculumMap.get(targetDeptId) ?? [];

  // 5. 유사도 계산
  type ScoredCandidate = {
    deptId: string;
    source: BypassCandidateSource;
    score: number;
    rationale: string;
  };

  const scoredMap = new Map<string, ScoredCandidate>();

  // 5a. 사전 매핑 후보 유사도 보강 (가중치 Jaccard)
  for (const pm of preMappedCandidates) {
    const courses = curriculumMap.get(pm.deptId) ?? [];
    const sim = calculateWeightedCurriculumSimilarity(targetCourses, courses);
    scoredMap.set(pm.deptId, {
      deptId: pm.deptId,
      source: "pre_mapped",
      score: sim.weightedOverlapScore,
      rationale: pm.rationale,
    });
  }

  // 5b. 동일 대분류 유사도 계산 (가중치 Jaccard)
  for (const dept of similarityCandidateDepts) {
    if (scoredMap.has(dept.id)) continue;

    const courses = curriculumMap.get(dept.id) ?? [];
    if (courses.length === 0) continue;

    const sim = calculateWeightedCurriculumSimilarity(targetCourses, courses);
    if (sim.weightedOverlapScore < similarityThreshold) continue;

    scoredMap.set(dept.id, {
      deptId: dept.id,
      source: "similarity",
      score: sim.weightedOverlapScore,
      rationale: `교육과정 유사도 ${sim.weightedOverlapScore}% (공통 ${sim.sharedCourses.length}과목, 가중치 적용)`,
    });
  }

  // 6. 정렬 + 상위 N개 선택
  const sorted = Array.from(scoredMap.values()).sort((a, b) => {
    // 사전 매핑 우선 → 점수 내림차순
    if (a.source === "pre_mapped" && b.source !== "pre_mapped") return -1;
    if (a.source !== "pre_mapped" && b.source === "pre_mapped") return 1;
    return b.score - a.score;
  });

  const top = sorted.slice(0, maxCandidates);

  // 7. 후보 객체 생성
  const candidates = top.map((c) => ({
    tenant_id: tenantId,
    student_id: studentId,
    target_department_id: targetDeptId,
    candidate_department_id: c.deptId,
    source: c.source,
    curriculum_similarity_score: c.score,
    placement_grade: null,
    competency_fit_score: null,
    composite_score: c.score, // Phase 1: curriculum_similarity만
    rationale: c.rationale,
    consultant_notes: null,
    status: "candidate" as const,
    school_year: schoolYear,
    competency_rationale: null,
    curriculum_rationale: null,
    placement_rationale: null,
    recommendation_source: "target_based" as const,
  }));

  const preMappedCount = top.filter((c) => c.source === "pre_mapped").length;

  return {
    candidates,
    stats: {
      totalGenerated: candidates.length,
      preMapped: preMappedCount,
      similarity: candidates.length - preMappedCount,
    },
  };
}
