// ============================================================
// 우회학과 고도화 상수
// 계열 매핑 + 역량 가중치
// ============================================================

import type { CompetencyItemCode } from "@/lib/domains/student-record/types";

// ------------------------------------
// 1. department_classification.mid_name → MAJOR_RECOMMENDED_COURSES key 매핑
//    → lib/constants/career-classification.ts로 이관 (KEDI_MID_TO_MAJOR)
// ------------------------------------

export { KEDI_MID_TO_MAJOR as CLASSIFICATION_TO_CAREER_FIELD } from "@/lib/constants/career-classification";

// ------------------------------------
// 2. 계열별 역량 기본 가중치 (10개 항목)
// ------------------------------------

export type CompetencyWeights = Record<CompetencyItemCode, number>;

/** 역량 등급 → 점수 변환 */
export const GRADE_TO_SCORE: Record<string, number> = {
  "A+": 100,
  "A-": 87,
  "B+": 75,
  "B": 65,
  "B-": 55,
  "C": 40,
};

/** 균등 가중치 (매핑 없는 계열 기본값) */
export const DEFAULT_COMPETENCY_WEIGHTS: CompetencyWeights = {
  academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.0,
  career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
  community_collaboration: 1.0, community_caring: 1.0, community_integrity: 1.0, community_leadership: 1.0,
};

/**
 * 계열별 역량 가중치
 *
 * 학업역량(3): 성취도, 태도, 탐구력
 * 진로역량(3): 과목이수노력, 과목성취도, 진로탐색
 * 공동체역량(4): 협업, 배려, 성실성, 리더십
 */
