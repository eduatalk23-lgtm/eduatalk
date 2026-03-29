// ============================================
// 도메인 지식 빌더 시나리오 테스트
// 다양한 학생 프로필 × 컨설팅 상황별 정합성 검증
// ============================================

import { describe, it, expect } from "vitest";
import { buildDomainKnowledgeBlock } from "../domain-knowledge";

// ── 헬퍼 ──

function build(ctx: Parameters<typeof buildDomainKnowledgeBlock>[0] = {}) {
  return buildDomainKnowledgeBlock(ctx);
}

// ============================================
// 1. 항상 포함 섹션 (Always-on sections)
// ============================================

describe("항상 포함 섹션", () => {
  const block = build();

  it("컨설팅 도메인 지식 헤더가 존재한다", () => {
    expect(block).toContain("## 컨설팅 도메인 지식");
  });

  it("전형별 전략이 포함된다", () => {
    expect(block).toContain("### 전형별 생기부 전략");
    expect(block).toContain("학생부종합");
    expect(block).toContain("학생부교과");
    expect(block).toContain("논술");
    expect(block).toContain("정시");
  });

  it("대학 티어별 기대 수준이 포함된다", () => {
    expect(block).toContain("### 대학 티어별 기록 기대 수준");
    expect(block).toContain("SKY");
    expect(block).toContain("상위 서울권");
    expect(block).toContain("서울권");
    expect(block).toContain("지방거점국립");
  });

  it("입학사정관 관점이 포함된다", () => {
    expect(block).toContain("### 입학사정관 평가 관점");
    expect(block).toContain("Red Flag");
    expect(block).toContain("Green Flag");
    expect(block).toContain("8~15분");
  });

  it("면접 참조 정보가 포함된다", () => {
    expect(block).toContain("면접");
    expect(block).toContain("서류확인");
    expect(block).toContain("제시문");
    expect(block).toContain("MMI");
  });

  it("세특 판별 참조가 포함된다", () => {
    expect(block).toContain("세특 판별");
    expect(block).toContain("최상");
  });

  it("빈 컨텍스트에서도 기본 학년별 접근법이 포함된다", () => {
    expect(block).toContain("### 학년별 접근법");
    expect(block).toContain("탐색기");
    expect(block).toContain("집중기");
    expect(block).toContain("완성기");
  });
});

// ============================================
// 2. 학년별 조건부 주입 (Grade-level conditional)
// ============================================

describe("학년별 전략 조건부 주입", () => {
  it("1학년: 탐색기 전략만 포함된다", () => {
    const block = build({ studentGrade: 1 });
    expect(block).toContain("1학년 (탐색기)");
    expect(block).toContain("폭넓은 탐색");
    expect(block).toContain("약점 지적은 최소화");
    // 다른 학년 전략 미포함
    expect(block).not.toContain("2학년 (집중기)");
    expect(block).not.toContain("3학년 (완성기)");
  });

  it("2학년: 집중기 전략만 포함된다", () => {
    const block = build({ studentGrade: 2 });
    expect(block).toContain("2학년 (집중기)");
    expect(block).toContain("스토리라인 형성");
    expect(block).toContain('"넓게"보다 "깊게"');
    expect(block).not.toContain("1학년 (탐색기)");
    expect(block).not.toContain("3학년 (완성기)");
  });

  it("3학년: 완성기 전략만 포함된다", () => {
    const block = build({ studentGrade: 3 });
    expect(block).toContain("3학년 (완성기)");
    expect(block).toContain("남은 시간이 제한적");
    expect(block).toContain("면접 대비를 병행");
    expect(block).not.toContain("1학년 (탐색기)");
    expect(block).not.toContain("2학년 (집중기)");
  });

  it("학년 null이면 압축 버전(3학년 모두)이 나온다", () => {
    const block = build({ studentGrade: null });
    expect(block).toContain("### 학년별 접근법");
    expect(block).toContain("1학년(탐색기)");
    expect(block).toContain("2학년(집중기)");
    expect(block).toContain("3학년(완성기)");
  });

  it("학년 undefined도 압축 버전으로 처리된다", () => {
    const block = build({});
    expect(block).toContain("### 학년별 접근법");
  });
});

