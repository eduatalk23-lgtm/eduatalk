/**
 * 대학 프로필 매칭 엔진 (B1)
 *
 * 학생의 역량 점수 프로필과 대학별 계열 요구 역량 가중치를 비교하여
 * 적합도 점수와 등급을 산출한다.
 *
 * v2: 과목 방향 점수(Subject Direction Score) 블렌딩.
 *     역량 "수준"뿐 아니라 역량 "방향"(어떤 과목에서 나왔는가)까지 반영하여
 *     세특 내용 기반의 계열 판정을 수행한다.
 *
 * 역량 ID는 constants.ts의 COMPETENCY_ITEMS 코드와 일치:
 *   academic_achievement, academic_attitude, academic_inquiry
 *   career_course_effort, career_course_achievement, career_exploration
 *   community_collaboration, community_caring, community_integrity, community_leadership
 *
 * 외부 라이브러리 의존 없음 — 순수 TypeScript.
 * 역량 ID가 프로필에 없으면 가중치 0으로 처리 (무시).
 *
 * 사용처: scripts/eval-student-record.ts (B1 통합)
 */

import { normalizeSubjectName } from "@/lib/domains/subject/normalize";
import {
  MAJOR_RECOMMENDED_COURSES_2015,
  MAJOR_RECOMMENDED_COURSES_2022,
} from "@/lib/domains/student-record/constants";
import { TIER1_TO_MAJORS } from "@/lib/constants/career-classification";
import type { CareerTier1Code } from "@/lib/constants/career-classification";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

/**
 * 대학 계열 트랙 식별자
 *
 * medical     — 의학/치의학/한의학
 * law         — 법학/정치외교
 * engineering — 공학/이공계
 * business    — 경영/경제
 * humanities  — 인문/어문
 * education   — 사범/교육
 * arts        — 예체능
 * social      — 사회복지/국제
 */
export type UniversityTrack =
  | "medical"
  | "law"
  | "engineering"
  | "business"
  | "humanities"
  | "education"
  | "arts"
  | "social";

/**
 * 대학 계열 프로필
 *
 * competencyWeights 합산이 1.0일 필요는 없다.
 * 매칭 알고리즘에서 가중치 정규화(Σ weight 나눔)를 수행한다.
 */
export interface UniversityProfile {
  track: UniversityTrack;
  /** 한국어 명칭 (예: "의학/치의학/한의학") */
  label: string;
  /** competencyId → 가중치(0 초과 1 이하). 포함되지 않은 역량은 가중치 0. */
  competencyWeights: Record<string, number>;
  /** 계열 특성 한 줄 설명 */
  description: string;
}

/** 적합도 등급 */
export type ProfileMatchGrade = "S" | "A" | "B" | "C" | "D";

/** 단일 트랙에 대한 매칭 결과 */
export interface ProfileMatchResult {
  track: UniversityTrack;
  label: string;
  /** 가중 적합도 점수 (0~100) */
  matchScore: number;
  /** 적합도 등급: S(90+) / A(80+) / B(70+) / C(60+) / D(60 미만) */
  grade: ProfileMatchGrade;
  /** 대학 프로필 핵심 역량 중 학생 점수 상위 3개 역량명 */
  strengths: string[];
  /** 대학 프로필 핵심 역량 중 학생 점수 하위 2개 역량명 */
  gaps: string[];
  /** 한 줄 추천 의견 */
  recommendation: string;
}

/** 전체 대학 프로필 매칭 분석 결과 */
export interface UniversityMatchAnalysis {
  studentId: string;
  /** 입력 역량 점수 (변경 없이 그대로 포함) */
  competencyScores: Record<string, number>;
  /** 모든 트랙 매칭 결과 (matchScore 내림차순) */
  matches: ProfileMatchResult[];
  /** 가장 높은 matchScore 트랙 */
  topMatch: ProfileMatchResult;
  /** 전체 분석 한 줄 요약 */
  summary: string;
}

// ─── 역량 레이블 매핑 ────────────────────────────────────────────────────────

/**
 * constants.ts의 COMPETENCY_ITEMS와 동기화된 역량 ID → 한국어 이름 매핑.
 * 새 역량이 추가되면 이 맵도 함께 갱신한다.
 */
