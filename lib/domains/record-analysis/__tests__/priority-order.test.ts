// ============================================
// β+1 priority-order 단위 테스트 (2026-04-24)
// ============================================

import { describe, it, expect } from "vitest";
import {
  orderRecordsByPriority,
  PRIORITY_ORDER_DEFAULT,
} from "../pipeline/orient/priority-order";

describe("orderRecordsByPriority", () => {
  it("priority 가 null 이면 원본 순서 유지", () => {
    const input = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = orderRecordsByPriority(input, null);
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(input);
  });

  it("priority 가 빈 객체면 원본 순서 유지", () => {
    const input = [{ id: "a" }, { id: "b" }];
    const out = orderRecordsByPriority(input, {});
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("일부 레코드만 override — 지정된 레코드 앞으로, 미지정은 중간값(50)·원순서", () => {
    const input = [
      { id: "a" }, // default 50
      { id: "b", kind: "seteks" }, // 70
      { id: "c" }, // default 50
      { id: "d", kind: "seteks" }, // 30
    ];
    const out = orderRecordsByPriority(input, { b: 70, d: 30 });
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("전부 override — 점수 내림차순", () => {
    const input = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = orderRecordsByPriority(input, { a: 30, b: 90, c: 60 });
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("동점이면 원래 상대 순서 유지 (stable)", () => {
    const input = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = orderRecordsByPriority(input, { a: 70, b: 70, c: 70 });
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("빈 배열", () => {
    const out = orderRecordsByPriority([] as Array<{ id: string }>, { x: 99 });
    expect(out).toEqual([]);
  });

  it("record_id 키 형태 지원 (P9 pending)", () => {
    const input = [
      { record_id: "r1", record_type: "setek" as const },
      { record_id: "r2", record_type: "setek" as const },
      { record_id: "r3", record_type: "setek" as const },
    ];
    const out = orderRecordsByPriority(input, { r3: 80 });
    expect(out.map((r) => r.record_id)).toEqual(["r3", "r1", "r2"]);
  });

  it("PRIORITY_ORDER_DEFAULT 기준으로 지정 레코드가 상위/하위로 분리된다", () => {
    expect(PRIORITY_ORDER_DEFAULT).toBe(50);
    const input = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = orderRecordsByPriority(input, { b: 80, c: 20 });
    // a 는 default(50), b=80 위, c=20 아래
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});