// ============================================
// 3. 학교 유형별 조건부 주입 (School type conditional)
// ============================================

describe("학교 유형별 맥락 조건부 주입", () => {
  it("일반고: 내신 유리 + 자기주도 강조", () => {
    const block = build({ schoolCategory: "general" });
    expect(block).toContain("학교 유형 맥락: 일반고");
    expect(block).toContain("내신 경쟁이 상대적으로 유리");
    expect(block).toContain("자기주도 탐구");
  });

  it("자사고(사립): 내신 불리 + 종합전형 전략", () => {
    const block = build({ schoolCategory: "autonomous_private" });
    expect(block).toContain("학교 유형 맥락: 자사고");
    expect(block).toContain("내신 경쟁 치열");
    expect(block).toContain("학생부종합 전략");
  });

  it("자공고: 자사고와 동일한 전략", () => {
    const block = build({ schoolCategory: "autonomous_public" });
    expect(block).toContain("학교 유형 맥락: 자공고");
    expect(block).toContain("내신 경쟁 치열");
  });

  it("과학고: R&E + 조기졸업 + 과기원 전형", () => {
    const block = build({ schoolCategory: "science" });
    expect(block).toContain("학교 유형 맥락: 과학고");
    expect(block).toContain("R&E");
    expect(block).toContain("조기졸업");
    expect(block).toContain("KAIST");
  });

  it("외고: 어학 특화 + 자연계 전환 경고", () => {
    const block = build({ schoolCategory: "foreign_lang" });
    expect(block).toContain("학교 유형 맥락: 외고");
    expect(block).toContain("어학 특화");
    expect(block).toContain("자연계 전환 시");
  });

  it("국제고: 글로벌 역량 + 자연계 전환 경고", () => {
    const block = build({ schoolCategory: "international" });
    expect(block).toContain("학교 유형 맥락: 국제고");
    expect(block).toContain("글로벌 역량");
  });

  it("schoolCategory null이면 학교 유형 섹션 미포함", () => {
    const block = build({ schoolCategory: null });
    expect(block).not.toContain("학교 유형 맥락");
  });

  it("미지원 학교 유형(art)이면 섹션 미포함", () => {
    const block = build({ schoolCategory: "art" });
    expect(block).not.toContain("학교 유형 맥락");
  });

  it("미지원 학교 유형(meister)이면 섹션 미포함", () => {
    const block = build({ schoolCategory: "meister" });
    expect(block).not.toContain("학교 유형 맥락");
  });

  it("존재하지 않는 카테고리 코드는 무시된다", () => {
    const block = build({ schoolCategory: "nonexistent" });
    expect(block).not.toContain("학교 유형 맥락");
  });
});

// ============================================
// 4. 희망 전공 주입 (Target major)
// ============================================

describe("희망 전공 주입", () => {
  it("전공이 있으면 우선 고려 안내가 표시된다", () => {
    const block = build({ targetMajor: "의예과" });
    expect(block).toContain("의예과");
    expect(block).toContain("전공 적합성을 우선 고려");
  });

  it("전공이 null이면 안내가 없다", () => {
    const block = build({ targetMajor: null });
    expect(block).not.toContain("전공 적합성을 우선 고려");
  });

  it("전공이 빈 문자열이면 안내가 없다", () => {
    const block = build({ targetMajor: "" });
    expect(block).not.toContain("전공 적합성을 우선 고려");
  });
});

// ============================================
// 5. 실제 컨설팅 시나리오 (Realistic consulting personas)
// ============================================

