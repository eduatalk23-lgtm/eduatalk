import { describe, it, expect } from "vitest";
import { transformAccessRow } from "../import/transformer";
import type { AccessGuideRow } from "../types";

function makeRow(overrides: Partial<AccessGuideRow> = {}): AccessGuideRow {
  return {
    ID: 862,
    구분유형: "독서",
    개정년도: "2015년, 2022년",
    교과선택: "도덕과",
    과목선택: "생활과 윤리, 윤리와 사상",
    대단원선택: "",
    소단원선택: "",
    계열선택: "교육계열, 인문계열, 의학계열",
    학과: "상담심리학과, 심리학과",
    주제: "죽음의 수용소에서 — 인간 유형과 윤리의 당위성",
    탐구동기: "유전자에 대한 호기심으로 읽기 시작했다.",
    탐구이론: "자연선택은 적자생존의 메커니즘이다.",
    탐구고찰: "유전자의 관점이 새로웠다.",
    느낀점: "진화에 대한 이해가 깊어졌다.",
    탐구요약: "유전자 중심의 진화론을 다룬 책이다.",
    저자: "빅터 프랭클",
    출판사: "청아출판사",
    출판연도: "2020",
    도서소개: "나치의 강제 수용소에서 겪은 참담한 고통을 술회한 에세이.",
    관련논문1: "빅터 프랭클의 삶의 의미론(신경희, 2020)",
    논문URL1: "#https://example.com/paper1#",
    관련논문2: "유전자 발현 연구",
    논문URL2: "",
    관련도서1: "《삶의 의미와 위대한 철학자들》",
    관련도서2: "《내 삶의 의미는 무엇인가》",
    관련도서3: "",
    교과세특1: "미래에 대한 희망과 실천으로 삶의 의미를 부여한 과정에 대해 성찰하는 모습이 인상적.",
    교과세특2: "윤리적 삶과 관련된 다양한 인간의 모습과 삶을 사색하고 성찰하기를 즐기는 학생.",
    후속탐구: "확장된 표현형을 읽어볼 것.",
    도서이름: "죽음의 수용소에서",
    등록자: "조현우",
    등록일: "04/16/25 00:00:00",
    논문요약1: "",
    관련도서4: "",
    관련도서5: "",
    관련도서6: "",
    관련도서7: "",
    원본: "",
    ImagePath1: "",
    탐구이론2: "이기적 유전자 관점에서 본 이타주의.",
    탐구이론3: "",
    탐구이론4: "",
    탐구이론5: "",
    ImagePath2: "",
    ImagePath3: "",
    ImagePath4: "",
    ImagePath5: "",
    ImagePath6: "",
    ImagePath7: "",
    탐구이론6: "",
    탐구이론7: "",
    가이드URL: "https://example.com/guide/862",
    가이드URL_Num: "0",
    ...overrides,
  };
}

