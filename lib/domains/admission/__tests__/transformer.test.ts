import { describe, it, expect } from "vitest";
import { transformRows } from "../import/transformer";
import type { RawAdmissionRow, YearMapping } from "../types";

const years: YearMapping = { year0: 2025, year1: 2024, year2: 2023 };

const HEADERS = [
  "기초", "대학교", "계열", "모집단위명", "전형유형", "전형명",
  "지원자격", "모집인원", "전년대비", "전년대비 변경사항",
  "최저학력기준", "전형방법", "필요서류", "복수지원",
  "학년별반영비율", "반영과목", "진로선택과목",
  "2025학년도경쟁률", "2024학년도경쟁률", "2023학년도경쟁률",
  "2025학년도 기준", "2025학년도입결(등급)", "2025학년도입결(환산점수)",
  "2025충원", "지원시 유의사항",
  "2024학년도 기준2", "2024학년도입결(등급)", "2024학년도입결(환산점수)",
  "2024충원", "2023학년도입결", "2023충원",
  "대학별고사 실시일", "경쟁률 증감",
];

describe("transformRows", () => {
  it("정상 행 변환", () => {
    const rows: RawAdmissionRow[] = [{
      "기초": "서울",
      "대학교": "서울대학교",
      "계열": "인문",
      "모집단위명": "경제학부",
      "전형유형": "학생부종합",
      "전형명": "지역균형선발전형",
      "지원자격": "고졸(예정)자",
      "모집인원": 7,
      "최저학력기준": "국,수,영,탐(2) 3합7",
      "전형방법": "서류100",
      "필요서류": "학,자",
      "복수지원": "불가",
      "2025학년도경쟁률": 3.14,
      "2024학년도경쟁률": 2.8,
      "2023학년도경쟁률": null,
      "2025학년도 기준": "최종등록자70%컷",
      "2025학년도입결(등급)": 1.11,
      "2025학년도입결(환산점수)": null,
      "2025충원": 3,
      "2024학년도 기준2": "최종등록자70%컷",
      "2024학년도입결(등급)": 1.2,
      "2024충원": 2,
      "경쟁률 증감": 0.34,
    }];

    const { transformed, errors } = transformRows(rows, HEADERS, years);
    expect(errors).toHaveLength(0);
    expect(transformed).toHaveLength(1);

    const r = transformed[0];
    expect(r.university_name).toBe("서울대학교");
    expect(r.department_name).toBe("경제학부");
    expect(r.admission_type).toBe("학생부종합");
    expect(r.admission_name).toBe("지역균형선발전형");
    expect(r.recruitment_count).toBe("7");
    expect(r.min_score_criteria).toBe("국,수,영,탐(2) 3합7");

    // 경쟁률 JSONB
    expect(r.competition_rates).toEqual({ "2025": "3.14", "2024": "2.8" });
    // 2023은 null이므로 포함되지 않음

    // 입결 JSONB
    expect(r.admission_results["2025"]).toEqual({
      basis: "최종등록자70%컷",
      grade: "1.11",
    });
    expect(r.admission_results["2024"]).toEqual({
      basis: "최종등록자70%컷",
      grade: "1.2",
    });

    // 충원 JSONB
    expect(r.replacements).toEqual({ "2025": "3", "2024": "2" });

    expect(r.competition_change).toBe("0.34");
  });

  it("대학교 없으면 에러", () => {
    const rows: RawAdmissionRow[] = [{ "대학교": null, "모집단위명": "경제학부" }];
    const { transformed, errors } = transformRows(rows, HEADERS, years);
    expect(transformed).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toContain("비어있습니다");
  });

  it("모집단위명 없으면 에러", () => {
    const rows: RawAdmissionRow[] = [{ "대학교": "서울대학교", "모집단위명": "" }];
    const { transformed, errors } = transformRows(rows, HEADERS, years);
    expect(transformed).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it("'-' 값은 null로 변환", () => {
    const rows: RawAdmissionRow[] = [{
      "대학교": "테스트대",
      "모집단위명": "테스트학과",
      "2025학년도경쟁률": "-",
      "2025학년도입결(등급)": "-",
      "2025충원": "-",
    }];
    const { transformed } = transformRows(rows, HEADERS, years);
    expect(Object.keys(transformed[0].competition_rates)).toHaveLength(0);
    expect(Object.keys(transformed[0].replacements)).toHaveLength(0);
  });

  it("비숫자 모집인원 보존", () => {
    const rows: RawAdmissionRow[] = [{
      "대학교": "경남대학교",
      "모집단위명": "군사학과",
      "모집인원": "남:15\n여:5",
    }];
    const { transformed } = transformRows(rows, HEADERS, years);
    expect(transformed[0].recruitment_count).toBe("남:15\n여:5");
  });

  it("문자열 경쟁률 보존", () => {
    const rows: RawAdmissionRow[] = [{
      "대학교": "테스트대",
      "모집단위명": "테스트학과",
      "2025학년도경쟁률": "남:2.57 여:6.00",
    }];
    const { transformed } = transformRows(rows, HEADERS, years);
    expect(transformed[0].competition_rates["2025"]).toBe("남:2.57 여:6.00");
  });

  it("빈 행 필터링 후 올바른 변환", () => {
    const rows: RawAdmissionRow[] = [
      { "대학교": "A대학교", "모집단위명": "A학과" },
      { "대학교": null, "모집단위명": null },
      { "대학교": "B대학교", "모집단위명": "B학과" },
    ];
    const { transformed, errors } = transformRows(rows, HEADERS, years);
    expect(transformed).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(transformed[0].university_name).toBe("A대학교");
    expect(transformed[1].university_name).toBe("B대학교");
  });
});