describe("컨설팅 시나리오: 과학고 2학년 의대 지망생", () => {
  const block = build({
    studentGrade: 2,
    schoolCategory: "science",
    targetMajor: "의예과",
  });

  it("의예과 전공 적합성 우선 고려 안내", () => {
    expect(block).toContain("의예과");
  });

  it("2학년 집중기 전략 (심화 탐구)", () => {
    expect(block).toContain("집중기");
    expect(block).toContain("스토리라인 형성");
  });

  it("과학고 맥락 (R&E, 과기원)", () => {
    expect(block).toContain("과학고");
    expect(block).toContain("R&E");
  });

  it("MMI 면접 정보가 의대 지망에 관련", () => {
    expect(block).toContain("MMI");
    expect(block).toContain("의약학");
  });
});

describe("컨설팅 시나리오: 일반고 1학년 탐색 중", () => {
  const block = build({
    studentGrade: 1,
    schoolCategory: "general",
    targetMajor: null,
  });

  it("전공 안내 없음 (미정)", () => {
    expect(block).not.toContain("전공 적합성을 우선 고려");
  });

  it("1학년 탐색기 전략", () => {
    expect(block).toContain("탐색기");
    expect(block).toContain("다양한 활동 경험 자체가 자산");
  });

  it("일반고 맥락", () => {
    expect(block).toContain("일반고");
  });

  it("약점 지적 최소화 가이드", () => {
    expect(block).toContain("약점 지적은 최소화");
  });
});

describe("컨설팅 시나리오: 자사고 3학년 경영학 지망", () => {
  const block = build({
    studentGrade: 3,
    schoolCategory: "autonomous_private",
    targetMajor: "경영학",
  });

  it("경영학 전공 우선 고려", () => {
    expect(block).toContain("경영학");
  });

  it("3학년 완성기 — 시간 제약 강조", () => {
    expect(block).toContain("완성기");
    expect(block).toContain("남은 시간이 제한적");
  });

  it("자사고 — 내신 불리 감안 전략", () => {
    expect(block).toContain("자사고");
    expect(block).toContain("내신 불리를 감안");
  });

  it("강점 극대화 방향 (3학년 특성)", () => {
    expect(block).toContain("강점 극대화에 집중");
  });
});

describe("컨설팅 시나리오: 외고 2학년 정치외교학 지망", () => {
  const block = build({
    studentGrade: 2,
    schoolCategory: "foreign_lang",
    targetMajor: "정치외교학",
  });

  it("정치외교학 전공 우선 고려", () => {
    expect(block).toContain("정치외교학");
  });

  it("외고 어학 특화 강점", () => {
    expect(block).toContain("외고");
    expect(block).toContain("인문·사회 계열에 유리");
  });

  it("자연계 전환 경고는 포함되나, 인문계열이므로 해당 없음을 에이전트가 판단", () => {
    // 경고 자체는 포함됨 (에이전트가 맥락 판단)
    expect(block).toContain("자연계 전환 시");
  });
});

describe("컨설팅 시나리오: 프로필 정보 전무 (최소 컨텍스트)", () => {
  const block = build({});

  it("핵심 계층 + 참조 계층이 모두 포함된다 (학교 유형 제외)", () => {
    expect(block).toContain("전형별 생기부 전략");
    expect(block).toContain("학년별 접근법");
    expect(block).toContain("대학 티어별 기록 기대 수준");
    expect(block).toContain("입학사정관 평가 관점");
    expect(block).toContain("참조 지식");
    expect(block).toContain("세특 판별");
    expect(block).not.toContain("학교 유형 맥락");
  });
});

// ============================================
// 6. 섹션 순서 및 구조 검증 (Structural)
// ============================================

