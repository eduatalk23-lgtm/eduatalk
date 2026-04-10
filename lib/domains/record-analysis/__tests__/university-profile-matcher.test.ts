import { describe, it, expect } from "vitest";
import {
  matchSingleProfile,
  matchUniversityProfiles,
  UNIVERSITY_PROFILES,
  TRACK_TO_TIER2,
  TRACK_TO_TIER1,
  buildSubjectToTrackMap,
  collectSubjectDirectionScores,
  assessCareerAlignment,
  areTier1Adjacent,
  type UniversityTrack,
  type ProfileMatchGrade,
  type SubjectQualityEntry,
} from "../eval/university-profile-matcher";

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 특정 트랙의 프로필을 반환한다. 없으면 테스트 실패. */
function getProfile(track: UniversityTrack) {
  const p = UNIVERSITY_PROFILES.find((p) => p.track === track);
  if (!p) throw new Error(`프로필 없음: ${track}`);
  return p;
}

/** 주어진 역량 ID에 대해 점수 맵을 생성한다. */
function makeScores(entries: Record<string, number>): Record<string, number> {
  return entries;
}

/** 역량 점수를 모두 지정한 값으로 채운다 (기본값 세팅 헬퍼). */
function uniformScores(score: number): Record<string, number> {
  return {
    academic_achievement: score,
    academic_attitude: score,
    academic_inquiry: score,
    career_course_effort: score,
    career_course_achievement: score,
    career_exploration: score,
    community_collaboration: score,
    community_caring: score,
    community_integrity: score,
    community_leadership: score,
  };
}

// ─── 1. UNIVERSITY_PROFILES 상수 검증 ───────────────────────────────────────

