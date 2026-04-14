// ============================================
// narrative-arc-repository.ts 유닛 테스트
//
// 대상:
//   upsertNarrativeArc          — 카멜→스네이크 매핑 + stage_details JSONB 구성
//   loadAnalyzedRecordKeys      — record_type:record_id Set 구성
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  upsertNarrativeArc,
  loadAnalyzedRecordKeys,
} from "../repository/narrative-arc-repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertNarrativeArc — 매핑 검증", () => {
  it("8 카멜 키 → 스네이크 컬럼 + stage_details 구성", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    // upsert().select().single() 체인
    const selectSingle = { single: vi.fn(() => Promise.resolve({ data: {}, error: null })) };
    const upsertFn = vi.fn((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return { select: vi.fn(() => selectSingle) };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {
      from: vi.fn(() => ({ upsert: upsertFn })),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    const stage = (p: boolean, c: number, e: string) => ({
      present: p,
      confidence: c,
      evidence: e,
    });

    await upsertNarrativeArc("student-1", "tenant-1", {
      recordType: "setek",
      recordId: "rec-1",
      schoolYear: 2025,
      grade: 2,
      result: {
        curiosity: stage(true, 0.9, "근거1"),
        topicSelection: stage(true, 0.85, "근거2"),
        inquiryContent: stage(false, 0.4, ""),
        references: stage(false, 0.9, ""),
        conclusion: stage(true, 0.7, "근거5"),
        teacherObservation: stage(true, 0.8, "근거6"),
        growthNarrative: stage(false, 0.5, ""),
        reinquiry: stage(false, 0.5, ""),
      },
      source: "ai",
      modelName: "gemini-2.5-flash",
    });

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!.tenant_id).toBe("tenant-1");
    expect(capturedPayload!.student_id).toBe("student-1");
    expect(capturedPayload!.record_type).toBe("setek");
    expect(capturedPayload!.record_id).toBe("rec-1");
    expect(capturedPayload!.school_year).toBe(2025);
    expect(capturedPayload!.grade).toBe(2);

    // 8 BOOLEAN 컬럼 매핑
    expect(capturedPayload!.curiosity_present).toBe(true);
    expect(capturedPayload!.topic_selection_present).toBe(true);
    expect(capturedPayload!.inquiry_content_present).toBe(false);
    expect(capturedPayload!.references_present).toBe(false);
    expect(capturedPayload!.conclusion_present).toBe(true);
    expect(capturedPayload!.teacher_observation_present).toBe(true);
    expect(capturedPayload!.growth_narrative_present).toBe(false);
    expect(capturedPayload!.reinquiry_present).toBe(false);

    // stage_details JSONB
    const details = capturedPayload!.stage_details as Record<
      string,
      { confidence: number; evidence: string }
    >;
    expect(details.curiosity).toEqual({ confidence: 0.9, evidence: "근거1" });
    expect(details.conclusion).toEqual({ confidence: 0.7, evidence: "근거5" });
    expect(details.references).toEqual({ confidence: 0.9, evidence: "" });

    // 메타
    expect(capturedPayload!.source).toBe("ai");
    expect(capturedPayload!.model_name).toBe("gemini-2.5-flash");
    expect(capturedPayload!.pipeline_id).toBeNull();
  });

  it("onConflict 키 — tenant+student+record+source", async () => {
    let capturedOptions: Record<string, unknown> | null = null;

    const selectSingle = { single: vi.fn(() => Promise.resolve({ data: {}, error: null })) };
    const upsertFn = vi.fn((_payload: unknown, options: Record<string, unknown>) => {
      capturedOptions = options;
      return { select: vi.fn(() => selectSingle) };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = { from: vi.fn(() => ({ upsert: upsertFn })) };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    const empty = { present: false, confidence: 0, evidence: "" };
    await upsertNarrativeArc("s", "t", {
      recordType: "setek",
      recordId: "r",
      schoolYear: 2025,
      grade: 1,
      result: {
        curiosity: empty,
        topicSelection: empty,
        inquiryContent: empty,
        references: empty,
        conclusion: empty,
        teacherObservation: empty,
        growthNarrative: empty,
        reinquiry: empty,
      },
    });

    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions!.onConflict).toBe(
      "tenant_id,student_id,record_type,record_id,source",
    );
  });
});

describe("loadAnalyzedRecordKeys", () => {
  it("DB 행 → record_type:record_id Set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      then: (fn: (v: unknown) => unknown) =>
        Promise.resolve(
          fn({
            data: [
              { record_type: "setek", record_id: "r1" },
              { record_type: "setek", record_id: "r2" },
              { record_type: "changche", record_id: "r3" },
            ],
            error: null,
          }),
        ),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = { from: vi.fn(() => chain) };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    const keys = await loadAnalyzedRecordKeys("s", "t");
    expect(keys.size).toBe(3);
    expect(keys.has("setek:r1")).toBe(true);
    expect(keys.has("setek:r2")).toBe(true);
    expect(keys.has("changche:r3")).toBe(true);
    expect(keys.has("setek:r3")).toBe(false);
  });

  it("빈 결과 → 빈 Set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      then: (fn: (v: unknown) => unknown) =>
        Promise.resolve(fn({ data: [], error: null })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = { from: vi.fn(() => chain) };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    const keys = await loadAnalyzedRecordKeys("s", "t");
    expect(keys.size).toBe(0);
  });
});
