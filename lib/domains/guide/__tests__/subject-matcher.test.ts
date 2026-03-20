import { describe, it, expect } from "vitest";
import {
  SubjectMatcher,
  CareerFieldMatcher,
  type SubjectRecord,
  type CareerFieldRecord,
} from "../import/subject-matcher";

const MOCK_SUBJECTS: SubjectRecord[] = [
  { id: "s1", name: "생명과학Ⅰ" },
  { id: "s2", name: "생명과학Ⅱ" },
  { id: "s3", name: "화학Ⅰ" },
  { id: "s4", name: "화학Ⅱ" },
  { id: "s5", name: "물리학Ⅰ" },
  { id: "s6", name: "물리학Ⅱ" },
  { id: "s7", name: "사회·문화" },
  { id: "s8", name: "정치와법" },
  { id: "s9", name: "윤리와사상" },
  { id: "s10", name: "미적분" },
  { id: "s11", name: "확률과통계" },
  { id: "s12", name: "생활과윤리" },
];

const MOCK_CAREER_FIELDS: CareerFieldRecord[] = [
  { id: 1, code: "engineering", name_kor: "공학계열" },
  { id: 2, code: "education", name_kor: "교육계열" },
  { id: 3, code: "social_sciences", name_kor: "사회계열" },
  { id: 4, code: "arts_pe", name_kor: "예체능계열" },
  { id: 5, code: "medicine", name_kor: "의약계열" },
  { id: 6, code: "humanities", name_kor: "인문계열" },
  { id: 7, code: "natural_sciences", name_kor: "자연계열" },
  { id: 8, code: "medical", name_kor: "의학계열" },
  { id: 9, code: "unclassified", name_kor: "미분류" },
  { id: 10, code: "all_fields", name_kor: "전계열" },
];

describe("SubjectMatcher", () => {
  const matcher = new SubjectMatcher(MOCK_SUBJECTS);

  it("정확 매칭 — 동일 과목명", () => {
    const result = matcher.match("생명과학Ⅰ");
    expect(result.matched).toBe(true);
    expect(result.subjectId).toBe("s1");
    expect(result.similarity).toBe(1);
  });

  it("정규화 매칭 — 공백 차이", () => {
    const result = matcher.match("생명 과학 Ⅰ");
    expect(result.matched).toBe(true);
    expect(result.subjectId).toBe("s1");
  });

  it("수동 매핑 — 사회문화 → 사회·문화", () => {
    const result = matcher.match("사회문화");
    expect(result.matched).toBe(true);
    expect(result.subjectId).toBe("s7");
  });

  it("유사도 매칭 — 유사한 이름", () => {
    // "생명과학" → 생명과학Ⅰ (짧은 이름)
    const result = matcher.match("생명과학");
    expect(result.matched).toBe(true);
    expect(result.similarity).toBeGreaterThanOrEqual(0.7);
  });

  it("매칭 실패 — 존재하지 않는 과목", () => {
    const result = matcher.match("고대그리스어");
    expect(result.matched).toBe(false);
    expect(result.subjectId).toBeNull();
  });

  it("빈 문자열 → 매칭 실패", () => {
    const result = matcher.match("");
    expect(result.matched).toBe(false);
  });
});

describe("CareerFieldMatcher", () => {
  const matcher = new CareerFieldMatcher(MOCK_CAREER_FIELDS);

  it("단일 계열 매칭 — Access DB 원본 값", () => {
    expect(matcher.match("인문계열")).toEqual([6]);
    expect(matcher.match("사회계열")).toEqual([3]);
    expect(matcher.match("공학계열")).toEqual([1]);
  });

  it("쉼표 구분 다중 계열 — Access 실제 형식", () => {
    const ids = matcher.match("교육계열, 인문계열, 의학계열");
    expect(ids).toContain(2); // education
    expect(ids).toContain(6); // humanities
    expect(ids).toContain(8); // medical
  });

  it("슬래시 구분 다중 계열", () => {
    const ids = matcher.match("인문계열/사회계열");
    expect(ids).toContain(6);
    expect(ids).toContain(3);
  });

  it("축약형 코드로 매칭", () => {
    expect(matcher.match("의약")).toEqual([5]);
    expect(matcher.match("인문")).toEqual([6]);
  });

  it("부분 매칭 — 자연 → 자연계열", () => {
    expect(matcher.match("자연")).toEqual([7]);
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(matcher.match("")).toEqual([]);
  });

  it("중복 제거", () => {
    const ids = matcher.match("의약계열, 의약");
    expect(ids).toEqual([5]);
  });
});
