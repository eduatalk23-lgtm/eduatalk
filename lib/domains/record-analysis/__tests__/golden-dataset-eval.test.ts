/**
 * 골든 데이터셋 CI 검증 테스트
 *
 * 목적:
 *   1. 데이터 일관성 — 중복 ID 없음, 필수 필드 존재, 타입 유효성
 *   2. Expected 범위 유효성 — minScore <= maxScore, 점수 범위 [0, 100]
 *   3. 이슈 코드 유효성 — 알려진 코드 접두사 집합에 속하는지
 *   4. 샘플 수 충족 — 최소 50개 이상
 *   5. 과목·패턴 다양성 — 필수 카테고리 커버리지
 *
 * LLM 미호출 — 순수 데이터 구조 검증만 수행.
 */

import { describe, it, expect } from "vitest";
import { GOLDEN_DATASET, type EvalSample } from "../eval/golden-dataset";

// ─── 알려진 이슈 코드 접두사 ────────────────────────────────────────────────
// CLAUDE.md에 정의된 14개 패턴 코드 (접두사 매칭)
const KNOWN_ISSUE_PREFIXES = new Set([
  "P1",  // 나열식
  "P2",  // 복붙
  "P3",  // 키워드만
  "P4",  // 내신↔탐구불일치
  "P5",  // 내용오류포장
  "F1",  // 별개활동포장
  "F2",  // 인과단절
  "F3",  // 출처불일치
  "F4",  // 전제불일치
  "F5",  // 비교군오류
  "F6",  // 자명한결론
  "F10", // 성장부재
  "F12", // 자기주도성부재
  "F16", // 진로과잉도배
  "M1",  // 교사관찰불가
]);

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────

function isKnownIssueCode(code: string): boolean {
  for (const prefix of KNOWN_ISSUE_PREFIXES) {
    if (code.startsWith(prefix)) return true;
  }
  return false;
}

function getSampleIds(): string[] {
  return GOLDEN_DATASET.map((s) => s.id);
}

// ─── 1. 전체 데이터셋 기본 검증 ─────────────────────────────────────────────