const COMPETENCY_LABEL_MAP: Record<string, string> = {
  academic_achievement: "학업성취도",
  academic_attitude: "학업태도",
  academic_inquiry: "탐구력",
  career_course_effort: "전공 관련 교과 이수 노력",
  career_course_achievement: "전공 관련 교과 성취도",
  career_exploration: "진로 탐색 활동과 경험",
  community_collaboration: "협업과 소통능력",
  community_caring: "나눔과 배려",
  community_integrity: "성실성과 규칙준수",
  community_leadership: "리더십",
};

function getCompetencyLabel(id: string): string {
  return COMPETENCY_LABEL_MAP[id] ?? id;
}

// ─── 대학 계열 프로필 정의 ──────────────────────────────────────────────────

/**
 * 8개 대학 계열 프로필.
 *
 * 가중치 설계 원칙:
 * - 핵심 역량 3~4개에 높은 가중치(0.25~0.35) 집중
 * - 보조 역량 2~3개에 중간 가중치(0.10~0.20)
 * - 나머지 역량은 포함하지 않음 (가중치 0으로 자동 처리)
 * - 계열 특성에 맞지 않는 역량 배제로 변별력 확보
 */
export const UNIVERSITY_PROFILES: UniversityProfile[] = [
  {
    track: "medical",
    label: "의학/치의학/한의학",
    competencyWeights: {
      academic_achievement: 0.35,    // 내신 최우선 — 의대 진입 관문
      academic_inquiry: 0.30,        // 과학탐구 깊이 (실험·논문 탐구)
      career_course_achievement: 0.20, // 이수 과목 성취도 (생명·화학)
      community_integrity: 0.10,     // 의료 윤리 기반 성실성
      academic_attitude: 0.05,       // 자기주도 학습 태도
    },
    description:
      "내신 최상위권 + 과학·수리 탐구 깊이가 핵심. 생명과학·화학 세특 완성도와 실험 설계 경험을 중시.",
  },
  {
    track: "law",
    label: "법학/정치외교",
    competencyWeights: {
      academic_inquiry: 0.30,        // 비판적 사고·논증 역량
      academic_achievement: 0.25,    // 안정적 내신
      career_exploration: 0.20,      // 법·정치 분야 탐색 경험
      community_collaboration: 0.15, // 토론·소통 능력
      community_leadership: 0.10,    // 자치·리더십
    },
    description:
      "논리적 사고와 사회·역사적 맥락 이해가 핵심. 사회탐구 세특에서 비판적 분석력이 드러나야 함.",
  },
  {
    track: "engineering",
    label: "공학/이공계",
    competencyWeights: {
      academic_inquiry: 0.35,        // 수리·과학 탐구 깊이
      academic_achievement: 0.25,    // 수학·과학 내신
      career_course_achievement: 0.20, // 이공계 진로 과목 성취
      career_course_effort: 0.10,    // 이공계 심화 과목 이수 노력
      community_collaboration: 0.10, // 팀 프로젝트·협업
    },
    description:
      "수학·물리·화학 탐구 깊이와 실험 설계 역량이 핵심. 수식 검증·오차 분석·프로그래밍 연계 경험 우대.",
  },
  {
    track: "business",
    label: "경영/경제",
    competencyWeights: {
      academic_achievement: 0.25,    // 전반적 내신 (수학 포함)
      career_exploration: 0.25,      // 경영·경제 분야 탐색
      community_leadership: 0.20,    // 조직 리더십·기획력
      academic_inquiry: 0.15,        // 통계·계량 탐구
      community_collaboration: 0.15, // 팀 프로젝트·협업
    },
    description:
      "수리 역량과 현실 경제·경영 연계 탐구가 핵심. 리더십과 팀 프로젝트 경험이 차별화 포인트.",
  },
  {
    track: "humanities",
    label: "인문/어문",
    competencyWeights: {
      academic_inquiry: 0.35,        // 텍스트 분석·비판적 독해
      career_exploration: 0.25,      // 인문·어문 분야 탐색
      academic_achievement: 0.20,    // 국어·사회 내신
      community_collaboration: 0.10, // 토론·발표 소통
      community_caring: 0.10,        // 다양성 존중·배려
    },
    description:
      "텍스트 비판적 분석과 사회문화적 맥락 해석이 핵심. 문학·역사·철학 세특의 깊이가 변별력.",
  },
  {
    track: "education",
    label: "사범/교육",
    competencyWeights: {
      academic_achievement: 0.25,    // 전반적 내신 — 교직 적격성
      community_collaboration: 0.25, // 소통·협업 (교사 역할)
      community_caring: 0.20,        // 나눔·배려 (교육 철학)
      community_leadership: 0.15,    // 교실 리더십
      academic_attitude: 0.15,       // 자기주도 학습 태도
    },
    description:
      "나눔·배려·소통이 핵심 덕목. 멘토링·학습 지도 경험과 교육 철학이 담긴 창체 활동이 중요.",
  },
  {
    track: "arts",
    label: "예체능",
    competencyWeights: {
      career_exploration: 0.35,      // 예체능 분야 전문 탐구·실기
      career_course_effort: 0.25,    // 예체능 관련 과목 이수 노력
      academic_attitude: 0.20,       // 자기주도 연습·훈련 태도
      community_collaboration: 0.10, // 앙상블·팀 스포츠 협업
      community_integrity: 0.10,     // 훈련 규율·성실성
    },
    description:
      "전문 실기 역량과 자기주도 훈련 태도가 핵심. 진로 탐구에서 예술·체육 전문성 연계가 필수.",
  },
  {
    track: "social",
    label: "사회복지/국제",
    competencyWeights: {
      career_exploration: 0.30,      // 사회·국제 분야 탐색 경험
      community_caring: 0.25,        // 봉사·나눔 실천
      community_collaboration: 0.20, // 다문화·협력 역량
      academic_inquiry: 0.15,        // 사회과학 연구 방법론
      community_leadership: 0.10,    // 공동체 이니셔티브
    },
    description:
      "봉사·나눔 실천과 사회적 약자에 대한 이해가 핵심. 국제·NGO·복지 분야 진로 탐색 경험이 중요.",
  },
];

