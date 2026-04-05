// ============================================
// html-parser.ts 유닛 테스트 — 순수 함수, mock 불필요
//
// parseNeisHtml()은 브라우저 DOMParser 사용.
// Vitest는 jsdom 환경에서 실행 → DOMParser 사용 가능.
//
// 테스트 시나리오:
//   - 정상 NEIS HTML 샘플 (세특+성적+창체+행특+독서 포함)
//   - 일반/진로선택/체예 테이블 모드 각 1건
//   - 엣지: 빈 HTML, 섹션 누락, 특수문자
// ============================================

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { parseNeisHtml } from "../import/html-parser";

// ============================================
// 테스트 HTML 샘플 생성 헬퍼
// ============================================

/** 최소한의 NEIS 학부모서비스 HTML 골격 */
function buildNeisHtml(sections: {
  personal?: string;
  attendance?: string;
  awards?: string;
  creative?: string;
  academic?: string;
  reading?: string;
  behavior?: string;
  classInfo?: string;
}): string {
  const parts: string[] = ["<html><body>"];

  if (sections.classInfo) {
    parts.push(`<div>학반정보</div>${sections.classInfo}`);
  }
  if (sections.personal) {
    parts.push(`<div>1. 인적·학적사항</div>${sections.personal}`);
  }
  if (sections.attendance) {
    parts.push(`<div>2. 출결상황</div>${sections.attendance}`);
  }
  if (sections.awards) {
    parts.push(`<div>3. 수상경력</div>${sections.awards}`);
  }
  parts.push("<div>4. 자격증</div>");
  parts.push("<div>5. 학교폭력</div>");
  if (sections.creative) {
    parts.push(`<div>6. 창의적 체험활동상황</div>${sections.creative}`);
  }
  if (sections.academic) {
    parts.push(`<div>7. 교과학습발달상황</div>${sections.academic}`);
  }
  if (sections.reading) {
    parts.push(`<div>8. 독서활동상황</div>${sections.reading}`);
  }
  if (sections.behavior) {
    parts.push(`<div>9. 행동특성 및 종합의견</div>${sections.behavior}`);
  }

  parts.push("<div>개인정보처리방침</div></body></html>");
  return parts.join("\n");
}

// ============================================
// 1. 빈 HTML
// ============================================

describe("빈 / 최소 HTML", () => {
  it("빈 문자열 → 모든 필드 빈 배열/기본값", () => {
    const result = parseNeisHtml("");
    expect(result.studentInfo.name).toBe("");
    expect(result.detailedCompetencies).toEqual([]);
    expect(result.grades).toEqual([]);
    expect(result.creativeActivities).toEqual([]);
    expect(result.attendance).toEqual([]);
    expect(result.readingActivities).toEqual([]);
    expect(result.behavioralCharacteristics).toEqual([]);
  });

  it("섹션 헤더만 → 빈 데이터", () => {
    const html = buildNeisHtml({});
    const result = parseNeisHtml(html);
    expect(result.detailedCompetencies).toEqual([]);
    expect(result.grades).toEqual([]);
  });
});

// ============================================
// 2. 학생 정보 파싱
// ============================================

