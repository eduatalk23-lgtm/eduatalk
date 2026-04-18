// ============================================
// buildRecordSummaryForSeed 유닛 테스트 (Phase 3 Step 4)
//
// 대상: lib/domains/record-analysis/pipeline/bootstrap/build-record-summary.ts
// 핵심 시나리오:
//   1. k=0 (storyline 0 + tag 0) → null 반환
//   2. storyline 우선 — title + keywords 가 반영되고 tag 는 무시
//   3. storyline 0 but tag ≥ 1 → tag 빈도 상위 N fallback
//   4. subjectAreas 유니크 + 최대 10개
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRecordSummaryForSeed } from "../pipeline/bootstrap/build-record-summary";

interface MockTableData {
  [table: string]: Array<Record<string, unknown>>;
}

/**
 * Supabase chainable mock.
 *   from(table).select(...).eq(...).eq(...).is(...) 를 받아 테이블별 고정 데이터 반환.
 */
function mockSupabase(tables: MockTableData) {
  const from = vi.fn((table: string) => {
    const data = tables[table] ?? [];
    const chain: {
      select: (sel: string) => typeof chain;
      eq: (col: string, val: unknown) => typeof chain;
      is: (col: string, val: unknown) => typeof chain;
      then: (onFulfilled: (r: { data: typeof data; error: null }) => unknown) => Promise<unknown>;
    } = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      then: (onFulfilled) => Promise.resolve(onFulfilled({ data, error: null })),
    };
    return chain;
  });
  return { from } as unknown as Parameters<typeof buildRecordSummaryForSeed>[2];
}

describe("buildRecordSummaryForSeed", () => {
  const STUDENT_ID = "student-xrun-01";
  const TENANT_ID = "tenant-dev";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("k=0 (storyline 0 + tag 0) → null 반환", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [],
      student_record_activity_tags: [],
      student_record_seteks: [],
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result).toBeNull();
  });

  it("storyline 있으면 title + keywords 를 keywords 로 사용, tag 는 무시", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [
        { title: "파놉티콘과 감시사회", keywords: ["푸코", "디지털감시"] },
        { title: "베이지안 추론", keywords: ["확률", "조건부"] },
      ],
      student_record_activity_tags: [
        // 이 태그들은 사용되지 않아야 함 (storyline 우선)
        { competency_item: "academic_inquiry" },
        { competency_item: "academic_inquiry" },
        { competency_item: "academic_inquiry" },
      ],
      student_record_seteks: [],
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result).not.toBeNull();
    expect(result!.keywords).toContain("파놉티콘과 감시사회");
    expect(result!.keywords).toContain("푸코");
    expect(result!.keywords).toContain("베이지안 추론");
    expect(result!.keywords).toContain("확률");
    // academic_inquiry 는 tag 만 있고 storyline 이 있으므로 포함되지 않아야 함
    expect(result!.keywords).not.toContain("academic_inquiry");
  });

  it("storyline 0 but tag ≥ 1 → tag 빈도 상위 순으로 fallback", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [],
      student_record_activity_tags: [
        { competency_item: "academic_inquiry" },
        { competency_item: "academic_inquiry" },
        { competency_item: "academic_inquiry" },
        { competency_item: "analytical_thinking" },
        { competency_item: "analytical_thinking" },
        { competency_item: "self_direction" },
      ],
      student_record_seteks: [],
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result).not.toBeNull();
    // 빈도 내림차순: academic_inquiry(3) > analytical_thinking(2) > self_direction(1)
    expect(result!.keywords[0]).toBe("academic_inquiry");
    expect(result!.keywords[1]).toBe("analytical_thinking");
    expect(result!.keywords[2]).toBe("self_direction");
  });

  it("subjectAreas 는 유니크로 집계", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [],
      student_record_activity_tags: [{ competency_item: "academic_inquiry" }],
      student_record_seteks: [
        { subject: { name: "미적분" } },
        { subject: { name: "미적분" } }, // 중복
        { subject: { name: "물리학I" } },
        { subject: { name: "확률과통계" } },
      ],
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result).not.toBeNull();
    expect(result!.subjectAreas).toEqual(["미적분", "물리학I", "확률과통계"]);
  });

  it("subject.name 이 null 인 row 는 제외", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [],
      student_record_activity_tags: [{ competency_item: "x" }],
      student_record_seteks: [
        { subject: { name: "미적분" } },
        { subject: { name: null } },
        { subject: null },
      ],
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result!.subjectAreas).toEqual(["미적분"]);
  });

  it("keywords/subjectAreas 둘 다 비면 최종 null 가드", async () => {
    const supabase = mockSupabase({
      student_record_storylines: [
        // title/keywords 다 비어있음 — 결과적으로 keywords 배열 empty
        { title: null, keywords: null },
      ],
      student_record_activity_tags: [], // fallback 도 0
      student_record_seteks: [], // subject 도 0
    });
    const result = await buildRecordSummaryForSeed(STUDENT_ID, TENANT_ID, supabase);
    expect(result).toBeNull();
  });
});