// ─── 등급 산출 ───────────────────────────────────────────────────────────────

function scoreToGrade(score: number): ProfileMatchGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

// ─── 추천 의견 생성 ──────────────────────────────────────────────────────────

function buildRecommendation(
  grade: ProfileMatchGrade,
  label: string,
  strengths: string[],
  gaps: string[],
): string {
  const strengthText = strengths.length > 0 ? strengths[0] : "핵심 역량";
  const gapText = gaps.length > 0 ? gaps[0] : "보완 역량";

  switch (grade) {
    case "S":
      return `${label} 계열 최적 프로필. ${strengthText} 역량이 탁월하여 지원 시 높은 경쟁력 보유.`;
    case "A":
      return `${label} 계열에 강한 적합성. ${strengthText} 역량을 중심으로 세특을 더 심화하면 변별력 확보 가능.`;
    case "B":
      return `${label} 계열 기본 적합성 충족. ${gapText} 역량 보완 시 경쟁력 향상 예상.`;
    case "C":
      return `${label} 계열 지원 가능하나 ${gapText} 역량 강화가 선행되어야 함.`;
    case "D":
      return `${label} 계열과 현재 프로필 간 거리가 큼. 진로 방향 재검토 또는 집중 보완 전략이 필요.`;
  }
}

// ─── 핵심 함수: 단일 프로필 매칭 ─────────────────────────────────────────────

/**
 * 단일 대학 프로필에 대한 매칭 결과를 계산한다.
 *
 * 알고리즘 (v2):
 *   competencyScore = Σ(역량점수 × 가중치) / Σ(가중치)
 *   directionScore  = 해당 트랙의 과목 방향 점수 (0~100)
 *   matchScore      = competencyScore × α + directionScore × (1 - α)
 *
 * α = 분석 과목이 충분하면 0.5 (반반), 과목이 적으면 1.0 (역량만).
 * directionScores가 undefined이면 v1 호환: matchScore = competencyScore.
 *
 * 학생 점수가 없는 역량(undefined)은 0점으로 처리.
 * 프로필 가중치가 0인 역량은 계산에서 제외.
 *
 * @param profile          대학 계열 프로필
 * @param scores           학생 역량 점수 (competencyId → 0~100)
 * @param directionScores  과목 방향 점수 (track → 0~100, 선택)
 * @returns                해당 트랙 매칭 결과
 */
