// ============================================
// α6 Reflection 집계 — summarizeReflection 단위 테스트 (2026-04-20)
//
// 검증:
//   - failed/running 은 집계에서 제외
//   - 같은 version+engine 그룹핑
//   - 수락률 = (accepted+executed)/itemCount
//   - 실행률 = roadmap executed_at 있는 수락 / 수락 전체
//   - 빈 입력 안전
// ============================================

import { describe, it, expect } from "vitest";
import {
  summarizeReflection,
  type ReflectionInputRow,
} from "../state/proposal-reflection";

const baseRow: ReflectionInputRow = {
  jobId: "j1",
  engine: "llm_v1",
  promptVersion: "v1",
  status: "completed",
  severity: "medium",
  items: [
    {
      id: "i1",
      studentDecision: "accepted",
      roadmapItemId: "r1",
      roadmapExecuted: true,
    },
    {
      id: "i2",
      studentDecision: "accepted",
      roadmapItemId: "r2",
      roadmapExecuted: false,
    },
    {
      id: "i3",
      studentDecision: "rejected",
      roadmapItemId: null,
      roadmapExecuted: false,
    },
    {
      id: "i4",
      studentDecision: "pending",
      roadmapItemId: null,
      roadmapExecuted: false,
    },
  ],
};

describe("summarizeReflection", () => {
  it("빈 입력 → 0 집계", () => {
    const s = summarizeReflection([]);
    expect(s.totalJobs).toBe(0);
    expect(s.totalItems).toBe(0);
    expect(s.byVersion).toHaveLength(0);
  });

  it("completed 단일 row — 수락률/실행률 계산", () => {
    const s = summarizeReflection([baseRow]);
    expect(s.totalJobs).toBe(1);
    expect(s.totalItems).toBe(4);
    expect(s.byVersion).toHaveLength(1);

    const v = s.byVersion[0];
    expect(v.promptVersion).toBe("v1");
    expect(v.engine).toBe("llm_v1");
    expect(v.itemCount).toBe(4);
    expect(v.accepted).toBe(2);
    expect(v.rejected).toBe(1);
    expect(v.pending).toBe(1);
    // 수락률 = 2/4
    expect(v.acceptanceRate).toBeCloseTo(0.5);
    // 로드맵 매핑률 = 2/4
    expect(v.roadmapLinkRate).toBeCloseTo(0.5);
    // 실행률 = 1 실행 / 2 수락 = 0.5
    expect(v.executionRate).toBeCloseTo(0.5);
  });

  it("failed/running job 은 제외", () => {
    const rows: ReflectionInputRow[] = [
      { ...baseRow, jobId: "jfail", status: "failed" },
      { ...baseRow, jobId: "jrun", status: "running" },
      baseRow,
    ];
    const s = summarizeReflection(rows);
    expect(s.totalJobs).toBe(1);
    expect(s.byVersion[0].jobCount).toBe(1);
    expect(s.byVersion[0].itemCount).toBe(4);
  });

  it("버전+엔진 그룹핑", () => {
    const rows: ReflectionInputRow[] = [
      { ...baseRow, jobId: "j1", promptVersion: "v1", engine: "llm_v1" },
      { ...baseRow, jobId: "j2", promptVersion: "v1", engine: "llm_v1" },
      { ...baseRow, jobId: "j3", promptVersion: "v2", engine: "llm_v1" },
      { ...baseRow, jobId: "j4", promptVersion: "v1", engine: "rule_v1" },
    ];
    const s = summarizeReflection(rows);
    expect(s.byVersion).toHaveLength(3);
    const llmV1 = s.byVersion.find(
      (v) => v.engine === "llm_v1" && v.promptVersion === "v1",
    );
    expect(llmV1?.jobCount).toBe(2);
    expect(llmV1?.itemCount).toBe(8);
  });

  it("수락된 item 없으면 executionRate=0", () => {
    const row: ReflectionInputRow = {
      ...baseRow,
      items: [
        {
          id: "i1",
          studentDecision: "rejected",
          roadmapItemId: null,
          roadmapExecuted: false,
        },
        {
          id: "i2",
          studentDecision: "pending",
          roadmapItemId: null,
          roadmapExecuted: false,
        },
      ],
    };
    const s = summarizeReflection([row]);
    expect(s.byVersion[0].acceptanceRate).toBe(0);
    expect(s.byVersion[0].executionRate).toBe(0);
  });

  it("executed 결정은 수락 쪽으로 합산", () => {
    const row: ReflectionInputRow = {
      ...baseRow,
      items: [
        {
          id: "i1",
          studentDecision: "executed",
          roadmapItemId: "r1",
          roadmapExecuted: true,
        },
        {
          id: "i2",
          studentDecision: "accepted",
          roadmapItemId: "r2",
          roadmapExecuted: true,
        },
      ],
    };
    const s = summarizeReflection([row]);
    expect(s.byVersion[0].accepted).toBe(1);
    expect(s.byVersion[0].executed).toBe(1);
    expect(s.byVersion[0].acceptanceRate).toBe(1);
    expect(s.byVersion[0].executionRate).toBe(1); // 2/2
  });

  it("itemCount 0 방어 — 빈 items", () => {
    const row: ReflectionInputRow = { ...baseRow, items: [] };
    const s = summarizeReflection([row]);
    expect(s.byVersion[0].acceptanceRate).toBe(0);
    expect(s.byVersion[0].executionRate).toBe(0);
    expect(s.byVersion[0].roadmapLinkRate).toBe(0);
  });

  it("itemCount 내림차순 정렬", () => {
    const rows: ReflectionInputRow[] = [
      { ...baseRow, jobId: "small", promptVersion: "v-small", items: baseRow.items.slice(0, 1) },
      { ...baseRow, jobId: "big", promptVersion: "v-big" },
    ];
    const s = summarizeReflection(rows);
    expect(s.byVersion[0].promptVersion).toBe("v-big");
    expect(s.byVersion[1].promptVersion).toBe("v-small");
  });
});
