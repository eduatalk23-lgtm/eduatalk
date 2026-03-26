// ============================================
// Phase C-4: 피드백 패턴 → 추천 부스트
// 유사 프로필 학생이 선택한 학과에 가산점 적용
// ============================================

import type { FeedbackPattern } from "./repository";

/** 부스트 적용 대상 후보 */
export interface BoostableCandidate {
  candidate_department_id: string;
  composite_score: number | null;
  rationale: string | null;
}

/** 부스트 결과 */
export interface BoostResult {
  boostedCount: number;
  maxBoost: number;
}

/**
 * 피드백 패턴 기반 composite_score 부스트.
 *
 * - select >= 3 → +15점 (강한 신호)
 * - select >= 1 → +10점
 * - shortlist >= 3 → +5점
 * - reject >= 3 → -5점 (감점)
 * - 부스트 후 composite_score는 100을 초과하지 않음
 *
 * @param candidates 우회학과 후보 배열 (in-place 수정)
 * @param patterns 같은 mid_classification의 피드백 패턴
 * @returns 부스트 적용 통계
 */
export function applyFeedbackBoost(
  candidates: BoostableCandidate[],
  patterns: FeedbackPattern[],
): BoostResult {
  if (patterns.length === 0) return { boostedCount: 0, maxBoost: 0 };

  // 패턴 → 부스트 점수 맵
  const boostMap = new Map<string, { boost: number; reason: string }>();

  for (const p of patterns) {
    let boost = 0;
    const reasons: string[] = [];

    if (p.selectCount >= 3) {
      boost += 15;
      reasons.push(`${p.selectCount}명 선택`);
    } else if (p.selectCount >= 1) {
      boost += 10;
      reasons.push(`${p.selectCount}명 선택`);
    }

    if (p.shortlistCount >= 3) {
      boost += 5;
      reasons.push(`${p.shortlistCount}명 후보`);
    }

    if (p.rejectCount >= 3) {
      boost -= 5;
      reasons.push(`${p.rejectCount}명 제외`);
    }

    if (boost !== 0) {
      boostMap.set(p.departmentId, {
        boost,
        reason: `유사 학생 피드백: ${reasons.join(", ")}`,
      });
    }
  }

  let boostedCount = 0;
  let maxBoost = 0;

  for (const candidate of candidates) {
    const entry = boostMap.get(candidate.candidate_department_id);
    if (!entry) continue;

    const prevScore = candidate.composite_score ?? 0;
    const newScore = Math.min(100, Math.max(0, prevScore + entry.boost));
    candidate.composite_score = Math.round(newScore * 10) / 10;

    // rationale에 부스트 사유 추가
    if (candidate.rationale) {
      candidate.rationale += ` | ${entry.reason} (${entry.boost > 0 ? "+" : ""}${entry.boost}점)`;
    }

    boostedCount++;
    maxBoost = Math.max(maxBoost, Math.abs(entry.boost));
  }

  return { boostedCount, maxBoost };
}