describe("섹션 순서 및 구조", () => {
  it("도메인 지식 헤더가 첫 번째로 온다", () => {
    const block = build();
    expect(block.indexOf("## 컨설팅 도메인 지식")).toBeLessThan(
      block.indexOf("### 전형별 생기부 전략"),
    );
  });

  it("전형별 전략이 학년별 접근법보다 먼저 온다", () => {
    const block = build();
    expect(block.indexOf("전형별 생기부 전략")).toBeLessThan(
      block.indexOf("학년별 접근법"),
    );
  });

  it("평가자 관점이 참조 블록보다 먼저 온다", () => {
    const block = build();
    expect(block.indexOf("입학사정관 평가 관점")).toBeLessThan(
      block.indexOf("참조 지식"),
    );
  });

  it("참조 블록이 마지막에 온다", () => {
    const block = build();
    expect(block.indexOf("참조 지식")).toBeGreaterThan(
      block.indexOf("입학사정관 평가 관점"),
    );
  });

  it("희망 전공이 있으면 전형별 전략보다 먼저 표시된다", () => {
    const block = build({ targetMajor: "컴퓨터공학" });
    expect(block.indexOf("컴퓨터공학")).toBeLessThan(
      block.indexOf("전형별 생기부 전략"),
    );
  });

  it("학교 유형이 있으면 참조 블록보다 먼저 온다", () => {
    const block = build({ schoolCategory: "general" });
    expect(block.indexOf("학교 유형 맥락")).toBeLessThan(
      block.indexOf("참조 지식"),
    );
  });
});

// ============================================
// 7. 엣지 케이스 (Edge cases)
// ============================================

describe("엣지 케이스", () => {
  it("학년이 0이면 압축 버전으로 폴백", () => {
    const block = build({ studentGrade: 0 });
    expect(block).toContain("### 학년별 접근법");
    expect(block).not.toContain("현재 학년 전략");
  });

  it("학년이 4 이상이면 압축 버전으로 폴백", () => {
    const block = build({ studentGrade: 4 });
    expect(block).toContain("### 학년별 접근법");
    expect(block).not.toContain("현재 학년 전략");
  });

  it("모든 필드가 동시에 제공되어도 깨지지 않는다", () => {
    const block = build({
      studentGrade: 2,
      schoolCategory: "science",
      targetMajor: "의예과",
    });
    expect(block).toContain("## 컨설팅 도메인 지식");
    expect(block).toContain("의예과");
    expect(block).toContain("집중기");
    expect(block).toContain("과학고");
    expect(block).toContain("참조 지식");
  });

  it("모든 필드가 null이어도 기본 블록이 반환된다", () => {
    const block = build({
      studentGrade: null,
      schoolCategory: null,
      targetMajor: null,
    });
    expect(block).toContain("## 컨설팅 도메인 지식");
    expect(block).toContain("전형별 생기부 전략");
  });

  it("반환값은 항상 문자열이다", () => {
    expect(typeof build()).toBe("string");
    expect(typeof build({ studentGrade: 1 })).toBe("string");
    expect(typeof build({ schoolCategory: "nonexistent" })).toBe("string");
  });
});

// ============================================
// 8. 컨텐츠 정합성 (Content correctness)
// ============================================

describe("컨텐츠 정합성", () => {
  it("학생부종합 전략에 세특 깊이가 핵심으로 언급된다", () => {
    const block = build();
    expect(block).toMatch(/학생부종합.*세특 깊이/);
  });

  it("학생부교과 전략에 내신 등급이 절대적으로 언급된다", () => {
    const block = build();
    expect(block).toMatch(/학생부교과.*내신 등급이 절대적/);
  });

  it("SKY 기대 수준에 독창적 탐구가 포함된다", () => {
    const block = build();
    expect(block).toMatch(/SKY.*독창적 탐구/);
  });

  it("Red Flag에 활동 나열식이 포함된다", () => {
    const block = build();
    expect(block).toMatch(/Red Flag.*활동 나열식/);
  });

  it("Green Flag에 자기주도 심화가 포함된다", () => {
    const block = build();
    expect(block).toMatch(/Green Flag.*자기주도 심화/);
  });

  it("세특 최상 판별에 자체 설계가 포함된다", () => {
    const block = build();
    expect(block).toMatch(/최상.*자체 설계/);
  });

  it("세특 중 등급에 참여함 수준이 언급된다", () => {
    const block = build();
    expect(block).toMatch(/중.*참여함/);
  });
});