export function matchSingleProfile(
  profile: UniversityProfile,
  scores: Record<string, number>,
  directionScores?: SubjectDirectionScores,
): ProfileMatchResult {
  const entries = Object.entries(profile.competencyWeights).filter(
    ([, w]) => w > 0,
  );

  // 가중 합산
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [id, weight] of entries) {
    const score = scores[id] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const competencyScore =
    totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

  // v2: 과목 방향 점수 블렌딩
  let matchScore = competencyScore;
  if (directionScores && Object.keys(directionScores).length > 0) {
    const dirScore = directionScores[profile.track] ?? 0;
    // α: 방향 점수가 있으면 0.5 (반반 블렌딩)
    const alpha = 0.5;
    matchScore = Math.round((competencyScore * alpha + dirScore * (1 - alpha)) * 10) / 10;
  }

  // 강점/갭 추출: 프로필 핵심 역량만 대상, 학생 점수 기준 정렬
  const ranked = entries
    .map(([id]) => ({ id, score: scores[id] ?? 0, label: getCompetencyLabel(id) }))
    .sort((a, b) => b.score - a.score);

  const strengths = ranked.slice(0, 3).map((r) => r.label);
  const gaps = ranked.slice(-2).reverse().map((r) => r.label);

  const grade = scoreToGrade(matchScore);
  const recommendation = buildRecommendation(grade, profile.label, strengths, gaps);

  return {
    track: profile.track,
    label: profile.label,
    matchScore,
    grade,
    strengths,
    gaps,
    recommendation,
  };
}

// ─── 핵심 함수: 전체 프로필 매칭 ─────────────────────────────────────────────

/**
 * 학생 역량 점수를 모든 대학 계열 프로필에 대해 매칭하여 분석 결과를 반환한다.
 *
 * @param studentId        학생 식별자
 * @param competencyScores 역량 점수 맵 (competencyId → 0~100)
 * @param directionScores  과목 방향 점수 맵 (track → 0~100, 선택)
 * @returns                전체 트랙 분석 결과 (matchScore 내림차순)
 */
export function matchUniversityProfiles(
  studentId: string,
  competencyScores: Record<string, number>,
  directionScores?: SubjectDirectionScores,
): UniversityMatchAnalysis {
  const matches = UNIVERSITY_PROFILES.map((profile) =>
    matchSingleProfile(profile, competencyScores, directionScores),
  ).sort((a, b) => b.matchScore - a.matchScore);

  const topMatch = matches[0];

  // 상위 3개 트랙 요약
  const top3 = matches.slice(0, 3).map((m) => `${m.label}(${m.grade})`).join(", ");
  const summary = `최적 계열: ${topMatch.label} (${topMatch.grade}등급, ${topMatch.matchScore}점). 상위 3개: ${top3}.`;

  return {
    studentId,
    competencyScores,
    matches,
    topMatch,
    summary,
  };
}

// ─── 과목 방향 점수 시스템 (v2) ──────────────────────────────────────────────

/**
 * 8-track → Tier 2 (MAJOR_RECOMMENDED_COURSES key) 브릿지.
 * 각 트랙이 어떤 전공 계열의 추천 과목을 참조하는지 정의.
 */
export const TRACK_TO_TIER2: Record<UniversityTrack, string[]> = {
  medical:     ["의학·약학", "보건"],
  law:         ["법·행정", "정치·외교"],
  engineering: ["컴퓨터·정보", "전기·전자", "기계·자동차·로봇",
                "화학·신소재·에너지", "건축·사회시스템"],
  business:    ["경영·경제"],
  humanities:  ["국어", "외국어", "사학·철학"],
  education:   ["교육"],
  arts:        ["음악", "미술", "체육"],
  social:      ["사회복지", "심리", "언론·홍보", "사회"],
};

/**
 * 8-track → KEDI Tier 1 코드 매핑 (희망 진로 정합성 판정용).
 * SOC는 law/business/social 3개에 걸치므로 1:N.
 */
export const TRACK_TO_TIER1: Record<UniversityTrack, CareerTier1Code[]> = {
  medical:     ["MED"],
  law:         ["SOC"],
  engineering: ["ENG"],
  business:    ["SOC"],
  humanities:  ["HUM"],
  education:   ["EDU"],
  arts:        ["ART"],
  social:      ["SOC"],
};

/**
 * Tier 1 인접 관계 (adjacent 판정용).
 * 양방향 — (A, B)가 인접이면 (B, A)도 인접.
 */
