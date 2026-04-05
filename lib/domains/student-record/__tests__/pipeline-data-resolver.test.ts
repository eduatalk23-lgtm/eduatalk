import { describe, it, expect } from "vitest";
import {
  resolveRecordData,
  deriveGradeCategories,
  resolveRecordDataForGrade,
} from "../pipeline-data-resolver";
import type {
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "../pipeline-types";

// ============================================
// 헬퍼 팩토리
// ============================================

function makeSetek(
  overrides: Partial<CachedSetek> & { grade: number },
): CachedSetek {
  return {
    id: overrides.id ?? `setek-${overrides.grade}-1`,
    content: overrides.content ?? "",
    imported_content: overrides.imported_content ?? null,
    grade: overrides.grade,
    subject: overrides.subject ?? null,
  };
}

function makeChangche(
  overrides: Partial<CachedChangche> & { grade: number },
): CachedChangche {
  return {
    id: overrides.id ?? `changche-${overrides.grade}-1`,
    content: overrides.content ?? "",
    imported_content: overrides.imported_content ?? null,
    grade: overrides.grade,
    activity_type: overrides.activity_type ?? null,
  };
}

function makeHaengteuk(
  overrides: Partial<CachedHaengteuk> & { grade: number },
): CachedHaengteuk {
  return {
    id: overrides.id ?? `haengteuk-${overrides.grade}-1`,
    content: overrides.content ?? "",
    imported_content: overrides.imported_content ?? null,
    grade: overrides.grade,
  };
}

/** 21자 이상의 NEIS 콘텐츠 (threshold > 20) */
const NEIS_CONTENT = "NEIS로 입력된 세특 내용입니다. 충분히 길어야 합니다.";
/** 20자 이하 — NEIS 임계치 미충족 */
const SHORT_NEIS = "짧은내용임.";

// ============================================
// resolveRecordData
// ============================================

describe("resolveRecordData", () => {
  // ---- 빈 입력 ----

  it("빈 입력이면 빈 객체를 반환한다", () => {
    const result = resolveRecordData([], [], []);
    expect(result).toEqual({});
  });

  // ---- NEIS 판별 임계치 ----

  it("imported_content가 21자 이상이면 hasNeis = true", () => {
    const setek = makeSetek({ grade: 1, imported_content: NEIS_CONTENT });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(true);
  });

  it("imported_content가 null이면 hasNeis = false", () => {
    const setek = makeSetek({ grade: 1, imported_content: null });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(false);
  });

  it("imported_content가 20자 이하(공백 제거 후)이면 hasNeis = false", () => {
    const setek = makeSetek({ grade: 1, imported_content: SHORT_NEIS });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(false);
  });

  it("imported_content가 공백만으로 이루어진 경우 hasNeis = false", () => {
    const setek = makeSetek({ grade: 1, imported_content: "   " });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(false);
  });

  // ---- effectiveContent 선택 ----

  it("NEIS 있는 세특 → effectiveContent = imported_content", () => {
    const setek = makeSetek({
      grade: 1,
      content: "가안 내용",
      imported_content: NEIS_CONTENT,
    });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].effectiveContent).toBe(NEIS_CONTENT);
  });

  it("NEIS 없는 세특 → effectiveContent = content(가안)", () => {
    const setek = makeSetek({
      grade: 1,
      content: "가안 내용",
      imported_content: null,
    });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].effectiveContent).toBe("가안 내용");
  });

  it("NEIS 없고 content도 비어 있으면 effectiveContent = ''", () => {
    const setek = makeSetek({ grade: 1, content: "", imported_content: null });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].effectiveContent).toBe("");
  });

  // ---- 세특 필드 매핑 ----

  it("세특 ResolvedRecord에 id, grade, subjectName이 올바르게 매핑된다", () => {
    const setek = makeSetek({
      id: "s-001",
      grade: 2,
      imported_content: NEIS_CONTENT,
      subject: { name: "수학" },
    });
    const result = resolveRecordData([setek], [], []);
    const rec = result[2].seteks[0];
    expect(rec.id).toBe("s-001");
    expect(rec.grade).toBe(2);
    expect(rec.subjectName).toBe("수학");
  });

  it("subject가 null이면 subjectName = undefined", () => {
    const setek = makeSetek({ grade: 1, subject: null });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].subjectName).toBeUndefined();
  });

  // ---- 창체 필드 매핑 ----

  it("창체 ResolvedRecord에 activityType이 올바르게 매핑된다", () => {
    const changche = makeChangche({
      grade: 1,
      imported_content: NEIS_CONTENT,
      activity_type: "동아리",
    });
    const result = resolveRecordData([], [changche], []);
    expect(result[1].changche[0].activityType).toBe("동아리");
  });

  it("changche의 activity_type이 null이면 activityType = undefined", () => {
    const changche = makeChangche({ grade: 1, activity_type: null });
    const result = resolveRecordData([], [changche], []);
    expect(result[1].changche[0].activityType).toBeUndefined();
  });

  it("NEIS 있는 창체 → effectiveContent = imported_content", () => {
    const changche = makeChangche({
      grade: 1,
      content: "창체 가안",
      imported_content: NEIS_CONTENT,
    });
    const result = resolveRecordData([], [changche], []);
    expect(result[1].changche[0].effectiveContent).toBe(NEIS_CONTENT);
  });

  // ---- 행특 필드 매핑 ----

  it("NEIS 있는 행특 → haengteuk 필드에 단일 레코드 저장", () => {
    const h = makeHaengteuk({ grade: 1, imported_content: NEIS_CONTENT });
    const result = resolveRecordData([], [], [h]);
    expect(result[1].haengteuk).not.toBeNull();
    expect(result[1].haengteuk!.hasNeis).toBe(true);
    expect(result[1].haengteuk!.effectiveContent).toBe(NEIS_CONTENT);
  });

  it("행특 여러 건이면 마지막 것이 저장된다 (last-write-wins)", () => {
    const h1 = makeHaengteuk({ id: "h-first", grade: 1, content: "첫 번째" });
    const h2 = makeHaengteuk({ id: "h-last", grade: 1, content: "두 번째" });
    const result = resolveRecordData([], [], [h1, h2]);
    expect(result[1].haengteuk!.id).toBe("h-last");
    expect(result[1].haengteuk!.effectiveContent).toBe("두 번째");
  });

  // ---- hasAnyNeis 집계 ----

  it("세특에 NEIS가 있으면 hasAnyNeis = true", () => {
    const setek = makeSetek({ grade: 1, imported_content: NEIS_CONTENT });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].hasAnyNeis).toBe(true);
  });

  it("창체에만 NEIS가 있어도 hasAnyNeis = true", () => {
    const setek = makeSetek({ grade: 1, imported_content: null });
    const changche = makeChangche({ grade: 1, imported_content: NEIS_CONTENT });
    const result = resolveRecordData([setek], [changche], []);
    expect(result[1].hasAnyNeis).toBe(true);
  });

  it("행특에만 NEIS가 있어도 hasAnyNeis = true", () => {
    const h = makeHaengteuk({ grade: 1, imported_content: NEIS_CONTENT });
    const result = resolveRecordData([], [], [h]);
    expect(result[1].hasAnyNeis).toBe(true);
  });

  it("세특/창체/행특 모두 NEIS 없으면 hasAnyNeis = false", () => {
    const setek = makeSetek({ grade: 1, imported_content: null });
    const changche = makeChangche({ grade: 1, imported_content: null });
    const h = makeHaengteuk({ grade: 1, imported_content: null });
    const result = resolveRecordData([setek], [changche], [h]);
    expect(result[1].hasAnyNeis).toBe(false);
  });

  // ---- 다중 학년 파티셔닝 ----

  it("1/2/3학년 레코드가 각 학년별로 분리된다", () => {
    const s1 = makeSetek({ id: "s1", grade: 1 });
    const s2 = makeSetek({ id: "s2", grade: 2 });
    const s3 = makeSetek({ id: "s3", grade: 3 });
    const result = resolveRecordData([s1, s2, s3], [], []);
    expect(result[1].seteks).toHaveLength(1);
    expect(result[2].seteks).toHaveLength(1);
    expect(result[3].seteks).toHaveLength(1);
    expect(result[1].seteks[0].id).toBe("s1");
    expect(result[2].seteks[0].id).toBe("s2");
    expect(result[3].seteks[0].id).toBe("s3");
  });

  it("1학년에 NEIS 있고 2학년에 NEIS 없으면 hasAnyNeis가 학년별로 독립적이다", () => {
    const s1 = makeSetek({ grade: 1, imported_content: NEIS_CONTENT });
    const s2 = makeSetek({ grade: 2, imported_content: null });
    const result = resolveRecordData([s1, s2], [], []);
    expect(result[1].hasAnyNeis).toBe(true);
    expect(result[2].hasAnyNeis).toBe(false);
  });

  it("학년 내 세특 여러 건이 모두 배열에 추가된다", () => {
    const s1 = makeSetek({ id: "s1", grade: 1, subject: { name: "수학" } });
    const s2 = makeSetek({ id: "s2", grade: 1, subject: { name: "영어" } });
    const result = resolveRecordData([s1, s2], [], []);
    expect(result[1].seteks).toHaveLength(2);
    const ids = result[1].seteks.map(r => r.id);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
  });

  it("행특이 없는 학년은 haengteuk = null", () => {
    const setek = makeSetek({ grade: 1 });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].haengteuk).toBeNull();
  });

  it("학년 레코드가 없으면 해당 학년 키가 생성되지 않는다", () => {
    const setek = makeSetek({ grade: 1 });
    const result = resolveRecordData([setek], [], []);
    expect(result[2]).toBeUndefined();
    expect(result[3]).toBeUndefined();
  });

  // ---- 혼합 케이스 (세특+창체+행특 한 학년) ----

  it("한 학년에 세특+창체+행특 모두 있을 때 올바르게 분류된다", () => {
    const setek = makeSetek({ id: "s1", grade: 2, imported_content: NEIS_CONTENT });
    const changche = makeChangche({ id: "c1", grade: 2, imported_content: null });
    const h = makeHaengteuk({ id: "h1", grade: 2, imported_content: null });
    const result = resolveRecordData([setek], [changche], [h]);
    expect(result[2].seteks[0].id).toBe("s1");
    expect(result[2].changche[0].id).toBe("c1");
    expect(result[2].haengteuk!.id).toBe("h1");
    // 세특에 NEIS 있으므로 hasAnyNeis = true
    expect(result[2].hasAnyNeis).toBe(true);
  });
});

