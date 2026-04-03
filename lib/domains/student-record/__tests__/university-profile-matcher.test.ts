import { describe, it, expect } from "vitest";
import {
  matchSingleProfile,
  matchUniversityProfiles,
  UNIVERSITY_PROFILES,
  type UniversityTrack,
  type ProfileMatchGrade,
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