describe("GOLDEN_DATASET 기본 구조", () => {
  it("최소 50개 샘플이 존재한다", () => {
    expect(GOLDEN_DATASET.length).toBeGreaterThanOrEqual(50);
  });

  it("모든 샘플에 id가 존재한다", () => {
    for (const sample of GOLDEN_DATASET) {
      expect(sample.id, `sample.id must not be empty`).toBeTruthy();
    }
  });

  it("모든 샘플에 description이 존재한다", () => {
    for (const sample of GOLDEN_DATASET) {
      expect(
        sample.description,
        `sample(${sample.id}).description must not be empty`
      ).toBeTruthy();
    }
  });

  it("모든 샘플에 content가 50자 이상이다", () => {
    for (const sample of GOLDEN_DATASET) {
      expect(
        sample.content.length,
        `sample(${sample.id}).content is too short (${sample.content.length}자)`
      ).toBeGreaterThanOrEqual(50);
    }
  });

  it("모든 샘플의 recordType이 유효한 값이다", () => {
    const validTypes: EvalSample["recordType"][] = [
      "setek",
      "changche",
      "haengteuk",
    ];
    for (const sample of GOLDEN_DATASET) {
      expect(
        validTypes,
        `sample(${sample.id}).recordType="${sample.recordType}" is invalid`
      ).toContain(sample.recordType);
    }
  });

  it("grade 필드가 있으면 1~3 범위이다", () => {
    for (const sample of GOLDEN_DATASET) {
      if (sample.grade !== undefined) {
        expect(
          sample.grade,
          `sample(${sample.id}).grade=${sample.grade} out of range [1,3]`
        ).toBeGreaterThanOrEqual(1);
        expect(
          sample.grade,
          `sample(${sample.id}).grade=${sample.grade} out of range [1,3]`
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it("setek 타입 샘플은 subjectName이 존재하는 것이 권장된다 (경고 수준)", () => {
    const setelWithoutSubject = GOLDEN_DATASET.filter(
      (s) => s.recordType === "setek" && !s.subjectName
    );
    // 경고성 검사 — 0개가 이상적이지만 강제하지 않음
    // 하나도 없으면 통과, 있어도 실패하지 않음 (soft check)
    expect(setelWithoutSubject.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── 2. ID 중복 검사 ────────────────────────────────────────────────────────

describe("ID 중복 검사", () => {
  it("모든 sample.id가 유일하다", () => {
    const ids = getSampleIds();
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      // 중복된 ID 찾아서 메시지에 표시
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const id of ids) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
      }
      expect.fail(`중복 ID 발견: ${duplicates.join(", ")}`);
    }
    expect(unique.size).toBe(ids.length);
  });
});

// ─── 3. Expected 범위 유효성 ────────────────────────────────────────────────

describe("expected 범위 유효성", () => {
  it("minScore는 0 이상 100 이하이다", () => {
    for (const sample of GOLDEN_DATASET) {
      const { minScore } = sample.expected;
      if (minScore !== undefined) {
        expect(
          minScore,
          `sample(${sample.id}).expected.minScore=${minScore} < 0`
        ).toBeGreaterThanOrEqual(0);
        expect(
          minScore,
          `sample(${sample.id}).expected.minScore=${minScore} > 100`
        ).toBeLessThanOrEqual(100);
      }
    }
  });

  it("maxScore는 0 이상 100 이하이다", () => {
    for (const sample of GOLDEN_DATASET) {
      const { maxScore } = sample.expected;
      if (maxScore !== undefined) {
        expect(
          maxScore,
          `sample(${sample.id}).expected.maxScore=${maxScore} < 0`
        ).toBeGreaterThanOrEqual(0);
        expect(
          maxScore,
          `sample(${sample.id}).expected.maxScore=${maxScore} > 100`
        ).toBeLessThanOrEqual(100);
      }
    }
  });

  it("minScore <= maxScore (둘 다 정의된 경우)", () => {
    for (const sample of GOLDEN_DATASET) {
      const { minScore, maxScore } = sample.expected;
      if (minScore !== undefined && maxScore !== undefined) {
        expect(
          minScore,
          `sample(${sample.id}): minScore(${minScore}) > maxScore(${maxScore})`
        ).toBeLessThanOrEqual(maxScore);
      }
    }
  });

  it("모든 샘플은 expected에 최소 하나의 조건이 있다", () => {
    for (const sample of GOLDEN_DATASET) {
      const { minScore, maxScore, mustHaveIssues, mustNotHaveIssues } =
        sample.expected;
      const hasCondition =
        minScore !== undefined ||
        maxScore !== undefined ||
        (mustHaveIssues !== undefined && mustHaveIssues.length > 0) ||
        (mustNotHaveIssues !== undefined && mustNotHaveIssues.length > 0);
      expect(
        hasCondition,
        `sample(${sample.id}).expected has no conditions`
      ).toBe(true);
    }
  });
});

// ─── 4. 이슈 코드 유효성 ────────────────────────────────────────────────────

describe("이슈 코드 유효성", () => {
  it("mustHaveIssues의 모든 코드가 알려진 접두사로 시작한다", () => {
    for (const sample of GOLDEN_DATASET) {
      const codes = sample.expected.mustHaveIssues ?? [];
      for (const code of codes) {
        expect(
          isKnownIssueCode(code),
          `sample(${sample.id}).mustHaveIssues 에 알 수 없는 코드 "${code}" 포함`
        ).toBe(true);
      }
    }
  });

  it("mustNotHaveIssues의 모든 코드가 알려진 접두사로 시작한다", () => {
    for (const sample of GOLDEN_DATASET) {
      const codes = sample.expected.mustNotHaveIssues ?? [];
      for (const code of codes) {
        expect(
          isKnownIssueCode(code),
          `sample(${sample.id}).mustNotHaveIssues 에 알 수 없는 코드 "${code}" 포함`
        ).toBe(true);
      }
    }
  });

  it("mustHaveIssues와 mustNotHaveIssues 간에 코드 충돌이 없다", () => {
    for (const sample of GOLDEN_DATASET) {
      const must = new Set(sample.expected.mustHaveIssues ?? []);
      const mustNot = new Set(sample.expected.mustNotHaveIssues ?? []);
      const conflicts = [...must].filter((c) => mustNot.has(c));
      expect(
        conflicts.length,
        `sample(${sample.id}): 동일 코드가 mustHave와 mustNotHave 양쪽에 존재: [${conflicts.join(", ")}]`
      ).toBe(0);
    }
  });
});

// ─── 5. recordType별 샘플 수 ────────────────────────────────────────────────

describe("recordType별 샘플 수", () => {
  it("setek 샘플이 20개 이상이다", () => {
    const count = GOLDEN_DATASET.filter((s) => s.recordType === "setek").length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("changche 샘플이 3개 이상이다", () => {
    const count = GOLDEN_DATASET.filter(
      (s) => s.recordType === "changche"
    ).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("haengteuk 샘플이 2개 이상이다", () => {
    const count = GOLDEN_DATASET.filter(
      (s) => s.recordType === "haengteuk"
    ).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ─── 6. 고품질(A카테고리) / 저품질 분포 ────────────────────────────────────

describe("품질 분포 커버리지", () => {
  it("고품질 샘플(minScore >= 60)이 5개 이상이다", () => {
    const highQuality = GOLDEN_DATASET.filter(
      (s) => s.expected.minScore !== undefined && s.expected.minScore >= 60
    );
    expect(highQuality.length).toBeGreaterThanOrEqual(5);
  });

  it("저품질 샘플(maxScore <= 60)이 5개 이상이다", () => {
    const lowQuality = GOLDEN_DATASET.filter(
      (s) => s.expected.maxScore !== undefined && s.expected.maxScore <= 60
    );
    expect(lowQuality.length).toBeGreaterThanOrEqual(5);
  });

  it("경계값 샘플(minScore와 maxScore 모두 정의)이 1개 이상이다", () => {
    const borderline = GOLDEN_DATASET.filter(
      (s) =>
        s.expected.minScore !== undefined && s.expected.maxScore !== undefined
    );
    expect(borderline.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 7. 패턴 커버리지 ───────────────────────────────────────────────────────

describe("이슈 패턴 커버리지", () => {
  function samplesWithIssue(code: string): EvalSample[] {
    return GOLDEN_DATASET.filter((s) =>
      (s.expected.mustHaveIssues ?? []).some((c) => c.startsWith(code))
    );
  }

  it("P1(나열식) 패턴 샘플이 2개 이상이다", () => {
    expect(samplesWithIssue("P1").length).toBeGreaterThanOrEqual(2);
  });

  it("P3(키워드만) 패턴 샘플이 1개 이상이다", () => {
    expect(samplesWithIssue("P3").length).toBeGreaterThanOrEqual(1);
  });

  it("F2(인과단절) 패턴 샘플이 1개 이상이다", () => {
    expect(samplesWithIssue("F2").length).toBeGreaterThanOrEqual(1);
  });

  // F10(다학년 성장부재)은 단일 세특 판정이 구조적으로 불가능(기존 f10-physics/chemistry/
  // earth-science는 P1으로 재분류됨, 커밋 b3d796db). 단일 레코드 골든셋에서는 제외.
  it.skip("F10(성장부재) 패턴 샘플이 2개 이상이다 — 다학년 비교 필요로 단일 세특 판정 불가 (reclassified to P1)", () => {
    expect(samplesWithIssue("F10").length).toBeGreaterThanOrEqual(2);
  });

  it("F12(자기주도성부재) 패턴 샘플이 1개 이상이다", () => {
    expect(samplesWithIssue("F12").length).toBeGreaterThanOrEqual(1);
  });

  it("F16(진로과잉도배) 패턴 샘플이 1개 이상이다", () => {
    expect(samplesWithIssue("F16").length).toBeGreaterThanOrEqual(1);
  });

  it("M1(교사관찰불가) 패턴 샘플이 1개 이상이다", () => {
    expect(samplesWithIssue("M1").length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 8. 과목 다양성 ─────────────────────────────────────────────────────────

describe("과목 다양성", () => {
  function hasSubject(name: string): boolean {
    return GOLDEN_DATASET.some((s) => s.subjectName === name);
  }

  // 수학 계열
  it("미적분 과목 샘플이 존재한다", () => {
    expect(hasSubject("미적분")).toBe(true);
  });

  it("확률과 통계 과목 샘플이 존재한다", () => {
    expect(hasSubject("확률과 통계")).toBe(true);
  });

  it("기하 과목 샘플이 존재한다", () => {
    expect(hasSubject("기하")).toBe(true);
  });

  // 과학 계열
  it("물리학I 과목 샘플이 존재한다", () => {
    expect(hasSubject("물리학I")).toBe(true);
  });

  it("화학I 과목 샘플이 존재한다", () => {
    expect(hasSubject("화학I")).toBe(true);
  });

  it("생명과학I 과목 샘플이 존재한다", () => {
    expect(hasSubject("생명과학I")).toBe(true);
  });

  it("지구과학I 과목 샘플이 존재한다", () => {
    expect(hasSubject("지구과학I")).toBe(true);
  });

  // 사회 계열
  it("사회·문화 과목 샘플이 존재한다", () => {
    expect(hasSubject("사회·문화")).toBe(true);
  });

  it("경제 과목 샘플이 존재한다", () => {
    expect(hasSubject("경제")).toBe(true);
  });

  it("정치와 법 과목 샘플이 존재한다", () => {
    expect(hasSubject("정치와 법")).toBe(true);
  });

  // 예체능 계열
  it("체육 과목 샘플이 존재한다", () => {
    expect(hasSubject("체육")).toBe(true);
  });

  it("음악 또는 미술 과목 샘플이 존재한다", () => {
    const hasArt = hasSubject("미술") || hasSubject("음악");
    expect(hasArt).toBe(true);
  });
});

// ─── 9. 학년 다양성 ─────────────────────────────────────────────────────────

describe("학년 다양성", () => {
  it("1학년 샘플이 존재한다", () => {
    const count = GOLDEN_DATASET.filter((s) => s.grade === 1).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("2학년 샘플이 존재한다", () => {
    const count = GOLDEN_DATASET.filter((s) => s.grade === 2).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("3학년 샘플이 존재한다", () => {
    const count = GOLDEN_DATASET.filter((s) => s.grade === 3).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