// ============================================
// deriveGradeCategories
// ============================================

describe("deriveGradeCategories", () => {
  it("빈 해소 결과 → neisGrades=[], consultingGrades=[]", () => {
    const result = deriveGradeCategories({});
    expect(result.neisGrades).toEqual([]);
    expect(result.consultingGrades).toEqual([]);
  });

  it("모든 학년에 NEIS가 있으면 neisGrades에 모두 들어간다", () => {
    const resolved = {
      1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      3: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
    };
    const result = deriveGradeCategories(resolved);
    expect(result.neisGrades).toEqual([1, 2, 3]);
    expect(result.consultingGrades).toEqual([]);
  });

  it("모든 학년에 NEIS가 없으면 consultingGrades에 모두 들어간다", () => {
    const resolved = {
      1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
    };
    const result = deriveGradeCategories(resolved);
    expect(result.neisGrades).toEqual([]);
    expect(result.consultingGrades).toEqual([1, 2]);
  });

  it("혼합: 1학년 NEIS 있고 2학년 없으면 각 목록에 분류된다", () => {
    const resolved = {
      1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
    };
    const result = deriveGradeCategories(resolved);
    expect(result.neisGrades).toContain(1);
    expect(result.consultingGrades).toContain(2);
  });

  it("학년 목록이 오름차순 정렬되어 반환된다", () => {
    // Object.keys 순서가 보장되지 않으므로 역순으로 넣어 테스트
    const resolved = {
      3: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
    };
    const result = deriveGradeCategories(resolved);
    expect(result.neisGrades).toEqual([2, 3]);
    expect(result.consultingGrades).toEqual([1]);
  });

  it("neisGrades와 consultingGrades의 합은 전체 학년 수와 같다", () => {
    const resolved = {
      1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      3: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
    };
    const result = deriveGradeCategories(resolved);
    expect(result.neisGrades.length + result.consultingGrades.length).toBe(3);
  });
});