describe("학생 정보", () => {
  it("성명 + 입학연도 + 학교명 추출", () => {
    const html = buildNeisHtml({
      personal: `
        <div>성명</div>
        <div>홍길동</div>
        <div>2024년 03월 01일  서울고등학교  제1학년 입학</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.studentInfo.name).toBe("홍길동");
    expect(result.studentInfo.schoolYear).toBe(2024);
    expect(result.studentInfo.schoolName).toContain("서울고등학교");
  });
});

// ============================================
// 3. 교과학습발달상황 — 일반과목 성적
// ============================================

describe("교과 성적 — 일반과목", () => {
  it("학년/학기/과목/원점수/성취도/석차등급 파싱", () => {
    const html = buildNeisHtml({
      academic: `
        <div>1학년</div>
        <div>1</div>
        <div>국어</div>
        <div>국어</div>
        <div>3</div>
        <div>85/82.3(10.5)</div>
        <div>B(120)</div>
        <div>3</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.grades.length).toBeGreaterThanOrEqual(1);
    const g = result.grades[0];
    expect(g.grade).toBe("1학년");
    expect(g.semester).toBe("1학기");
    expect(g.subject).toBe("국어");
    expect(g.rawScore).toBe(85);
    expect(g.classAverage).toBe(82.3);
    expect(g.standardDeviation).toBe(10.5);
    expect(g.achievementLevel).toBe("B");
    expect(g.totalStudents).toBe(120);
    expect(g.rankGrade).toBe(3);
  });
});

// ============================================
// 4. 교과학습발달상황 — 진로선택 과목
// ============================================

describe("교과 성적 — 진로선택", () => {
  it("성취도 + 분포비율 파싱 (석차등급 없음)", () => {
    const html = buildNeisHtml({
      academic: `
        <div>2학년</div>
        <div>진로 선택 과목</div>
        <div>1</div>
        <div>과학</div>
        <div>물리학II</div>
        <div>3</div>
        <div>91/90.1</div>
        <div>A(30)</div>
        <div>A(85.2) B(14.8) C(0.0)</div>
      `,
    });
    const result = parseNeisHtml(html);
    const elective = result.grades.find((g) => g.subject === "물리학II");
    expect(elective).toBeDefined();
    expect(elective!.achievementLevel).toBe("A");
    expect(elective!.rawScore).toBe(91);
    expect(elective!.rankGrade).toBe(0); // 진로선택은 석차등급 없음
    expect(elective!.achievementRatioA).toBe(85.2);
    expect(elective!.achievementRatioB).toBe(14.8);
  });
});

// ============================================
// 5. 세부능력 및 특기사항
// ============================================

describe("세특 파싱", () => {
  it("과목: 내용 형식 → subject/content 분리", () => {
    const html = buildNeisHtml({
      academic: `
        <div>1학년</div>
        <div>세부능력 및 특기사항</div>
        <div>국어: 수업 시간에 적극적으로 참여하여 탁월한 이해력을 보임.</div>
        <div>수학: 문제 해결 능력이 뛰어나며 논리적 사고력이 우수함.</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.detailedCompetencies).toHaveLength(2);
    expect(result.detailedCompetencies[0].grade).toBe("1학년");
    expect(result.detailedCompetencies[0].subject).toBe("국어");
    expect(result.detailedCompetencies[0].content).toContain("적극적");
    expect(result.detailedCompetencies[1].subject).toBe("수학");
  });

  it("학기 접두사 '(2학기)수학' → semester 추출", () => {
    const html = buildNeisHtml({
      academic: `
        <div>2학년</div>
        <div>세부능력 및 특기사항</div>
        <div>(2학기)영어: 독해 능력이 크게 향상됨.</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.detailedCompetencies[0].semester).toBe("2학기");
    expect(result.detailedCompetencies[0].subject).toBe("영어");
  });
});

// ============================================
// 6. 창의적 체험활동상황
// ============================================

describe("창체 파싱", () => {
  it("자율/동아리/진로 3영역 + 시간 + 내용", () => {
    const html = buildNeisHtml({
      creative: `
        <div>1</div>
        <div>자율활동</div>
        <div>34</div>
        <div>학급 자치 활동에 적극 참여함.</div>
        <div>동아리활동</div>
        <div>68</div>
        <div>과학탐구반에서 실험 설계에 주도적으로 참여함.</div>
        <div>진로활동</div>
        <div>20</div>
        <div>대학 탐방 프로그램에 참가하여 진로를 탐색함.</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.creativeActivities).toHaveLength(3);
    const auto = result.creativeActivities.find((a) => a.category === "자율활동");
    expect(auto).toBeDefined();
    expect(auto!.hours).toBe(34);
    expect(auto!.grade).toBe("1학년");
    const club = result.creativeActivities.find((a) => a.category === "동아리활동");
    expect(club!.hours).toBe(68);
  });
});

// ============================================
// 7. 출결상황
// ============================================

describe("출결 파싱", () => {
  it("학년별 결석/지각/조퇴/결과 합산", () => {
    const html = buildNeisHtml({
      attendance: `
        <div>학년</div><div>수업일수</div>
        <div>결석일수</div><div>질병</div><div>미인정</div><div>기타</div>
        <div>지각</div><div>질병</div><div>미인정</div><div>기타</div>
        <div>조퇴</div><div>질병</div><div>미인정</div><div>기타</div>
        <div>결과</div><div>질병</div><div>미인정</div><div>기타</div>
        <div>특기사항</div>
        <div>1</div>
        <div>190</div>
        <div>2</div><div>0</div><div>0</div>
        <div>1</div><div>0</div><div>0</div>
        <div>0</div><div>0</div><div>0</div>
        <div>0</div><div>0</div><div>0</div>
        <div>없음</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.attendance.length).toBeGreaterThanOrEqual(1);
    const a = result.attendance[0];
    expect(a.grade).toBe("1학년");
    expect(a.sickAbsence).toBe(2);
    expect(a.unauthorizedAbsence).toBe(0);
  });
});

// ============================================
// 8. 독서활동상황
// ============================================

describe("독서 파싱", () => {
  it("제목(저자) 패턴 파싱", () => {
    const html = buildNeisHtml({
      reading: `
        <div>학년</div><div>독서 활동 상황</div>
        <div>1</div>
        <div>총균쇠(재레드 다이아몬드), 사피엔스(유발 하라리)</div>
        <div>2</div>
        <div>코스모스(칼 세이건)</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.readingActivities).toHaveLength(3);
    expect(result.readingActivities[0].bookTitle).toBe("총균쇠");
    expect(result.readingActivities[0].author).toBe("재레드 다이아몬드");
    expect(result.readingActivities[0].grade).toBe("1학년");
    expect(result.readingActivities[2].grade).toBe("2학년");
  });

  it("저자 없는 도서 → author 빈 문자열", () => {
    const html = buildNeisHtml({
      reading: `
        <div>1</div>
        <div>이상한 나라의 앨리스</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.readingActivities[0].bookTitle).toBe("이상한 나라의 앨리스");
    expect(result.readingActivities[0].author).toBe("");
  });
});

// ============================================
// 9. 행동특성 및 종합의견
// ============================================

describe("행특 파싱", () => {
  it("20자 이상 내용만 추출", () => {
    const longContent = "성실하고 책임감이 강하며 학급 활동에 적극적으로 참여하는 학생입니다. 리더십이 뛰어남.";
    const html = buildNeisHtml({
      behavior: `
        <div>학년</div><div>행동특성 및 종합의견</div>
        <div>1</div>
        <div>${longContent}</div>
        <div>2</div>
        <div>짧음</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.behavioralCharacteristics).toHaveLength(1);
    expect(result.behavioralCharacteristics[0].grade).toBe("1학년");
    expect(result.behavioralCharacteristics[0].content).toContain("성실하고");
  });
});

// ============================================
// 10. 학반정보
// ============================================

describe("학반정보 파싱", () => {
  it("학년/반/번호/담임 추출", () => {
    const html = buildNeisHtml({
      classInfo: `
        <div>학년</div><div>학과</div><div>반</div><div>번호</div><div>담임성명</div>
        <div>1</div>
        <div>인문</div>
        <div>3</div>
        <div>15</div>
        <div>김선생</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.classInfo).toHaveLength(1);
    expect(result.classInfo![0].grade).toBe("1학년");
    expect(result.classInfo![0].className).toBe("3");
    expect(result.classInfo![0].studentNumber).toBe("15");
    expect(result.classInfo![0].homeroomTeacher).toBe("김선생");
  });
});

// ============================================
// 11. 수상경력
// ============================================

describe("수상 파싱", () => {
  it("학년/학기/수상명/날짜/기관 추출", () => {
    const html = buildNeisHtml({
      awards: `
        <div>학년</div><div>학기</div><div>수상명</div>
        <div>1</div>
        <div>1</div>
        <div>교내 수학경시대회</div>
        <div>2024.05.15</div>
        <div>서울고등학교</div>
        <div>1학년(200)</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.awards).toHaveLength(1);
    expect(result.awards![0].awardName).toBe("교내 수학경시대회");
    expect(result.awards![0].grade).toBe("1학년");
  });
});

// ============================================
// 12. 특수문자 / 엣지 케이스
// ============================================

describe("엣지 케이스", () => {
  it("script/style 태그 제거 후 파싱", () => {
    const html = `<html><body>
      <script>alert('xss')</script>
      <style>.hidden{display:none}</style>
      <div>1. 인적·학적사항</div>
      <div>성명</div><div>테스트</div>
      <div>개인정보처리방침</div>
    </body></html>`;
    const result = parseNeisHtml(html);
    expect(result.studentInfo.name).toBe("테스트");
  });

  it("HTML 엔티티 포함 텍스트 → 정상 파싱", () => {
    const html = buildNeisHtml({
      academic: `
        <div>1학년</div>
        <div>세부능력 및 특기사항</div>
        <div>수학: x&gt;0 일 때 f(x)&lt;g(x) 임을 증명함.</div>
      `,
    });
    const result = parseNeisHtml(html);
    expect(result.detailedCompetencies[0].content).toContain("x>0");
  });

  it("여러 학년 데이터 → 학년별 분류", () => {
    const html = buildNeisHtml({
      academic: `
        <div>1학년</div>
        <div>세부능력 및 특기사항</div>
        <div>국어: 1학년 국어 내용.</div>
        <div>2학년</div>
        <div>세부능력 및 특기사항</div>
        <div>수학: 2학년 수학 내용.</div>
      `,
    });
    const result = parseNeisHtml(html);
    const g1 = result.detailedCompetencies.filter((d) => d.grade === "1학년");
    const g2 = result.detailedCompetencies.filter((d) => d.grade === "2학년");
    expect(g1).toHaveLength(1);
    expect(g1[0].subject).toBe("국어");
    expect(g2).toHaveLength(1);
    expect(g2[0].subject).toBe("수학");
  });
});
