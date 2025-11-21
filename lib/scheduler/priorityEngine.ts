import type {
  SchoolScoreSummary,
  MockScoreSummary,
  RiskIndex,
} from "./scoreLoader";

export type PriorityConfig = {
  riskIndexWeight: number; // 위험도 가중치 (기본 35%)
  scoreWeight: number; // 성적 요소 가중치 (기본 25%)
  progressWeight: number; // 진행률 가중치 (기본 15%)
  difficultyWeight: number; // 난이도 가중치 (기본 10%)
  examUrgencyWeight: number; // 시험 임박도 가중치 (기본 10%)
  otherWeight: number; // 기타 요소 가중치 (기본 5%)
};

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  riskIndexWeight: 35,
  scoreWeight: 25,
  progressWeight: 15,
  difficultyWeight: 10,
  examUrgencyWeight: 10,
  otherWeight: 5,
};

export type PriorityInput = {
  subject: string | null;
  progress: number; // 0-100
  difficulty_level: string | null;
  recent_grade: number | null; // 내신 최근 등급
  recent_percentile: number | null; // 모의고사 최근 백분위
  risk_index: number; // 0-100
  exam_urgency: number; // 0-100 (시험 임박도)
  semester_urgency: number; // 0-100 (학기 종료 임박도)
  history?: number; // 학습 누적 속도 (선택)
};

export function calculatePriorityScore(
  input: PriorityInput,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): number {
  let totalScore = 0;

  // 1. Risk Index 점수 (0-100, 높을수록 우선순위 높음)
  const riskScore = (input.risk_index / 100) * config.riskIndexWeight;
  totalScore += riskScore;

  // 2. 성적 요소 점수
  let scoreComponent = 0;
  if (input.recent_grade !== null) {
    // 등급이 높을수록(나쁠수록) 우선순위 높음 (1등급=최고, 9등급=최악)
    // 1등급 -> 0점, 9등급 -> 100점으로 변환
    const gradeScore = ((input.recent_grade - 1) / 8) * 100;
    scoreComponent = Math.max(scoreComponent, gradeScore);
  }
  if (input.recent_percentile !== null) {
    // 백분위가 낮을수록 우선순위 높음
    // 100% -> 0점, 0% -> 100점으로 변환
    const percentileScore = ((100 - input.recent_percentile) / 100) * 100;
    scoreComponent = Math.max(scoreComponent, percentileScore);
  }
  totalScore += (scoreComponent / 100) * config.scoreWeight;

  // 3. 진행률 점수 (진행률이 낮을수록 우선순위 높음)
  // progress 0% -> 100점, progress 100% -> 0점
  const progressScore = ((100 - input.progress) / 100) * 100;
  totalScore += (progressScore / 100) * config.progressWeight;

  // 4. 난이도 점수 (난이도가 낮을수록 우선순위 높음)
  const difficultyOrder: Record<string, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };
  const difficultyValue = input.difficulty_level
    ? difficultyOrder[input.difficulty_level.toLowerCase()] || 2
    : 2;
  // easy(1) -> 100점, medium(2) -> 50점, hard(3) -> 0점
  const difficultyScore = ((3 - difficultyValue) / 2) * 100;
  totalScore += (difficultyScore / 100) * config.difficultyWeight;

  // 5. 시험 임박도 점수 (임박할수록 우선순위 높음)
  const examUrgencyScore = input.exam_urgency;
  totalScore += (examUrgencyScore / 100) * config.examUrgencyWeight;

  // 학기 종료 임박도도 반영
  const semesterUrgencyScore = input.semester_urgency;
  totalScore += (semesterUrgencyScore / 100) * config.examUrgencyWeight * 0.5; // 절반만 반영

  // 6. 기타 요소 (학습 누적 속도 등)
  if (input.history !== undefined) {
    // 학습 속도가 빠를수록(history 값이 클수록) 우선순위 높음
    const historyScore = Math.min(100, input.history * 10); // 예: history=5 -> 50점
    totalScore += (historyScore / 100) * config.otherWeight;
  }

  // 최종 점수는 0-100 범위로 정규화
  return Math.min(100, Math.max(0, totalScore));
}

// 가중치 설정 검증
export function validatePriorityConfig(config: Partial<PriorityConfig>): PriorityConfig {
  const validated: PriorityConfig = {
    ...DEFAULT_PRIORITY_CONFIG,
    ...config,
  };

  // 가중치 합이 100이 되도록 정규화
  const total =
    validated.riskIndexWeight +
    validated.scoreWeight +
    validated.progressWeight +
    validated.difficultyWeight +
    validated.examUrgencyWeight +
    validated.otherWeight;

  if (total !== 100) {
    const scale = 100 / total;
    validated.riskIndexWeight *= scale;
    validated.scoreWeight *= scale;
    validated.progressWeight *= scale;
    validated.difficultyWeight *= scale;
    validated.examUrgencyWeight *= scale;
    validated.otherWeight *= scale;
  }

  return validated;
}

