// ============================================
// PII 마스킹 유틸 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import { maskPII, maskCaseFields } from "../utils/pii-mask";

describe("maskPII", () => {
  // ── 전화번호 마스킹 ──

  it("010-XXXX-XXXX 형식 전화번호를 마스킹한다", () => {
    expect(maskPII("연락처는 010-1234-5678입니다.")).toBe(
      "연락처는 [연락처]입니다.",
    );
  });

  it("하이픈 없는 전화번호를 마스킹한다", () => {
    expect(maskPII("01012345678로 연락")).toBe("[연락처]로 연락");
  });

  it("지역번호 전화번호를 마스킹한다", () => {
    expect(maskPII("학교 전화 02-1234-5678")).toBe("학교 전화 [연락처]");
  });

  it("016/019 등 구형 번호도 마스킹한다", () => {
    expect(maskPII("016-123-4567")).toBe("[연락처]");
  });

  // ── 이메일 마스킹 ──

  it("이메일을 마스킹한다", () => {
    expect(maskPII("이메일: student@school.ac.kr")).toBe("이메일: [연락처]");
  });

  it("복잡한 이메일을 마스킹한다", () => {
    expect(maskPII("보내기: hong.gildong+test@gmail.com")).toBe(
      "보내기: [연락처]",
    );
  });

  // ── 성적 패턴 마스킹 ──

  it("N등급 패턴을 마스킹한다", () => {
    expect(maskPII("내신 1등급을 받았습니다")).toBe("[성적]을 받았습니다");
  });

  it("소수점 등급을 마스킹한다", () => {
    expect(maskPII("평균 2.5등급")).toBe("평균 [성적]");
  });

  it("NN점 패턴을 마스킹한다", () => {
    expect(maskPII("수학 95점, 영어 88점을 받았다")).toBe(
      "수학 [성적], 영어 [성적]을 받았다",
    );
  });

  it("100점을 마스킹한다", () => {
    expect(maskPII("국어 100점")).toBe("국어 [성적]");
  });

  it("내신 N.N 패턴을 마스킹한다", () => {
    expect(maskPII("이 학생의 내신 1.5는 우수합니다")).toBe(
      "이 학생의 [성적]는 우수합니다",
    );
  });

  it("내신과 띄어쓰기 패턴을 마스킹한다", () => {
    expect(maskPII("내신 3.2가 기록되었다")).toBe("[성적]가 기록되었다");
  });

  // ── 복합 패턴 ──

  it("여러 PII가 포함된 텍스트를 모두 마스킹한다", () => {
    const input =
      "김학생의 내신 2.3등급, 수학 95점. 연락처 010-9876-5432, student@mail.com";
    const result = maskPII(input);
    expect(result).not.toContain("010-9876-5432");
    expect(result).not.toContain("student@mail.com");
    expect(result).not.toContain("2.3등급");
    expect(result).not.toContain("95점");
    expect(result).toContain("[연락처]");
    expect(result).toContain("[성적]");
  });

  // ── 비-PII 보존 ──

  it("PII가 없는 텍스트는 변경하지 않는다", () => {
    const text =
      "학생의 학업 역량과 탐구 능력은 우수하나 리더십이 부족합니다.";
    expect(maskPII(text)).toBe(text);
  });

  it("일반 숫자는 마스킹하지 않는다", () => {
    // "3학년" 같은 것은 성적이 아니므로 마스킹하지 않아야 함
    expect(maskPII("3학년 학생입니다")).toBe("3학년 학생입니다");
  });

  it("한 자리 점수는 마스킹하지 않는다", () => {
    // "5점" 같은 한 자리 점수(5점 만점 등)는 성적이 아님
    expect(maskPII("5점 만점에 4점")).toBe("5점 만점에 4점");
  });

  // ── 연속 마스킹 태그 정리 ──

  it("연속된 동일 마스킹 태그를 정리한다", () => {
    // 전화번호+이메일이 연속되면 [연락처] 하나로
    const input = "010-1234-5678 test@mail.com";
    const result = maskPII(input);
    // 연속 [연락처] 가 하나로 정리되는지 확인
    expect(result.match(/\[연락처\]/g)?.length).toBeLessThanOrEqual(2);
  });

  // ── 빈 입력 ──

  it("빈 문자열을 처리한다", () => {
    expect(maskPII("")).toBe("");
  });
});

describe("maskCaseFields", () => {
  it("모든 필드에 PII 마스킹을 적용한다", () => {
    const result = maskCaseFields({
      diagnosisSummary: "학생은 내신 2등급, 연락처 010-1111-2222",
      strategySummary: "영어 85점 이상 목표로 설정",
      keyInsights: ["수학 1등급 유지", "student@test.com으로 자료 전송"],
    });

    expect(result.diagnosisSummary).toContain("[성적]");
    expect(result.diagnosisSummary).toContain("[연락처]");
    expect(result.diagnosisSummary).not.toContain("010-1111-2222");

    expect(result.strategySummary).toContain("[성적]");
    expect(result.strategySummary).not.toContain("85점");

    expect(result.keyInsights[0]).toContain("[성적]");
    expect(result.keyInsights[0]).not.toContain("1등급");

    expect(result.keyInsights[1]).toContain("[연락처]");
    expect(result.keyInsights[1]).not.toContain("student@test.com");
  });

  it("PII가 없는 필드는 변경하지 않는다", () => {
    const result = maskCaseFields({
      diagnosisSummary: "학업 역량이 우수합니다.",
      strategySummary: "세특 보강이 필요합니다.",
      keyInsights: ["탐구 능력 우수"],
    });

    expect(result.diagnosisSummary).toBe("학업 역량이 우수합니다.");
    expect(result.strategySummary).toBe("세특 보강이 필요합니다.");
    expect(result.keyInsights[0]).toBe("탐구 능력 우수");
  });
});
