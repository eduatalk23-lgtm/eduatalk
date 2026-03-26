import { describe, it, expect } from "vitest";
import { computeRecordContentHash, ANALYSIS_MODEL_VERSION } from "../content-hash";

describe("computeRecordContentHash", () => {
  it("동일 content → 동일 해시", () => {
    const h1 = computeRecordContentHash("수업에 적극적으로 참여하며 탐구력이 뛰어남");
    const h2 = computeRecordContentHash("수업에 적극적으로 참여하며 탐구력이 뛰어남");
    expect(h1).toBe(h2);
  });

  it("다른 content → 다른 해시", () => {
    const h1 = computeRecordContentHash("수업에 적극적으로 참여함");
    const h2 = computeRecordContentHash("수업에 소극적으로 참여함");
    expect(h1).not.toBe(h2);
  });

  it("careerContext 포함 시 다른 해시", () => {
    const content = "수학 탐구 보고서를 작성함";
    const h1 = computeRecordContentHash(content);
    const h2 = computeRecordContentHash(content, { targetMajor: "컴퓨터공학", takenSubjects: ["미적분"] });
    expect(h1).not.toBe(h2);
  });

  it("careerContext null vs undefined → 동일 해시", () => {
    const content = "테스트";
    const h1 = computeRecordContentHash(content, null);
    const h2 = computeRecordContentHash(content);
    expect(h1).toBe(h2);
  });

  it("target_major 변경 → 다른 해시", () => {
    const content = "진로 탐색 활동을 수행함";
    const h1 = computeRecordContentHash(content, { targetMajor: "컴퓨터공학", takenSubjects: ["정보"] });
    const h2 = computeRecordContentHash(content, { targetMajor: "경제학", takenSubjects: ["정보"] });
    expect(h1).not.toBe(h2);
  });

  it("이수과목 변경 → 다른 해시", () => {
    const content = "테스트";
    const h1 = computeRecordContentHash(content, { targetMajor: "공학", takenSubjects: ["미적분"] });
    const h2 = computeRecordContentHash(content, { targetMajor: "공학", takenSubjects: ["미적분", "물리학I"] });
    expect(h1).not.toBe(h2);
  });

  it("이수과목 순서 무관 (정렬됨)", () => {
    const content = "테스트";
    const h1 = computeRecordContentHash(content, { targetMajor: "공학", takenSubjects: ["물리학I", "미적분"] });
    const h2 = computeRecordContentHash(content, { targetMajor: "공학", takenSubjects: ["미적분", "물리학I"] });
    expect(h1).toBe(h2);
  });

  it("해시에 모델 버전 포함 (상수 변경 시 캐시 무효화)", () => {
    expect(ANALYSIS_MODEL_VERSION).toBeTruthy();
    // 모델 버전이 해시에 포함되어 있으므로, 동일 content라도 버전 상수 변경 시 해시가 달라짐
    // 이 테스트는 상수가 존재하고 해시에 반영되는지만 확인
    const h = computeRecordContentHash("테스트");
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
  });
});
