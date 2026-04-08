import { describe, it, expect } from "vitest";
import { normalizeSubjectName } from "../normalize";

describe("normalizeSubjectName", () => {
  // ============================================
  // 1. 로마숫자 변환 (Unicode / ASCII / Arabic)
  // ============================================

  describe("로마숫자 변환", () => {
    it("Unicode Ⅰ~Ⅳ → 아라비아 숫자", () => {
      expect(normalizeSubjectName("물리학Ⅰ")).toBe("물리학1");
      expect(normalizeSubjectName("물리학Ⅱ")).toBe("물리학2");
      expect(normalizeSubjectName("수학Ⅲ")).toBe("수학3");
      expect(normalizeSubjectName("한문Ⅳ")).toBe("한문4");
    });

    it("ASCII I~IV(끝자리) → 아라비아 숫자", () => {
      expect(normalizeSubjectName("물리학I")).toBe("물리학1");
      expect(normalizeSubjectName("물리학II")).toBe("물리학2");
      expect(normalizeSubjectName("화학III")).toBe("화학3");
      expect(normalizeSubjectName("한문IV")).toBe("한문4");
    });

    it("이미 아라비아 숫자인 경우 그대로 유지", () => {
      expect(normalizeSubjectName("물리학1")).toBe("물리학1");
      expect(normalizeSubjectName("물리학2")).toBe("물리학2");
    });

    it("세 가지 표기가 모두 같은 결과", () => {
      const variants = ["물리학Ⅰ", "물리학I", "물리학1"];
      const normalized = variants.map(normalizeSubjectName);
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe("물리학1");
    });

    it("과학 과목 전체 변종 일관성", () => {
      // 화학
      expect(normalizeSubjectName("화학Ⅰ")).toBe(normalizeSubjectName("화학I"));
      expect(normalizeSubjectName("화학I")).toBe(normalizeSubjectName("화학1"));
      // 생명과학
      expect(normalizeSubjectName("생명과학Ⅱ")).toBe(normalizeSubjectName("생명과학II"));
      expect(normalizeSubjectName("생명과학II")).toBe(normalizeSubjectName("생명과학2"));
      // 지구과학
      expect(normalizeSubjectName("지구과학Ⅰ")).toBe(normalizeSubjectName("지구과학I"));
      expect(normalizeSubjectName("지구과학I")).toBe(normalizeSubjectName("지구과학1"));
    });
  });

  // ============================================
  // 2. 공백 처리
  // ============================================

  describe("공백 처리", () => {
    it("내부 공백 제거", () => {
      expect(normalizeSubjectName("확률과 통계")).toBe("확률과통계");
      expect(normalizeSubjectName("생활과 윤리")).toBe("생활과윤리");
      expect(normalizeSubjectName("물리학 Ⅰ")).toBe("물리학1");
    });

    it("공백 있는/없는 버전이 같은 결과", () => {
      expect(normalizeSubjectName("확률과통계")).toBe(normalizeSubjectName("확률과 통계"));
      expect(normalizeSubjectName("생활과윤리")).toBe(normalizeSubjectName("생활과 윤리"));
      expect(normalizeSubjectName("동아시아사")).toBe(normalizeSubjectName("동아시아 사"));
    });

    it("양쪽 공백 trim", () => {
      expect(normalizeSubjectName("  수학  ")).toBe("수학");
      expect(normalizeSubjectName("\t영어\n")).toBe("영어");
    });
  });

  // ============================================
  // 3. 가운뎃점(middle dot) 처리
  // ============================================

  describe("가운뎃점 처리", () => {
    it("U+00B7 (·) 제거", () => {
      expect(normalizeSubjectName("사회·문화")).toBe("사회문화");
    });

    it("U+2027 (‧) 제거", () => {
      expect(normalizeSubjectName("사회‧문화")).toBe("사회문화");
    });

    it("U+30FB (・) 제거", () => {
      expect(normalizeSubjectName("사회・문화")).toBe("사회문화");
    });

    it("모든 가운뎃점 변종이 같은 결과", () => {
      const variants = ["사회·문화", "사회‧문화", "사회・문화", "사회문화"];
      const normalized = variants.map(normalizeSubjectName);
      expect(new Set(normalized).size).toBe(1);
    });
  });

  // ============================================
  // 4. 괄호 처리
  // ============================================

  describe("괄호 처리", () => {
    it("소괄호 + 내용 제거", () => {
      expect(normalizeSubjectName("기술(가정)")).toBe("기술");
      expect(normalizeSubjectName("사회(역사/도덕 포함)")).toBe("사회");
    });

    it("대괄호 제거", () => {
      expect(normalizeSubjectName("수학[공통]")).toBe("수학공통");
    });
  });

  // ============================================
  // 5. 대소문자
  // ============================================

  describe("대소문자 변환", () => {
    it("영문 소문자화", () => {
      expect(normalizeSubjectName("English")).toBe("english");
      expect(normalizeSubjectName("AP Chemistry")).toBe("apchemistry");
    });
  });

  // ============================================
  // 6. 2015 vs 2022 교육과정 과목명 구분
  // ============================================

  describe("교육과정별 과목명 구분", () => {
    it("2015 '사회·문화'와 2022 '사회와 문화'는 다른 결과", () => {
      // 2015: 사회·문화 → 중점 제거 → "사회문화"
      // 2022: 사회와 문화 → 공백 제거 → "사회와문화"
      // 조사 "와"는 제거 대상이 아니므로 다른 과목으로 식별됨 (정상)
      expect(normalizeSubjectName("사회·문화")).not.toBe(
        normalizeSubjectName("사회와 문화"),
      );
    });

    it("2015 '동아시아사'와 2022 '동아시아 역사'는 다른 결과", () => {
      expect(normalizeSubjectName("동아시아사")).not.toBe(
        normalizeSubjectName("동아시아 역사"),
      );
    });

    it("2015 '물리학Ⅰ'과 2022 '물리학'(단일)은 다른 결과", () => {
      expect(normalizeSubjectName("물리학Ⅰ")).not.toBe(
        normalizeSubjectName("물리학"),
      );
    });
  });

  // ============================================
  // 7. LEARNING_SEQUENCE_CHAINS 상수 호환
  // ============================================

  describe("LEARNING_SEQUENCE_CHAINS 상수 호환", () => {
    it("'수학1' ↔ '수학Ⅰ' 매칭", () => {
      expect(normalizeSubjectName("수학1")).toBe(normalizeSubjectName("수학Ⅰ"));
    });

    it("'물리학1' ↔ '물리학Ⅰ' 매칭", () => {
      expect(normalizeSubjectName("물리학1")).toBe(normalizeSubjectName("물리학Ⅰ"));
    });

    it("'확률과통계' ↔ '확률과 통계' 매칭", () => {
      expect(normalizeSubjectName("확률과통계")).toBe(
        normalizeSubjectName("확률과 통계"),
      );
    });
  });

  // ============================================
  // 8. 실제 과목명 종합 테스트
  // ============================================

  describe("실제 과목명 종합", () => {
    const cases: [string, string][] = [
      // 기본 과목
      ["국어", "국어"],
      ["수학", "수학"],
      ["영어", "영어"],
      ["한국사", "한국사"],
      // 로마숫자 과목
      ["영어Ⅰ", "영어1"],
      ["영어I", "영어1"],
      ["수학Ⅱ", "수학2"],
      ["제2외국어Ⅰ", "제2외국어1"],
      // 복합 과목명
      ["화법과 작문", "화법과작문"],
      ["언어와 매체", "언어와매체"],
      ["영어 독해와 작문", "영어독해와작문"],
      ["정치와 법", "정치와법"],
      ["윤리와 사상", "윤리와사상"],
      // 2022 개정 과목
      ["공통수학1", "공통수학1"],
      ["공통수학2", "공통수학2"],
      ["통합과학1", "통합과학1"],
      ["통합과학2", "통합과학2"],
      ["미적분Ⅰ", "미적분1"],
      ["역학과 에너지", "역학과에너지"],
      ["전자기와 양자", "전자기와양자"],
      ["세포와 물질대사", "세포와물질대사"],
      // 기술·가정
      ["기술·가정", "기술가정"],
    ];

    it.each(cases)("'%s' → '%s'", (input, expected) => {
      expect(normalizeSubjectName(input)).toBe(expected);
    });
  });
});
