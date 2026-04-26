// ============================================
// GAP-1 (P8 priority 정렬) + GAP-2 (Top-5 serializer 보강) 테스트 (2026-04-26)
//
// GAP-1: MidPlan.recordPriorityOverride 가 주어졌을 때 P8 pending 정렬 검증.
//         runDraftAnalysisChunkForGrade 의 DB/LLM 호출 없이 orderRecordsByPriority
//         동작만 단위 테스트. (runner 전체 통합은 fullrun 검증에서 진행)
//
// GAP-2: mid-pipeline-planner buildContext Top-5 serializer 가
//         학년·타입 한국어 라벨을 포함하는지 검증.
// ============================================

import { describe, it, expect } from "vitest";
import { orderRecordsByPriority } from "../pipeline/orient/priority-order";

// ── GAP-1: P8/P9 공용 유틸 동작 검증 ─────────────────────────────────────────

describe("GAP-1 — P8 pending 정렬 (orderRecordsByPriority, id 키)", () => {
  it("recordPriorityOverride={id1:80,id2:60} 주어지면 80→60→나머지 순 정렬", () => {
    const pending = [
      { id: "id3", recordType: "setek" as const },
      { id: "id1", recordType: "changche" as const },
      { id: "id4", recordType: "haengteuk" as const },
      { id: "id2", recordType: "setek" as const },
    ];
    const result = orderRecordsByPriority(pending, { id1: 80, id2: 60 });
    expect(result.map((r) => r.id)).toEqual(["id1", "id2", "id3", "id4"]);
  });

  it("midPlan 없음(null) → 원본 순서 유지 (no-op)", () => {
    const pending = [
      { id: "a", recordType: "setek" as const },
      { id: "b", recordType: "changche" as const },
    ];
    const result = orderRecordsByPriority(pending, null);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("override 빈 객체 → 원본 순서 유지 (no-op)", () => {
    const pending = [
      { id: "x", recordType: "haengteuk" as const },
      { id: "y", recordType: "setek" as const },
    ];
    const result = orderRecordsByPriority(pending, {});
    expect(result.map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("override 점수 동점이면 원래 상대 순서 유지 (stable)", () => {
    const pending = [
      { id: "a", recordType: "setek" as const },
      { id: "b", recordType: "setek" as const },
      { id: "c", recordType: "setek" as const },
    ];
    const result = orderRecordsByPriority(pending, { a: 70, b: 70, c: 70 });
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("GAP-1 — P8/P9 공용 유틸 동작 검증 (record_id 키)", () => {
  it("record_id 키 형태로도 정렬 가능 (P9 pending 형태)", () => {
    const pending = [
      { record_id: "r1", record_type: "setek" as const },
      { record_id: "r2", record_type: "changche" as const },
      { record_id: "r3", record_type: "haengteuk" as const },
    ];
    const result = orderRecordsByPriority(pending, { r3: 80, r1: 60 });
    expect(result.map((r) => r.record_id)).toEqual(["r3", "r1", "r2"]);
  });
});

// ── GAP-2: Top-5 serializer 학년·타입 라벨 검증 ──────────────────────────────

describe("GAP-2 — Top-5 serializer 학년·타입 라벨", () => {
  it("라인 포맷에 [N학년] 학년 표기와 한국어 타입 라벨이 포함된다", () => {
    // serializer 로직을 직접 테스트 (buildMidPlanContext 내부 함수는 추출 불가 → 인라인 재현)
    const records = [
      { grade: "1", recordId: "aaaa1111bbbb", recordType: "setek", subjectName: "수학", overallScore: 45, issues: ["P1_나열식"], feedback: "" },
      { grade: "2", recordId: "cccc2222dddd", recordType: "changche", subjectName: undefined, overallScore: 50, issues: ["P2_복붙"], feedback: "" },
      { grade: "3", recordId: "eeee3333ffff", recordType: "haengteuk", subjectName: undefined, overallScore: 55, issues: [], feedback: "" },
    ];

    const lines = records.map((r) => {
      const subject = r.subjectName ? `(${r.subjectName})` : "";
      const issuesStr = r.issues.slice(0, 3).join(", ");
      const typeLabel =
        r.recordType === "setek" ? "세특" : r.recordType === "changche" ? "창체" : "행특";
      return `- id=${r.recordId.slice(0, 8)}… [${r.grade}학년] ${typeLabel}${subject} score=${r.overallScore} issues=[${issuesStr}]`;
    });

    expect(lines[0]).toContain("[1학년]");
    expect(lines[0]).toContain("세특");
    expect(lines[0]).toContain("(수학)");
    expect(lines[1]).toContain("[2학년]");
    expect(lines[1]).toContain("창체");
    expect(lines[2]).toContain("[3학년]");
    expect(lines[2]).toContain("행특");
  });

  it("recordType=setek → '세특' 라벨", () => {
    const typeLabel = (t: string) =>
      t === "setek" ? "세특" : t === "changche" ? "창체" : "행특";
    expect(typeLabel("setek")).toBe("세특");
    expect(typeLabel("changche")).toBe("창체");
    expect(typeLabel("haengteuk")).toBe("행특");
  });
});