describe("transformAccessRow", () => {
  it("기본 변환이 정상 동작해야 한다", () => {
    const row = makeRow();
    const { guide, originalSubjectName, originalCareerField } =
      transformAccessRow(row);

    expect(guide.legacyId).toBe(862);
    expect(guide.guideType).toBe("reading");
    expect(guide.curriculumYear).toBe("2015,2022");
    expect(guide.title).toBe("죽음의 수용소에서 — 인간 유형과 윤리의 당위성");
    expect(guide.bookTitle).toBe("죽음의 수용소에서");
    expect(guide.bookAuthor).toBe("빅터 프랭클");
    expect(guide.bookYear).toBe(2020);
    expect(guide.status).toBe("approved");
    expect(guide.sourceType).toBe("imported");
    expect(guide.contentFormat).toBe("plain");

    expect(originalSubjectName).toBe("생활과 윤리, 윤리와 사상");
    expect(originalCareerField).toBe("교육계열, 인문계열, 의학계열");
  });

  it("guide_type 매핑이 정확해야 한다", () => {
    expect(transformAccessRow(makeRow({ 구분유형: "독서" })).guide.guideType).toBe("reading");
    expect(transformAccessRow(makeRow({ 구분유형: "주제 탐구" })).guide.guideType).toBe("topic_exploration");
    expect(transformAccessRow(makeRow({ 구분유형: "교과수행" })).guide.guideType).toBe("subject_performance");
    expect(transformAccessRow(makeRow({ 구분유형: "실험 및 연구" })).guide.guideType).toBe("experiment");
    expect(transformAccessRow(makeRow({ 구분유형: "교육프로그램" })).guide.guideType).toBe("program");
    // 알 수 없는 분류 → 기본값
    expect(transformAccessRow(makeRow({ 구분유형: "기타" })).guide.guideType).toBe("topic_exploration");
  });

  it("탐구이론 1~7이 theory_sections로 합성되어야 한다", () => {
    const { content } = transformAccessRow(makeRow());
    // 탐구이론 + 탐구이론2 = 2개 섹션
    expect(content.theorySections).toHaveLength(2);
    expect(content.theorySections![0].content).toBe("자연선택은 적자생존의 메커니즘이다.");
    expect(content.theorySections![1].content).toBe("이기적 유전자 관점에서 본 이타주의.");
  });

  it("빈 이론 필드는 건너뛰어야 한다", () => {
    const { content } = transformAccessRow(
      makeRow({ 탐구이론: "단일 이론", 탐구이론2: "", 탐구이론3: "" }),
    );
    expect(content.theorySections).toHaveLength(1);
    expect(content.theorySections![0].content).toBe("단일 이론");
  });

  it("관련논문이 파싱되어야 한다", () => {
    const { content } = transformAccessRow(makeRow());
    expect(content.relatedPapers).toHaveLength(2);
    expect(content.relatedPapers![0].url).toBe("https://example.com/paper1");
    expect(content.relatedPapers![0].title).toBe("빅터 프랭클의 삶의 의미론(신경희, 2020)");
    expect(content.relatedPapers![1].title).toBe("유전자 발현 연구");
    expect(content.relatedPapers![1].url).toBeUndefined();
  });

  it("관련도서 1~7이 배열로 합성되어야 한다", () => {
    const { content } = transformAccessRow(makeRow());
    expect(content.relatedBooks).toEqual([
      "《삶의 의미와 위대한 철학자들》",
      "《내 삶의 의미는 무엇인가》",
    ]);
  });

  it("교과세특 1/2가 배열로 합성되어야 한다", () => {
    const { content } = transformAccessRow(makeRow());
    expect(content.setekExamples).toHaveLength(2);
    expect(content.setekExamples![0]).toContain("미래에 대한 희망");
    expect(content.setekExamples![1]).toContain("윤리적 삶");
  });

  it("개정년도가 정규화되어야 한다", () => {
    expect(transformAccessRow(makeRow({ 개정년도: "2015년, 2022년" })).guide.curriculumYear).toBe("2015,2022");
    expect(transformAccessRow(makeRow({ 개정년도: "2022년" })).guide.curriculumYear).toBe("2022");
    expect(transformAccessRow(makeRow({ 개정년도: "" })).guide.curriculumYear).toBeUndefined();
  });

  it("빈 필드는 undefined로 처리되어야 한다", () => {
    const { guide, content } = transformAccessRow(
      makeRow({
        도서이름: "",
        저자: "",
        출판연도: "",
        탐구동기: "",
        탐구이론: "",
        탐구이론2: "",
        관련논문1: "",
        관련논문2: "",
      }),
    );
    expect(guide.bookTitle).toBeUndefined();
    expect(guide.bookAuthor).toBeUndefined();
    expect(guide.bookYear).toBeUndefined();
    expect(content.motivation).toBeUndefined();
    expect(content.theorySections).toEqual([]);
    expect(content.relatedPapers).toEqual([]);
  });

  it("잘못된 출판연도는 무시되어야 한다", () => {
    expect(transformAccessRow(makeRow({ 출판연도: "abc" })).guide.bookYear).toBeUndefined();
    expect(transformAccessRow(makeRow({ 출판연도: "1800" })).guide.bookYear).toBeUndefined();
    expect(transformAccessRow(makeRow({ 출판연도: "2200" })).guide.bookYear).toBeUndefined();
  });

  it("rawSource에 원본 행이 저장되어야 한다", () => {
    const row = makeRow();
    const { content } = transformAccessRow(row);
    expect(content.rawSource).toEqual(row);
  });

  it("주제가 비어있으면 도서이름을 title로 사용해야 한다", () => {
    const { guide } = transformAccessRow(makeRow({ 주제: "", 도서이름: "테스트 도서" }));
    expect(guide.title).toBe("테스트 도서");
  });
});