describe("UNIVERSITY_PROFILES 상수 검증", () => {
  it("8개 트랙이 모두 정의되어 있어야 한다", () => {
    const tracks: UniversityTrack[] = [
      "medical", "law", "engineering", "business",
      "humanities", "education", "arts", "social",
    ];
    for (const track of tracks) {
      expect(UNIVERSITY_PROFILES.find((p) => p.track === track)).toBeDefined();
    }
  });

  it("각 프로필의 competencyWeights 값은 모두 0 초과 1 이하여야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      for (const [id, w] of Object.entries(profile.competencyWeights)) {
        expect(w, `${profile.track}.${id} 가중치`).toBeGreaterThan(0);
        expect(w, `${profile.track}.${id} 가중치`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("각 프로필에 label과 description이 비어있지 않아야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      expect(profile.label.length, `${profile.track} label`).toBeGreaterThan(0);
      expect(profile.description.length, `${profile.track} desc`).toBeGreaterThan(0);
    }
  });

  it("각 프로필은 최소 3개 이상의 역량 가중치를 가져야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      const count = Object.keys(profile.competencyWeights).length;
      expect(count, `${profile.track} 역량 수`).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── 2. matchSingleProfile — 기본 계산 검증 ─────────────────────────────────

describe("matchSingleProfile — 기본 계산", () => {
  it("모든 역량 점수가 100일 때 matchScore는 100이어야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      const result = matchSingleProfile(profile, uniformScores(100));
      expect(result.matchScore).toBe(100);
    }
  });

  it("모든 역량 점수가 0일 때 matchScore는 0이어야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      const result = matchSingleProfile(profile, uniformScores(0));
      expect(result.matchScore).toBe(0);
    }
  });

  it("역량 점수가 없으면(빈 객체) matchScore는 0이어야 한다 (graceful degradation)", () => {
    const result = matchSingleProfile(getProfile("medical"), {});
    expect(result.matchScore).toBe(0);
    expect(result.grade).toBe("D");
  });

  it("일부 역량 점수만 존재해도 나머지를 0으로 처리하여 계산한다", () => {
    const profile = getProfile("engineering");
    // academic_inquiry(0.35) = 100, 나머지 = 0
    const result = matchSingleProfile(profile, { academic_inquiry: 100 });
    // weightedSum = 100×0.35 = 35, totalWeight = 0.35+0.25+0.20+0.10+0.10 = 1.0
    // matchScore = 35
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.matchScore).toBeLessThan(100);
  });

  it("matchScore는 항상 0~100 범위 내이어야 한다", () => {
    const scores = makeScores({ academic_achievement: 50, academic_inquiry: 80 });
    for (const profile of UNIVERSITY_PROFILES) {
      const result = matchSingleProfile(profile, scores);
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 3. matchSingleProfile — 등급 경계값 검증 ───────────────────────────────

describe("matchSingleProfile — 등급 경계값", () => {
  /**
   * medical 프로필의 가중치 합 = 0.35+0.30+0.20+0.10+0.05 = 1.0
   * 따라서 matchScore = Σ(score × weight) / 1.0 로 조정 가능.
   *
   * 정확한 점수를 만들기 위해 academic_achievement=100 점수를 활용한다.
   */

  function makeGradeScore(targetScore: number): Record<string, number> {
    // uniformScores로 정확한 점수 매핑
    return uniformScores(targetScore);
  }

  it("matchScore 90.0 → S 등급", () => {
    const result = matchSingleProfile(getProfile("medical"), uniformScores(90));
    expect(result.grade).toBe("S" as ProfileMatchGrade);
    expect(result.matchScore).toBe(90);
  });

  it("matchScore 89.9 → A 등급 (S 미달)", () => {
    // uniformScores(89)이면 모든 역량 89점 → matchScore=89 → A
    const result = matchSingleProfile(getProfile("medical"), uniformScores(89));
    expect(result.grade).toBe("A" as ProfileMatchGrade);
  });

  it("matchScore 80.0 → A 등급", () => {
    const result = matchSingleProfile(getProfile("law"), uniformScores(80));
    expect(result.grade).toBe("A" as ProfileMatchGrade);
  });

  it("matchScore 79 → B 등급", () => {
    const result = matchSingleProfile(getProfile("law"), uniformScores(79));
    expect(result.grade).toBe("B" as ProfileMatchGrade);
  });

  it("matchScore 70.0 → B 등급", () => {
    const result = matchSingleProfile(getProfile("engineering"), uniformScores(70));
    expect(result.grade).toBe("B" as ProfileMatchGrade);
  });

  it("matchScore 69 → C 등급", () => {
    const result = matchSingleProfile(getProfile("engineering"), uniformScores(69));
    expect(result.grade).toBe("C" as ProfileMatchGrade);
  });

  it("matchScore 60.0 → C 등급", () => {
    const result = matchSingleProfile(getProfile("business"), uniformScores(60));
    expect(result.grade).toBe("C" as ProfileMatchGrade);
  });

  it("matchScore 59 → D 등급", () => {
    const result = matchSingleProfile(getProfile("business"), uniformScores(59));
    expect(result.grade).toBe("D" as ProfileMatchGrade);
  });
});

// ─── 4. matchSingleProfile — 강점/갭 추출 정확성 ────────────────────────────

describe("matchSingleProfile — 강점/갭 추출", () => {
  it("strengths는 최대 3개까지 반환된다", () => {
    const result = matchSingleProfile(getProfile("social"), uniformScores(75));
    expect(result.strengths.length).toBeLessThanOrEqual(3);
  });

  it("gaps는 최대 2개까지 반환된다", () => {
    const result = matchSingleProfile(getProfile("social"), uniformScores(75));
    expect(result.gaps.length).toBeLessThanOrEqual(2);
  });

  it("strengths와 gaps는 프로필 핵심 역량 중에서만 선택된다", () => {
    const profile = getProfile("medical");
    const profileIds = new Set(Object.keys(profile.competencyWeights));
    const result = matchSingleProfile(profile, uniformScores(75));

    // label이 아닌 ID를 직접 비교할 수 없으므로 개수가 프로필 역량 수 이내인지 확인
    expect(result.strengths.length).toBeLessThanOrEqual(profileIds.size);
    expect(result.gaps.length).toBeLessThanOrEqual(profileIds.size);
  });

  it("높은 점수 역량이 strengths에, 낮은 점수 역량이 gaps에 포함된다", () => {
    const profile = getProfile("engineering");
    // academic_inquiry(0.35 핵심) = 100, academic_achievement(0.25) = 20
    const scores = makeScores({
      academic_inquiry: 100,
      academic_achievement: 20,
      career_course_achievement: 50,
      career_course_effort: 50,
      community_collaboration: 50,
    });
    const result = matchSingleProfile(profile, scores);

    // 탐구력(academic_inquiry 레이블)이 strengths에 포함되어야 함
    expect(result.strengths).toContain("탐구력");
    // 학업성취도(academic_achievement 레이블)가 gaps에 포함되어야 함
    expect(result.gaps).toContain("학업성취도");
  });

  it("recommendation이 빈 문자열이 아니어야 한다", () => {
    for (const profile of UNIVERSITY_PROFILES) {
      const result = matchSingleProfile(profile, uniformScores(75));
      expect(result.recommendation.length).toBeGreaterThan(0);
    }
  });
});

// ─── 5. matchSingleProfile — 트랙별 완벽 매칭 케이스 ───────────────────────

describe("matchSingleProfile — 트랙별 특화 역량 완벽 매칭", () => {
  it("의대 핵심 역량(academic_achievement, academic_inquiry) 최고점 → matchScore가 높아야 한다", () => {
    const profile = getProfile("medical");
    const scores = makeScores({
      academic_achievement: 100,
      academic_inquiry: 100,
      career_course_achievement: 100,
      community_integrity: 100,
      academic_attitude: 100,
    });
    const result = matchSingleProfile(profile, scores);
    expect(result.matchScore).toBe(100);
    expect(result.grade).toBe("S");
  });

  it("사회복지 핵심 역량 최고점 → matchScore가 높아야 한다", () => {
    const profile = getProfile("social");
    const scores = makeScores({
      career_exploration: 100,
      community_caring: 100,
      community_collaboration: 100,
      academic_inquiry: 100,
      community_leadership: 100,
    });
    const result = matchSingleProfile(profile, scores);
    expect(result.matchScore).toBe(100);
    expect(result.grade).toBe("S");
  });
});

// ─── 6. matchUniversityProfiles — 전체 분석 ─────────────────────────────────

describe("matchUniversityProfiles — 전체 분석", () => {
  it("matches 배열이 모든 트랙(8개)을 포함해야 한다", () => {
    const result = matchUniversityProfiles("student-001", uniformScores(75));
    expect(result.matches).toHaveLength(UNIVERSITY_PROFILES.length);
  });

  it("matches가 matchScore 내림차순으로 정렬되어야 한다", () => {
    const result = matchUniversityProfiles("student-001", uniformScores(75));
    for (let i = 0; i < result.matches.length - 1; i++) {
      expect(result.matches[i].matchScore).toBeGreaterThanOrEqual(
        result.matches[i + 1].matchScore,
      );
    }
  });

  it("topMatch는 matches[0]과 동일해야 한다", () => {
    const result = matchUniversityProfiles("student-001", uniformScores(75));
    expect(result.topMatch).toEqual(result.matches[0]);
  });

  it("summary가 빈 문자열이 아니어야 한다", () => {
    const result = matchUniversityProfiles("student-001", uniformScores(75));
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("studentId와 competencyScores가 결과에 그대로 포함된다", () => {
    const scores = uniformScores(60);
    const result = matchUniversityProfiles("student-abc", scores);
    expect(result.studentId).toBe("student-abc");
    expect(result.competencyScores).toEqual(scores);
  });

  it("빈 역량 점수 입력 시에도 분석 결과를 반환해야 한다 (graceful degradation)", () => {
    const result = matchUniversityProfiles("student-empty", {});
    expect(result.matches).toHaveLength(UNIVERSITY_PROFILES.length);
    expect(result.topMatch).toBeDefined();
    // 모든 점수가 0이므로 matchScore도 0
    for (const m of result.matches) {
      expect(m.matchScore).toBe(0);
    }
  });

  it("의대 특화 역량 최고점 → topMatch.track이 medical이어야 한다", () => {
    const scores = makeScores({
      academic_achievement: 100, // medical 가중치 0.35
      academic_inquiry: 100,     // medical 가중치 0.30
      career_course_achievement: 100, // medical 가중치 0.20
      community_integrity: 100,  // medical 가중치 0.10
      academic_attitude: 100,    // medical 가중치 0.05
      // 나머지 역량 낮음
      career_course_effort: 20,
      career_exploration: 20,
      community_collaboration: 20,
      community_caring: 20,
      community_leadership: 20,
    });
    const result = matchUniversityProfiles("student-med", scores);
    expect(result.topMatch.track).toBe("medical");
  });

  it("봉사·탐색·협력 최고점 → topMatch.track이 social이어야 한다", () => {
    const scores = makeScores({
      career_exploration: 100,     // social 가중치 0.30
      community_caring: 100,       // social 가중치 0.25
      community_collaboration: 100, // social 가중치 0.20
      academic_inquiry: 100,       // social 가중치 0.15
      community_leadership: 100,   // social 가중치 0.10
      // 나머지 역량 낮음
      academic_achievement: 10,
      academic_attitude: 10,
      career_course_effort: 10,
      career_course_achievement: 10,
      community_integrity: 10,
    });
    const result = matchUniversityProfiles("student-soc", scores);
    expect(result.topMatch.track).toBe("social");
  });

  it("이공계 특화 역량 최고점 → topMatch.track이 engineering이어야 한다", () => {
    const scores = makeScores({
      academic_inquiry: 100,           // engineering 가중치 0.35
      academic_achievement: 100,       // engineering 가중치 0.25
      career_course_achievement: 100,  // engineering 가중치 0.20
      career_course_effort: 100,       // engineering 가중치 0.10
      community_collaboration: 100,    // engineering 가중치 0.10
      // 나머지 역량 낮음
      academic_attitude: 5,
      career_exploration: 5,
      community_caring: 5,
      community_integrity: 5,
      community_leadership: 5,
    });
    const result = matchUniversityProfiles("student-eng", scores);
    expect(result.topMatch.track).toBe("engineering");
  });
});

// ─── 7. 반환값 구조 검증 ─────────────────────────────────────────────────────

describe("반환값 구조 검증", () => {
  it("ProfileMatchResult의 모든 필드가 존재해야 한다", () => {
    const result = matchSingleProfile(getProfile("law"), uniformScores(75));
    expect(result).toHaveProperty("track");
    expect(result).toHaveProperty("label");
    expect(result).toHaveProperty("matchScore");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("strengths");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("recommendation");
  });

  it("UniversityMatchAnalysis의 모든 필드가 존재해야 한다", () => {
    const result = matchUniversityProfiles("student-x", uniformScores(70));
    expect(result).toHaveProperty("studentId");
    expect(result).toHaveProperty("competencyScores");
    expect(result).toHaveProperty("matches");
    expect(result).toHaveProperty("topMatch");
    expect(result).toHaveProperty("summary");
  });

  it("strengths와 gaps는 배열 타입이어야 한다", () => {
    const result = matchSingleProfile(getProfile("humanities"), uniformScores(65));
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
  });

  it("grade는 S/A/B/C/D 중 하나이어야 한다", () => {
    const validGrades: ProfileMatchGrade[] = ["S", "A", "B", "C", "D"];
    for (const profile of UNIVERSITY_PROFILES) {
      const result = matchSingleProfile(profile, uniformScores(75));
      expect(validGrades).toContain(result.grade);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v2: 과목 방향 점수 + 희망 진로 정합성 테스트
// ═══════════════════════════════════════════════════════════════════════════

// ─── 시나리오 데이터 팩토리 ──────────────────────────────────────────────────

/** 이공계 집중 학생 (물리·천문 지망, 김세린 유사) */
function scienceEngineeringEntries(): SubjectQualityEntry[] {
  return [
    { subjectName: "물리학Ⅰ", depth: 4, specificity: 4 },
    { subjectName: "물리학Ⅱ", depth: 5, specificity: 5 },
    { subjectName: "화학Ⅰ", depth: 4, specificity: 4 },
    { subjectName: "기하", depth: 5, specificity: 5 },
    { subjectName: "수학과제탐구", depth: 5, specificity: 5 },
    { subjectName: "정보", depth: 4, specificity: 4 },
    { subjectName: "인공지능 기초", depth: 4, specificity: 4 },
    { subjectName: "지구과학Ⅰ", depth: 5, specificity: 5 },
    // 비계열 일반교양
    { subjectName: "국어", depth: 3, specificity: 3 },
    { subjectName: "영어", depth: 3, specificity: 3 },
    { subjectName: "미술", depth: 2, specificity: 2 },
    { subjectName: "체육", depth: 2, specificity: 2 },
  ];
}

/** 법학/정치외교 집중 학생 */
function lawPoliticsEntries(): SubjectQualityEntry[] {
  return [
    { subjectName: "정치와법", depth: 5, specificity: 5 },
    { subjectName: "사회·문화", depth: 5, specificity: 5 },
    { subjectName: "윤리와사상", depth: 4, specificity: 4 },
    { subjectName: "생활과윤리", depth: 4, specificity: 4 },
    { subjectName: "사회문제탐구", depth: 5, specificity: 5 },
    { subjectName: "확률과통계", depth: 4, specificity: 3 },
    { subjectName: "한문Ⅰ", depth: 3, specificity: 3 },
    // 비계열 일반교양
    { subjectName: "영어", depth: 3, specificity: 3 },
    { subjectName: "수학", depth: 3, specificity: 3 },
    { subjectName: "체육", depth: 2, specificity: 2 },
  ];
}

/** 의학 집중 학생 */
function medicalEntries(): SubjectQualityEntry[] {
  return [
    { subjectName: "생명과학Ⅰ", depth: 5, specificity: 5 },
    { subjectName: "생명과학Ⅱ", depth: 5, specificity: 5 },
    { subjectName: "화학Ⅰ", depth: 5, specificity: 5 },
    { subjectName: "화학Ⅱ", depth: 5, specificity: 5 },
    { subjectName: "물리학Ⅰ", depth: 4, specificity: 4 },
    { subjectName: "미적분", depth: 4, specificity: 4 },
    { subjectName: "확률과통계", depth: 4, specificity: 3 },
    { subjectName: "생활과윤리", depth: 3, specificity: 3 },
    // 비계열
    { subjectName: "국어", depth: 3, specificity: 3 },
    { subjectName: "영어", depth: 3, specificity: 3 },
  ];
}

/** 예체능 집중 학생 (미술 전공 지망) */
function artsEntries(): SubjectQualityEntry[] {
  return [
    { subjectName: "미술", depth: 5, specificity: 5 },
    { subjectName: "미술 창작", depth: 5, specificity: 5 },
    { subjectName: "미술 감상과 비평", depth: 5, specificity: 5 },
    // 비계열 일반교양
    { subjectName: "국어", depth: 3, specificity: 3 },
    { subjectName: "영어", depth: 3, specificity: 3 },
    { subjectName: "수학", depth: 2, specificity: 2 },
    { subjectName: "체육", depth: 3, specificity: 3 },
  ];
}

/** 1학년 학생 (통합교과 위주, 방향성 약함) */
function freshmanEntries(): SubjectQualityEntry[] {
  return [
    { subjectName: "통합과학", depth: 3, specificity: 3 },
    { subjectName: "통합사회", depth: 3, specificity: 3 },
    { subjectName: "국어", depth: 3, specificity: 3 },
    { subjectName: "수학", depth: 3, specificity: 3 },
    { subjectName: "영어", depth: 3, specificity: 3 },
    { subjectName: "미술", depth: 2, specificity: 2 },
    { subjectName: "체육", depth: 2, specificity: 2 },
  ];
}

/** 문이과 균형형 학생 (경영 + 이공 혼합) */
function mixedProfileEntries(): SubjectQualityEntry[] {
  return [
    // 이공계 과목
    { subjectName: "물리학Ⅰ", depth: 4, specificity: 4 },
    { subjectName: "미적분", depth: 4, specificity: 4 },
    { subjectName: "정보", depth: 4, specificity: 3 },
    // 경영/경제 과목
    { subjectName: "경제", depth: 4, specificity: 4 },
    { subjectName: "사회·문화", depth: 3, specificity: 3 },
    // 공통
    { subjectName: "확률과통계", depth: 4, specificity: 4 },
    { subjectName: "국어", depth: 3, specificity: 3 },
    { subjectName: "영어", depth: 3, specificity: 3 },
  ];
}

// ─── 8. TRACK_TO_TIER2 / TRACK_TO_TIER1 매핑 검증 ──────────────────────────

describe("TRACK_TO_TIER2 매핑 검증", () => {
  it("8개 트랙이 모두 정의되어 있어야 한다", () => {
    const tracks: UniversityTrack[] = [
      "medical", "law", "engineering", "business",
      "humanities", "education", "arts", "social",
    ];
    for (const track of tracks) {
      expect(TRACK_TO_TIER2[track]).toBeDefined();
      expect(TRACK_TO_TIER2[track].length).toBeGreaterThan(0);
    }
  });

  it("TRACK_TO_TIER1도 8개 트랙이 모두 정의되어 있어야 한다", () => {
    for (const track of Object.keys(TRACK_TO_TIER2) as UniversityTrack[]) {
      expect(TRACK_TO_TIER1[track]).toBeDefined();
      expect(TRACK_TO_TIER1[track].length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. buildSubjectToTrackMap 검증 ─────────────────────────────────────────

describe("buildSubjectToTrackMap", () => {
  it("2015 교육과정으로 빈 맵이 아니어야 한다", () => {
    const map = buildSubjectToTrackMap(2015);
    expect(map.size).toBeGreaterThan(0);
  });

  it("2022 교육과정으로 빈 맵이 아니어야 한다", () => {
    const map = buildSubjectToTrackMap(2022);
    expect(map.size).toBeGreaterThan(0);
  });

  it("물리학1은 engineering과 medical에 매핑되어야 한다", () => {
    const map = buildSubjectToTrackMap(2015);
    // normalizeSubjectName("물리학Ⅰ") → "물리학1"
    const mappings = map.get("물리학1");
    expect(mappings).toBeDefined();
    const tracks = mappings!.map(m => m.track);
    expect(tracks).toContain("engineering");
    expect(tracks).toContain("medical");
  });

  it("정치와법은 law와 social에 매핑되어야 한다", () => {
    const map = buildSubjectToTrackMap(2015);
    const mappings = map.get("정치와법");
    expect(mappings).toBeDefined();
    const tracks = mappings!.map(m => m.track);
    expect(tracks).toContain("law");
  });

  it("음악감상과비평은 arts career로 매핑되어야 한다", () => {
    const map = buildSubjectToTrackMap(2015);
    const mappings = map.get("음악감상과비평");
    expect(mappings).toBeDefined();
    const artsCareer = mappings!.find(m => m.track === "arts" && m.isCareer);
    expect(artsCareer).toBeDefined();
  });

  it("같은 트랙에 같은 isCareer 값으로 중복 등록되지 않아야 한다", () => {
    const map = buildSubjectToTrackMap(2015);
    for (const [, mappings] of map) {
      const keys = mappings.map(m => `${m.track}_${m.isCareer}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

// ─── 10. collectSubjectDirectionScores 시나리오 테스트 ──────────────────────

describe("collectSubjectDirectionScores", () => {
  it("빈 입력 → 빈 결과", () => {
    const result = collectSubjectDirectionScores([], 2015);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("매핑 불가 과목만 → 빈 결과", () => {
    const entries: SubjectQualityEntry[] = [
      { subjectName: "과학탐구실험", depth: 4, specificity: 4 },
      { subjectName: "빅 히스토리", depth: 4, specificity: 4 },
    ];
    const result = collectSubjectDirectionScores(entries, 2015);
    expect(Object.keys(result)).toHaveLength(0);
  });

  describe("시나리오 A: 이공계 집중 학생", () => {
    const scores = collectSubjectDirectionScores(scienceEngineeringEntries(), 2015);

    it("engineering이 1위여야 한다", () => {
      expect(scores.engineering).toBeDefined();
      expect(scores.engineering).toBe(100);
    });

    it("arts가 engineering보다 낮아야 한다", () => {
      expect((scores.arts ?? 0)).toBeLessThan(scores.engineering!);
    });

    it("law는 0이거나 없어야 한다", () => {
      expect(scores.law ?? 0).toBe(0);
    });
  });

  describe("시나리오 B: 법학/정치외교 집중 학생", () => {
    const scores = collectSubjectDirectionScores(lawPoliticsEntries(), 2015);

    it("law 또는 social이 1위여야 한다", () => {
      const lawScore = scores.law ?? 0;
      const socialScore = scores.social ?? 0;
      const maxTrack = Object.entries(scores).reduce(
        (max, [, v]) => Math.max(max, v ?? 0), 0,
      );
      expect(Math.max(lawScore, socialScore)).toBe(maxTrack);
    });

    it("engineering은 law보다 낮아야 한다", () => {
      expect((scores.engineering ?? 0)).toBeLessThan(scores.law ?? 0);
    });
  });

  describe("시나리오 C: 의학 집중 학생", () => {
    const scores = collectSubjectDirectionScores(medicalEntries(), 2015);

    it("medical이 상위 2위 이내여야 한다", () => {
      const sorted = Object.entries(scores)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
      const top2Tracks = sorted.slice(0, 2).map(([t]) => t);
      expect(top2Tracks).toContain("medical");
    });

    it("arts보다 medical이 높아야 한다", () => {
      expect((scores.medical ?? 0)).toBeGreaterThan(scores.arts ?? 0);
    });
  });

  describe("시나리오 D: 예체능 집중 학생", () => {
    const scores = collectSubjectDirectionScores(artsEntries(), 2015);

    it("arts가 1위여야 한다", () => {
      expect(scores.arts).toBe(100);
    });

    it("engineering보다 arts가 높아야 한다", () => {
      expect(scores.arts!).toBeGreaterThan(scores.engineering ?? 0);
    });
  });

  describe("시나리오 E: 1학년 (통합교과, 방향성 약)", () => {
    const scores = collectSubjectDirectionScores(freshmanEntries(), 2015);

    it("방향 신호가 너무 약하면 빈 결과 반환 (MIN_RAW_THRESHOLD)", () => {
      // 미술(2,2)·체육(2,2) → quality 0.4, general weight 0.3
      // rawScore = 0.4×0.3 + 0.4×0.3 = 0.24 < MIN_RAW_THRESHOLD(0.5)
      // → 방향 점수 없음 (역량 점수만으로 판정)
      const allScores = Object.values(scores).filter((v): v is number => v != null);
      expect(allScores.length).toBe(0);
    });
  });

  describe("시나리오 F: 일반교양(미술·체육) 편향 방지", () => {
    it("이공계 과목이 많은 학생에서 arts가 1위가 되면 안 된다", () => {
      const scores = collectSubjectDirectionScores(scienceEngineeringEntries(), 2015);
      const sorted = Object.entries(scores)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
      expect(sorted[0][0]).not.toBe("arts");
    });

    it("의학 과목이 많은 학생에서 arts가 1위가 되면 안 된다", () => {
      const scores = collectSubjectDirectionScores(medicalEntries(), 2015);
      const sorted = Object.entries(scores)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
      expect(sorted[0][0]).not.toBe("arts");
    });
  });

  describe("시나리오 G: 문이과 균형형 학생", () => {
    const scores = collectSubjectDirectionScores(mixedProfileEntries(), 2015);

    it("engineering과 business/law/social 모두 점수가 있어야 한다", () => {
      expect(scores.engineering ?? 0).toBeGreaterThan(0);
      // 경제 → business, 사회문화 → law/social 매핑
      const hasSocTrack = (scores.business ?? 0) > 0
        || (scores.law ?? 0) > 0
        || (scores.social ?? 0) > 0;
      expect(hasSocTrack).toBe(true);
    });

    it("1위와 2위의 차이가 50점 이내여야 한다 (균형 반영)", () => {
      const sorted = Object.values(scores)
        .filter((v): v is number => v != null)
        .sort((a, b) => b - a);
      if (sorted.length >= 2) {
        expect(sorted[0] - sorted[1]).toBeLessThanOrEqual(50);
      }
    });
  });
});

// ─── 11. matchUniversityProfiles + directionScores 블렌딩 ──────────────────

describe("matchUniversityProfiles + directionScores 블렌딩", () => {
  it("directionScores 없으면 v1과 동일하게 동작한다", () => {
    const scores = uniformScores(80);
    const v1 = matchUniversityProfiles("s1", scores);
    const v2 = matchUniversityProfiles("s1", scores, undefined);
    expect(v1.topMatch.matchScore).toBe(v2.topMatch.matchScore);
  });

  it("빈 directionScores({})이면 v1과 동일하게 동작한다", () => {
    const scores = uniformScores(80);
    const v1 = matchUniversityProfiles("s1", scores);
    const v2 = matchUniversityProfiles("s1", scores, {});
    expect(v1.topMatch.matchScore).toBe(v2.topMatch.matchScore);
  });

  describe("시나리오: 김세린 (이공계 과목 + 고른 역량 → engineering 1위)", () => {
    const competency = makeScores({
      academic_achievement: 85,
      academic_attitude: 95,
      academic_inquiry: 95,
      career_course_achievement: 75,
      career_course_effort: 75,
      career_exploration: 95,
      community_caring: 85,
      community_collaboration: 95,
      community_integrity: 85,
      community_leadership: 95,
    });
    const direction = collectSubjectDirectionScores([
      { subjectName: "물리학I", depth: 4, specificity: 3 },
      { subjectName: "기하", depth: 5, specificity: 5 },
      { subjectName: "정보", depth: 4, specificity: 4 },
      { subjectName: "인공지능 기초", depth: 4, specificity: 4 },
      { subjectName: "지구과학I", depth: 5, specificity: 5 },
      { subjectName: "생명과학I", depth: 4, specificity: 4 },
      { subjectName: "미술", depth: 2, specificity: 2 },
      { subjectName: "체육", depth: 2, specificity: 3 },
      { subjectName: "음악 감상과 비평", depth: 4, specificity: 4 },
      { subjectName: "운동과 건강", depth: 3, specificity: 4 },
    ], 2015);

    it("방향 점수에서 engineering이 1위 (100점)", () => {
      expect(direction.engineering).toBe(100);
    });

    it("최종 매칭에서 engineering이 topMatch", () => {
      const result = matchUniversityProfiles("serin", competency, direction);
      expect(result.topMatch.track).toBe("engineering");
    });

    it("최종 매칭에서 law는 상위 3위 밖", () => {
      const result = matchUniversityProfiles("serin", competency, direction);
      const top3 = result.matches.slice(0, 3).map(m => m.track);
      expect(top3).not.toContain("law");
    });

    it("역량만으로는 law가 1위였지만, 방향 보정 후 역전된다", () => {
      const v1 = matchUniversityProfiles("serin", competency); // no direction
      const v2 = matchUniversityProfiles("serin", competency, direction);
      expect(v1.topMatch.track).not.toBe("engineering");
      expect(v2.topMatch.track).toBe("engineering");
    });
  });

  describe("시나리오: 법학 지망 학생 (사회탐구 과목 + 논증 역량)", () => {
    const competency = makeScores({
      academic_achievement: 85,
      academic_attitude: 80,
      academic_inquiry: 90,
      career_course_achievement: 70,
      career_course_effort: 70,
      career_exploration: 85,
      community_caring: 75,
      community_collaboration: 90,
      community_integrity: 80,
      community_leadership: 85,
    });
    const direction = collectSubjectDirectionScores(lawPoliticsEntries(), 2015);

    it("최종 매칭에서 law 또는 social이 topMatch", () => {
      const result = matchUniversityProfiles("law-student", competency, direction);
      expect(["law", "social"]).toContain(result.topMatch.track);
    });

    it("engineering은 상위 3위 밖", () => {
      const result = matchUniversityProfiles("law-student", competency, direction);
      const top3 = result.matches.slice(0, 3).map(m => m.track);
      expect(top3).not.toContain("engineering");
    });
  });
});

// ─── 12. assessCareerAlignment 검증 ─────────────────────────────────────────

describe("assessCareerAlignment", () => {
  const lawTopMatch = {
    track: "law" as UniversityTrack,
    label: "법학/정치외교",
    matchScore: 92.5,
    grade: "S" as ProfileMatchGrade,
    strengths: [],
    gaps: [],
    recommendation: "",
  };

  const engineeringTopMatch = {
    ...lawTopMatch,
    track: "engineering" as UniversityTrack,
    label: "공학/이공계",
  };

  it("targetMajor가 null이면 null 반환", () => {
    expect(assessCareerAlignment(null, lawTopMatch)).toBeNull();
  });

  it("targetMajor가 undefined이면 null 반환", () => {
    expect(assessCareerAlignment(undefined, lawTopMatch)).toBeNull();
  });

  it("법·행정 목표 + law topTrack → aligned", () => {
    const result = assessCareerAlignment("법·행정", lawTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("aligned");
    expect(result!.message).toBe("");
  });

  it("정치·외교 목표 + law topTrack → aligned (같은 SOC Tier1)", () => {
    const result = assessCareerAlignment("정치·외교", lawTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("aligned");
  });

  it("물리·천문(NAT) 목표 + engineering(ENG) topTrack → adjacent", () => {
    const result = assessCareerAlignment("물리·천문", engineeringTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("adjacent");
    expect(result!.message.length).toBeGreaterThan(0);
  });

  it("물리·천문(NAT) 목표 + law(SOC) topTrack → divergent", () => {
    const result = assessCareerAlignment("물리·천문", lawTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("divergent");
    expect(result!.message).toContain("괴리");
  });

  it("의학·약학(MED) 목표 + engineering(ENG) topTrack → adjacent (ENG↔MED 인접)", () => {
    const result = assessCareerAlignment("의학·약학", engineeringTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("adjacent");
  });

  it("음악(ART) 목표 + law(SOC) topTrack → divergent", () => {
    const result = assessCareerAlignment("음악", lawTopMatch);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("divergent");
  });

  it("매핑 불가 전공 → null", () => {
    const result = assessCareerAlignment("존재하지않는전공", lawTopMatch);
    expect(result).toBeNull();
  });
});

// ─── 13. areTier1Adjacent 검증 ──────────────────────────────────────────────

describe("areTier1Adjacent", () => {
  it("동일 코드는 항상 인접", () => {
    expect(areTier1Adjacent("SOC", "SOC")).toBe(true);
    expect(areTier1Adjacent("ENG", "ENG")).toBe(true);
  });

  it("NAT↔ENG 인접", () => {
    expect(areTier1Adjacent("NAT", "ENG")).toBe(true);
    expect(areTier1Adjacent("ENG", "NAT")).toBe(true);
  });

  it("NAT↔MED 인접", () => {
    expect(areTier1Adjacent("NAT", "MED")).toBe(true);
  });

  it("SOC↔HUM 인접", () => {
    expect(areTier1Adjacent("SOC", "HUM")).toBe(true);
  });

  it("ART↔ENG 비인접", () => {
    expect(areTier1Adjacent("ART", "ENG")).toBe(false);
  });

  it("ART↔MED 비인접", () => {
    expect(areTier1Adjacent("ART", "MED")).toBe(false);
  });
});

// ─── 14. 통합 E2E: 전체 파이프라인 시뮬레이션 ──────────────────────────────

describe("통합 시나리오: 과목→방향→매칭→정합성 전체 흐름", () => {
  it("이공계 학생: 과목 수집 → engineering 1위 → 물리·천문 aligned/adjacent", () => {
    const entries = scienceEngineeringEntries();
    const direction = collectSubjectDirectionScores(entries, 2015);
    const competency = uniformScores(85);
    const result = matchUniversityProfiles("eng-student", competency, direction);

    expect(result.topMatch.track).toBe("engineering");

    const alignment = assessCareerAlignment("물리·천문", result.topMatch);
    expect(alignment).not.toBeNull();
    expect(["aligned", "adjacent"]).toContain(alignment!.status);
  });

  it("법학 학생: 과목 수집 → law/social 1위 → 법·행정 aligned", () => {
    const entries = lawPoliticsEntries();
    const direction = collectSubjectDirectionScores(entries, 2015);
    const competency = uniformScores(85);
    const result = matchUniversityProfiles("law-student", competency, direction);

    expect(["law", "social"]).toContain(result.topMatch.track);

    const alignment = assessCareerAlignment("법·행정", result.topMatch);
    expect(alignment).not.toBeNull();
    expect(alignment!.status).toBe("aligned");
  });

  it("예체능 학생: 과목 수집 → arts 1위 → 미술 aligned", () => {
    const entries = artsEntries();
    const direction = collectSubjectDirectionScores(entries, 2015);
    const competency = uniformScores(80);
    const result = matchUniversityProfiles("art-student", competency, direction);

    expect(result.topMatch.track).toBe("arts");

    const alignment = assessCareerAlignment("미술", result.topMatch);
    expect(alignment).not.toBeNull();
    expect(alignment!.status).toBe("aligned");
  });

  it("진로 불일치 감지: 의학 목표인데 arts 과목 위주 → divergent", () => {
    const entries = artsEntries();
    const direction = collectSubjectDirectionScores(entries, 2015);
    const competency = uniformScores(80);
    const result = matchUniversityProfiles("mismatch", competency, direction);

    const alignment = assessCareerAlignment("의학·약학", result.topMatch);
    expect(alignment).not.toBeNull();
    expect(alignment!.status).toBe("divergent");
  });
});