// ============================================
// resolveRecordDataForGrade
// ============================================

describe("resolveRecordDataForGrade", () => {
  it("targetGrade에 해당하는 레코드만 포함된다", () => {
    const s1 = makeSetek({ id: "s1", grade: 1 });
    const s2 = makeSetek({ id: "s2", grade: 2 });
    const s3 = makeSetek({ id: "s3", grade: 3 });
    const result = resolveRecordDataForGrade([s1, s2, s3], [], [], 2);
    expect(result[2]).toBeDefined();
    expect(result[1]).toBeUndefined();
    expect(result[3]).toBeUndefined();
  });

  it("targetGrade 학년에 레코드가 없으면 빈 객체 반환", () => {
    const s1 = makeSetek({ grade: 1 });
    const result = resolveRecordDataForGrade([s1], [], [], 3);
    expect(result[3]).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("같은 해소 로직이 적용된다 — NEIS 판별", () => {
    const setek = makeSetek({ grade: 2, imported_content: NEIS_CONTENT });
    const result = resolveRecordDataForGrade([setek], [], [], 2);
    expect(result[2].seteks[0].hasNeis).toBe(true);
    expect(result[2].seteks[0].effectiveContent).toBe(NEIS_CONTENT);
  });

  it("창체/행특도 targetGrade로 필터링된다", () => {
    const c1 = makeChangche({ id: "c1", grade: 1 });
    const c2 = makeChangche({ id: "c2", grade: 2 });
    const h1 = makeHaengteuk({ id: "h1", grade: 1 });
    const h2 = makeHaengteuk({ id: "h2", grade: 2 });
    const result = resolveRecordDataForGrade([], [c1, c2], [h1, h2], 1);
    expect(result[1].changche).toHaveLength(1);
    expect(result[1].changche[0].id).toBe("c1");
    expect(result[1].haengteuk!.id).toBe("h1");
    expect(result[2]).toBeUndefined();
  });

  it("hasAnyNeis 집계도 대상 학년 내에서만 계산된다", () => {
    // 1학년은 NEIS 없고, 2학년은 NEIS 있음
    const s1 = makeSetek({ grade: 1, imported_content: null });
    const s2 = makeSetek({ grade: 2, imported_content: NEIS_CONTENT });
    // targetGrade=1만 처리하면 hasAnyNeis=false여야 한다
    const result = resolveRecordDataForGrade([s1, s2], [], [], 1);
    expect(result[1].hasAnyNeis).toBe(false);
  });

  it("resolveRecordData와 동일한 결과를 반환한다 (일관성 보장)", () => {
    const s1 = makeSetek({ id: "s1", grade: 2, imported_content: NEIS_CONTENT });
    const c1 = makeChangche({ id: "c1", grade: 2 });
    const h1 = makeHaengteuk({ id: "h1", grade: 2 });
    const s_other = makeSetek({ id: "s_other", grade: 1 });

    const forGrade = resolveRecordDataForGrade([s1, s_other], [c1], [h1], 2);
    // 직접 resolveRecordData를 동일 필터 조건으로 호출한 결과와 비교
    const direct = resolveRecordData([s1], [c1], [h1]);

    expect(forGrade[2].seteks[0].id).toBe(direct[2].seteks[0].id);
    expect(forGrade[2].hasAnyNeis).toBe(direct[2].hasAnyNeis);
  });
});

// ============================================
// 경계 케이스 및 통합
// ============================================

describe("resolveRecordData — 경계 케이스", () => {
  it("imported_content가 정확히 20자인 경우 hasNeis = false (임계치 미만)", () => {
    // 정확히 20자 (trim 후)
    const exactly20 = "가".repeat(20); // 20자
    const setek = makeSetek({ grade: 1, imported_content: exactly20 });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(false);
  });

  it("imported_content가 정확히 21자인 경우 hasNeis = true (임계치 초과)", () => {
    const exactly21 = "가".repeat(21); // 21자
    const setek = makeSetek({ grade: 1, imported_content: exactly21 });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(true);
  });

  it("앞뒤 공백을 제거한 후 길이를 측정한다", () => {
    // 공백 포함하면 21자 이상이지만 trim 후 20자 이하
    const padded = "  " + "가".repeat(18) + "  "; // trim 후 18자
    const setek = makeSetek({ grade: 1, imported_content: padded });
    const result = resolveRecordData([setek], [], []);
    expect(result[1].seteks[0].hasNeis).toBe(false);
  });

  it("세특/창체/행특이 서로 다른 학년일 때 각 학년 객체가 독립적으로 초기화된다", () => {
    const setek = makeSetek({ grade: 1 });
    const changche = makeChangche({ grade: 2 });
    const h = makeHaengteuk({ grade: 3 });
    const result = resolveRecordData([setek], [changche], [h]);
    // 1학년: 세특만 있고 창체/행특 없음
    expect(result[1].seteks).toHaveLength(1);
    expect(result[1].changche).toHaveLength(0);
    expect(result[1].haengteuk).toBeNull();
    // 2학년: 창체만 있고 세특/행특 없음
    expect(result[2].seteks).toHaveLength(0);
    expect(result[2].changche).toHaveLength(1);
    expect(result[2].haengteuk).toBeNull();
    // 3학년: 행특만 있고 세특/창체 없음
    expect(result[3].seteks).toHaveLength(0);
    expect(result[3].changche).toHaveLength(0);
    expect(result[3].haengteuk).not.toBeNull();
  });
});