export const CAREER_FIELD_COMPETENCY_WEIGHTS: Record<string, CompetencyWeights> = {
  "의학·약학": {
    academic_achievement: 1.8, academic_attitude: 1.0, academic_inquiry: 1.5,
    career_course_effort: 1.5, career_course_achievement: 1.5, career_exploration: 0.7,
    community_collaboration: 0.4, community_caring: 0.6, community_integrity: 0.5, community_leadership: 0.5,
  },
  "컴퓨터·정보": {
    academic_achievement: 1.0, academic_attitude: 0.7, academic_inquiry: 1.8,
    career_course_effort: 1.2, career_course_achievement: 1.0, career_exploration: 1.5,
    community_collaboration: 1.0, community_caring: 0.3, community_integrity: 0.7, community_leadership: 0.8,
  },
  "전기·전자": {
    academic_achievement: 1.2, academic_attitude: 0.8, academic_inquiry: 1.5,
    career_course_effort: 1.3, career_course_achievement: 1.2, career_exploration: 1.2,
    community_collaboration: 0.8, community_caring: 0.3, community_integrity: 0.8, community_leadership: 0.9,
  },
  "기계·자동차·로봇": {
    academic_achievement: 1.2, academic_attitude: 0.8, academic_inquiry: 1.5,
    career_course_effort: 1.3, career_course_achievement: 1.2, career_exploration: 1.2,
    community_collaboration: 0.8, community_caring: 0.3, community_integrity: 0.8, community_leadership: 0.9,
  },
  "화학·신소재·에너지": {
    academic_achievement: 1.3, academic_attitude: 0.8, academic_inquiry: 1.6,
    career_course_effort: 1.3, career_course_achievement: 1.2, career_exploration: 1.0,
    community_collaboration: 0.7, community_caring: 0.3, community_integrity: 0.8, community_leadership: 1.0,
  },
  "건축·사회시스템": {
    academic_achievement: 1.2, academic_attitude: 0.8, academic_inquiry: 1.3,
    career_course_effort: 1.2, career_course_achievement: 1.2, career_exploration: 1.0,
    community_collaboration: 1.0, community_caring: 0.5, community_integrity: 0.8, community_leadership: 1.0,
  },
  "생명·바이오": {
    academic_achievement: 1.3, academic_attitude: 0.9, academic_inquiry: 1.6,
    career_course_effort: 1.3, career_course_achievement: 1.2, career_exploration: 1.0,
    community_collaboration: 0.7, community_caring: 0.4, community_integrity: 0.7, community_leadership: 0.9,
  },
  "물리·천문": {
    academic_achievement: 1.4, academic_attitude: 0.8, academic_inquiry: 1.8,
    career_course_effort: 1.3, career_course_achievement: 1.2, career_exploration: 0.8,
    community_collaboration: 0.6, community_caring: 0.3, community_integrity: 0.8, community_leadership: 1.0,
  },
  "수리·통계": {
    academic_achievement: 1.5, academic_attitude: 0.8, academic_inquiry: 1.6,
    career_course_effort: 1.3, career_course_achievement: 1.3, career_exploration: 0.8,
    community_collaboration: 0.6, community_caring: 0.3, community_integrity: 0.8, community_leadership: 1.0,
  },
  "경영·경제": {
    academic_achievement: 1.2, academic_attitude: 1.0, academic_inquiry: 1.0,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 1.0, community_caring: 0.5, community_integrity: 0.8, community_leadership: 1.5,
  },
  "법·행정": {
    academic_achievement: 1.3, academic_attitude: 1.0, academic_inquiry: 1.0,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 0.8,
    community_collaboration: 0.8, community_caring: 0.8, community_integrity: 1.0, community_leadership: 1.3,
  },
  "사회": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.2,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 1.0, community_caring: 0.8, community_integrity: 0.8, community_leadership: 1.2,
  },
  "심리": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.3,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.2,
    community_collaboration: 1.0, community_caring: 1.0, community_integrity: 0.7, community_leadership: 0.8,
  },
  "사회복지": {
    academic_achievement: 0.8, academic_attitude: 1.0, academic_inquiry: 0.8,
    career_course_effort: 0.8, career_course_achievement: 0.8, career_exploration: 1.0,
    community_collaboration: 1.3, community_caring: 1.5, community_integrity: 1.0, community_leadership: 1.0,
  },
  "교육": {
    academic_achievement: 1.2, academic_attitude: 1.2, academic_inquiry: 1.0,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 0.8,
    community_collaboration: 1.0, community_caring: 1.0, community_integrity: 1.0, community_leadership: 0.8,
  },
  "국어": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.3,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 0.8, community_caring: 0.5, community_integrity: 0.8, community_leadership: 1.6,
  },
  "외국어": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.0,
    career_course_effort: 1.2, career_course_achievement: 1.2, career_exploration: 1.2,
    community_collaboration: 1.0, community_caring: 0.5, community_integrity: 0.5, community_leadership: 1.4,
  },
  "사학·철학": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.5,
    career_course_effort: 1.0, career_course_achievement: 0.8, career_exploration: 1.2,
    community_collaboration: 0.8, community_caring: 0.5, community_integrity: 1.0, community_leadership: 1.2,
  },
  "언론·홍보": {
    academic_achievement: 0.8, academic_attitude: 1.0, academic_inquiry: 1.2,
    career_course_effort: 0.8, career_course_achievement: 0.8, career_exploration: 1.3,
    community_collaboration: 1.3, community_caring: 0.5, community_integrity: 0.8, community_leadership: 1.5,
  },
  "정치·외교": {
    academic_achievement: 1.2, academic_attitude: 1.0, academic_inquiry: 1.0,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 1.0, community_caring: 0.5, community_integrity: 0.8, community_leadership: 1.5,
  },
  "보건": {
    academic_achievement: 1.3, academic_attitude: 1.0, academic_inquiry: 1.2,
    career_course_effort: 1.2, career_course_achievement: 1.2, career_exploration: 0.8,
    community_collaboration: 0.6, community_caring: 1.0, community_integrity: 0.8, community_leadership: 0.9,
  },
  "생활과학": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.2,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 0.8, community_caring: 1.0, community_integrity: 1.0, community_leadership: 1.0,
  },
  "농림": {
    academic_achievement: 1.0, academic_attitude: 1.0, academic_inquiry: 1.3,
    career_course_effort: 1.0, career_course_achievement: 1.0, career_exploration: 1.0,
    community_collaboration: 0.8, community_caring: 0.5, community_integrity: 1.0, community_leadership: 1.4,
  },
};