const ADJACENT_TIER1_PAIRS: ReadonlyArray<[CareerTier1Code, CareerTier1Code]> = [
  ["SOC", "HUM"],  // 사회↔인문
  ["NAT", "ENG"],  // 자연↔공학
  ["NAT", "MED"],  // 자연↔의약
  ["ENG", "MED"],  // 공학↔의약
  ["SOC", "EDU"],  // 사회↔교육
  ["HUM", "EDU"],  // 인문↔교육
];

/** 두 Tier 1 코드가 인접 관계인지 판정 */
export function areTier1Adjacent(a: CareerTier1Code, b: CareerTier1Code): boolean {
  if (a === b) return true;
  return ADJACENT_TIER1_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

// ─── 과목→트랙 역매핑 빌더 ──────────────────────────────────────────────────

/** 과목 방향 점수 입력 (트랙별 0~100) */
export type SubjectDirectionScores = Partial<Record<UniversityTrack, number>>;

/** 세특 과목별 품질 데이터 (collectSubjectDirectionScores 입력) */
export interface SubjectQualityEntry {
  /** 과목명 (DB의 subjects.name) */
  subjectName: string;
  /** content_quality.depth (1~5) */
  depth: number;
  /** content_quality.specificity (1~5) */
  specificity: number;
}

/**
 * 과목명 → 관련 트랙 목록 역매핑을 빌드한다.
 * MAJOR_RECOMMENDED_COURSES의 general/career/fusion 과목명을 정규화하여
 * 어떤 과목이 어떤 트랙에 관련되는지, 그리고 career/general 구분을 반환.
 *
 * @param curriculumYear 교육과정 연도 (2015 | 2022, 기본 2015)
 */
export function buildSubjectToTrackMap(
  curriculumYear: number = 2015,
): Map<string, { track: UniversityTrack; isCareer: boolean }[]> {
  const source = curriculumYear >= 2022
    ? MAJOR_RECOMMENDED_COURSES_2022
    : MAJOR_RECOMMENDED_COURSES_2015;

  const result = new Map<string, { track: UniversityTrack; isCareer: boolean }[]>();

  for (const [track, tier2Keys] of Object.entries(TRACK_TO_TIER2) as [UniversityTrack, string[]][]) {
    for (const tier2Key of tier2Keys) {
      const courses = source[tier2Key];
      if (!courses) continue;

      // general 과목
      for (const name of courses.general) {
        const key = normalizeSubjectName(name);
        const arr = result.get(key) ?? [];
        if (!arr.some(e => e.track === track && !e.isCareer)) {
          arr.push({ track, isCareer: false });
        }
        result.set(key, arr);
      }

      // career 과목
      for (const name of courses.career) {
        const key = normalizeSubjectName(name);
        const arr = result.get(key) ?? [];
        if (!arr.some(e => e.track === track && e.isCareer)) {
          arr.push({ track, isCareer: true });
        }
        result.set(key, arr);
      }

      // fusion 과목 (2022 개정)
      const fusion = "fusion" in courses && courses.fusion;
      if (fusion) {
        for (const name of fusion as string[]) {
          const key = normalizeSubjectName(name);
          const arr = result.get(key) ?? [];
          if (!arr.some(e => e.track === track && e.isCareer)) {
            arr.push({ track, isCareer: true }); // fusion은 career와 동급 취급
          }
          result.set(key, arr);
        }
      }
    }
  }

  return result;
}

/**
 * 세특 과목별 품질 데이터로부터 트랙별 과목 방향 점수를 산출한다.
 *
 * 알고리즘 (v2.1 — max-normalization):
 *   1. 각 세특 과목명을 정규화하여 트랙 역매핑에서 관련 트랙을 조회
 *   2. 관련 트랙에 대해 quality = (depth + specificity) / 10 (0~1) 기여
 *   3. career 과목은 0.7 비중, general 과목은 0.3 비중
 *   4. 트랙별 rawScore = Σ(quality × typeWeight)  ← 절대 가중 합산
 *   5. 트랙 간 상대 비교: directionScore = (rawScore / maxRawScore) × 100
 *
 * 기존 "추천과목수 분모" 방식의 문제점:
 *   arts(9개)와 engineering(21개)의 분모 차이로 미술·체육·음악감상 등
 *   일반교양 과목만으로 arts가 1위가 되는 구조적 바이어스.
 *   max-normalization으로 트랙 간 공정 비교를 달성.
 *
 * @param entries         세특 과목별 품질 데이터
 * @param curriculumYear  교육과정 연도 (기본 2015)
 * @returns               트랙별 방향 점수 (0~100)
 */
export function collectSubjectDirectionScores(
  entries: SubjectQualityEntry[],
  curriculumYear: number = 2015,
): SubjectDirectionScores {
  if (entries.length === 0) return {};

  const subjectToTrack = buildSubjectToTrackMap(curriculumYear);

  // 트랙별 가중 합산 (절대값)
  const trackAccum: Record<string, number> = {};

  for (const entry of entries) {
    const key = normalizeSubjectName(entry.subjectName);
    const mappings = subjectToTrack.get(key);
    if (!mappings) continue;

    const quality = (entry.depth + entry.specificity) / 10; // 0~1

    for (const { track, isCareer } of mappings) {
      const typeWeight = isCareer ? 0.7 : 0.3;
      trackAccum[track] = (trackAccum[track] ?? 0) + quality * typeWeight;
    }
  }

  // max-normalization: 가장 높은 rawScore를 100으로 스케일링
  // 최소 기준: rawScore 합산이 0.5 미만이면 방향 신호가 너무 약아 무시
  // (career 1과목 quality 0.7 × 0.7 = 0.49, general 2과목 quality 0.5 × 0.3 × 2 = 0.30)
  const MIN_RAW_THRESHOLD = 0.5;

  const rawScores = Object.entries(trackAccum);
  if (rawScores.length === 0) return {};

  const maxRaw = Math.max(...rawScores.map(([, v]) => v));
  if (maxRaw < MIN_RAW_THRESHOLD) return {};

  const result: SubjectDirectionScores = {};
  for (const [track, weightedSum] of rawScores) {
    const normalized = (weightedSum / maxRaw) * 100;
    result[track as UniversityTrack] = Math.round(normalized * 10) / 10;
  }

  return result;
}

// ─── 희망 진로 정합성 판정 ──────────────────────────────────────────────────

export type CareerAlignmentStatus = "aligned" | "adjacent" | "divergent";

export interface CareerAlignmentResult {
  studentTarget: { tier1Code: CareerTier1Code; tier2Key: string };
  diagnosedTrack: { track: UniversityTrack; label: string };
  status: CareerAlignmentStatus;
  message: string;
}

/**
 * 희망 진로(target_major)와 1축 진단 결과(topTrack) 간 정합성을 판정한다.
 *
 * @param targetMajor   students.target_major (Tier 2 key)
 * @param topTrack      1축 진단 결과 상위 트랙
 * @returns             정합성 결과 (null = target_major 미설정)
 */
export function assessCareerAlignment(
  targetMajor: string | null | undefined,
  topTrack: ProfileMatchResult,
): CareerAlignmentResult | null {
  if (!targetMajor) return null;

  // target_major → Tier 1 코드 찾기
  let studentTier1: CareerTier1Code | null = null;
  for (const [tier1, majors] of Object.entries(TIER1_TO_MAJORS)) {
    if ((majors as readonly string[]).includes(targetMajor)) {
      studentTier1 = tier1 as CareerTier1Code;
      break;
    }
  }
  if (!studentTier1) return null; // 매핑 불가

  // topTrack → Tier 1 코드들
  const trackTier1s = TRACK_TO_TIER1[topTrack.track];

  // 판정
  let status: CareerAlignmentStatus;
  if (trackTier1s.includes(studentTier1)) {
    status = "aligned";
  } else if (trackTier1s.some(t => areTier1Adjacent(t, studentTier1!))) {
    status = "adjacent";
  } else {
    status = "divergent";
  }

  const trackLabel = topTrack.label;
  const message = status === "aligned"
    ? ""
    : status === "adjacent"
    ? `희망 진로(${targetMajor})와 생기부 방향(${trackLabel})이 인접 계열입니다.`
    : `희망 진로(${targetMajor})와 생기부 진단(${trackLabel}) 간 괴리가 감지됩니다. 진로 방향 또는 세특 내용 보완을 검토하세요.`;

  return {
    studentTarget: { tier1Code: studentTier1, tier2Key: targetMajor },
    diagnosedTrack: { track: topTrack.track, label: trackLabel },
    status,
    message,
  };
}
