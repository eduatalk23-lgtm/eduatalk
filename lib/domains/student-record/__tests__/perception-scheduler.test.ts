// ============================================
// runPerceptionTrigger — α4 배선 단위 테스트 (2026-04-20 C)
//
// 시나리오:
//   1. 0개 snapshot → skipped reason=no_prior_snapshot
//   2. 1개 snapshot → skipped reason=no_prior_snapshot
//   3. 2개 snapshot + 변화 없음 → evaluated, triggered=false, severity=none
//   4. 2개 snapshot + hakjongDelta=+5 → evaluated, triggered=true, severity=high
//   5. 2개 snapshot + competency 2축 변화 → evaluated, triggered=true, severity=medium
//   6. repository throw → skipped reason=error
//   7. snaps 순서 (snaps[0]=최신, snaps[1]=직전) 정확히 from/to 매핑
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StudentState,
  CompetencyAxisState,
  StudentStateMetadata,
  HakjongScore,
} from "../types/student-state";
import type { PersistedStudentStateSnapshot } from "../repository/student-state-repository";
import type { Json } from "@/lib/supabase/database.types";

vi.mock("../repository/student-state-repository", () => ({
  findTopNSnapshots: vi.fn(),
  findRecentMetricEvents: vi.fn(),
}));

import {
  findTopNSnapshots,
  findRecentMetricEvents,
} from "../repository/student-state-repository";
import { runPerceptionTrigger } from "../actions/perception-scheduler";

const findTopNSnapshotsMock = vi.mocked(findTopNSnapshots);
const findRecentMetricEventsMock = vi.mocked(findRecentMetricEvents);

// ─── 헬퍼 ────────────────────────────────────────────────

function makeMetadata(): StudentStateMetadata {
  return {
    snapshotId: null,
    completenessRatio: 0,
    layer0Present: false,
    layer1Present: false,
    layer2Present: false,
    layer3Present: false,
    auxVolunteerPresent: false,
    auxAwardsPresent: false,
    auxAttendancePresent: false,
    auxReadingPresent: false,
    areaCompleteness: { academic: 0, career: 0, community: 0 },
    hakjongScoreComputable: {
      academic: false,
      career: false,
      community: false,
      total: false,
    },
    blueprintPresent: false,
    staleness: { hasStaleLayer: false, staleReasons: [] },
  };
}

function makeHakjongScore(total: number): HakjongScore {
  return {
    academic: total,
    career: total,
    community: total,
    total,
    computedAt: "2026-04-20T00:00:00Z",
    version: "v1_rule",
    confidence: { academic: 1, career: 1, community: 1, total: 1 },
  };
}

function makeState(opts: {
  grade: 1 | 2 | 3;
  semester: 1 | 2;
  builtAt: string;
  axes?: CompetencyAxisState[];
  hakjongScore?: HakjongScore | null;
}): StudentState {
  return {
    studentId: "s-1",
    tenantId: "t-1",
    asOf: {
      schoolYear: 2026,
      grade: opts.grade,
      semester: opts.semester,
      label: `2026 ${opts.grade}-${opts.semester}`,
      builtAt: opts.builtAt,
    },
    profileCard: null,
    competencies:
      opts.axes && opts.axes.length > 0
        ? {
            axes: opts.axes,
            analysisQuality: {
              specificity: null, coherence: null, depth: null, grammar: null,
              scientificValidity: null, overallScore: null, sampleSize: 0, source: "ai",
            },
            projectedQuality: {
              specificity: null, coherence: null, depth: null, grammar: null,
              scientificValidity: null, overallScore: null, sampleSize: 0, source: "ai_projected",
            },
          }
        : null,
    hyperedges: [],
    narrativeArc: [],
    trajectory: [],
    aux: { volunteer: null, awards: null, attendance: null, reading: null },
    hakjongScore: opts.hakjongScore ?? null,
    hakjongScoreV2Pre: null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: null,
    metadata: makeMetadata(),
  };
}

function makeSnapshot(state: StudentState): PersistedStudentStateSnapshot {
  return {
    id: `snap-${state.asOf.builtAt}`,
    tenant_id: state.tenantId,
    student_id: state.studentId,
    school_year: state.asOf.schoolYear,
    target_grade: state.asOf.grade,
    target_semester: state.asOf.semester,
    as_of_label: state.asOf.label,
    hakjong_total: state.hakjongScore?.total ?? null,
    completeness_ratio: 0,
    layer_flags: 0,
    hakjong_computable: false,
    has_stale_layer: false,
    snapshot_data: state as unknown as Json,
    builder_version: "v1",
    built_at: state.asOf.builtAt,
    created_at: state.asOf.builtAt,
    updated_at: state.asOf.builtAt,
  };
}

// ============================================
// 테스트
// ============================================

describe("runPerceptionTrigger — snapshot 부재", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본: metric_events fallback 도 비움 → 진짜 skipped 경로 검증
    findRecentMetricEventsMock.mockResolvedValue([]);
  });

  it("0개 snapshot + 0 metric_events → skipped no_prior_snapshot", async () => {
    findTopNSnapshotsMock.mockResolvedValueOnce([]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("no_prior_snapshot");
  });

  it("1개 snapshot + 0 metric_events → skipped no_prior_snapshot", async () => {
    const state = makeState({ grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z" });
    findTopNSnapshotsMock.mockResolvedValueOnce([makeSnapshot(state)]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("no_prior_snapshot");
  });
});

describe("runPerceptionTrigger — 변화 없음", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRecentMetricEventsMock.mockResolvedValue([]);
  });

  it("두 snapshot 동일 → evaluated, triggered=false, severity=none", async () => {
    const state = makeState({ grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z" });
    const prev = makeState({ grade: 1, semester: 2, builtAt: "2025-12-01T00:00:00Z" });
    findTopNSnapshotsMock.mockResolvedValueOnce([
      makeSnapshot(state),
      makeSnapshot(prev),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.triggered).toBe(false);
      expect(result.severity).toBe("none");
    }
  });
});

describe("runPerceptionTrigger — 변화 감지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRecentMetricEventsMock.mockResolvedValue([]);
  });

  it("hakjongDelta=+5 → triggered=true, severity=high", async () => {
    const prev = makeState({
      grade: 1, semester: 2, builtAt: "2025-12-01T00:00:00Z",
      hakjongScore: makeHakjongScore(70),
    });
    const latest = makeState({
      grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z",
      hakjongScore: makeHakjongScore(75),
    });
    findTopNSnapshotsMock.mockResolvedValueOnce([
      makeSnapshot(latest),
      makeSnapshot(prev),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.triggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.diff.hakjongScoreDelta).toBe(5);
      expect(result.reasons.some((r) => r.includes("학종 Reward"))).toBe(true);
    }
  });

  it("competency 2축 변화 → triggered=true, severity=medium", async () => {
    const prev = makeState({
      grade: 1, semester: 2, builtAt: "2025-12-01T00:00:00Z",
      axes: [
        { code: "academic_inquiry", area: "academic", grade: "B", source: "ai", narrative: null, supportingRecordIds: [] },
        { code: "career_exploration", area: "career", grade: "B", source: "ai", narrative: null, supportingRecordIds: [] },
      ],
    });
    const latest = makeState({
      grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z",
      axes: [
        { code: "academic_inquiry", area: "academic", grade: "A-", source: "ai", narrative: null, supportingRecordIds: [] },
        { code: "career_exploration", area: "career", grade: "A-", source: "ai", narrative: null, supportingRecordIds: [] },
      ],
    });
    findTopNSnapshotsMock.mockResolvedValueOnce([
      makeSnapshot(latest),
      makeSnapshot(prev),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.triggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.diff.competencyChanges).toHaveLength(2);
    }
  });

  it("snaps 순서 — snaps[0]=최신이 to, snaps[1]=직전이 from", async () => {
    const prev = makeState({
      grade: 1, semester: 2, builtAt: "2025-12-01T00:00:00Z",
    });
    const latest = makeState({
      grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z",
    });
    findTopNSnapshotsMock.mockResolvedValueOnce([
      makeSnapshot(latest),
      makeSnapshot(prev),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.diff.from.builtAt).toBe("2025-12-01T00:00:00Z");
      expect(result.diff.to.builtAt).toBe("2026-04-20T00:00:00Z");
    }
  });
});

describe("runPerceptionTrigger — 에러", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRecentMetricEventsMock.mockResolvedValue([]);
  });

  it("repository throw → skipped reason=error", async () => {
    findTopNSnapshotsMock.mockRejectedValueOnce(new Error("db timeout"));
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("error");
      expect(result.error).toContain("db timeout");
    }
  });
});

// ============================================
// metric_events fallback 경로
// ============================================

function makeMetricEvent(opts: {
  capturedAt: string;
  hakjongTotal: number | null;
  grade: 1 | 2 | 3;
  semester: 1 | 2;
}) {
  return {
    id: `evt-${opts.capturedAt}`,
    tenant_id: "t-1",
    student_id: "s-1",
    snapshot_id: null,
    school_year: 2026,
    target_grade: opts.grade,
    target_semester: opts.semester,
    hakjong_total: opts.hakjongTotal,
    hakjong_academic: null,
    hakjong_career: null,
    hakjong_community: null,
    completeness_ratio: 0,
    area_completeness_academic: null,
    area_completeness_career: null,
    area_completeness_community: null,
    trigger_source: "manual",
    captured_at: opts.capturedAt,
    created_at: opts.capturedAt,
  };
}

describe("runPerceptionTrigger — metric_events fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("snapshot 0 + metric_events 2 (hakjong +5) → evaluated, source=metric_events, severity=high", async () => {
    findTopNSnapshotsMock.mockResolvedValueOnce([]);
    findRecentMetricEventsMock.mockResolvedValueOnce([
      makeMetricEvent({ capturedAt: "2026-04-20T00:00:00Z", hakjongTotal: 75, grade: 2, semester: 1 }),
      makeMetricEvent({ capturedAt: "2026-04-19T00:00:00Z", hakjongTotal: 70, grade: 2, semester: 1 }),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.source).toBe("metric_events");
      expect(result.triggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.diff.hakjongScoreDelta).toBe(5);
      // fallback 은 competency/newRecords/aux 모두 빈 값
      expect(result.diff.competencyChanges).toEqual([]);
      expect(result.diff.newRecordIds).toEqual([]);
    }
  });

  it("snapshot 1 + metric_events 2 → fallback 경로 진입", async () => {
    const state = makeState({ grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z" });
    findTopNSnapshotsMock.mockResolvedValueOnce([makeSnapshot(state)]);
    findRecentMetricEventsMock.mockResolvedValueOnce([
      makeMetricEvent({ capturedAt: "2026-04-20T00:00:00Z", hakjongTotal: 72, grade: 2, semester: 1 }),
      makeMetricEvent({ capturedAt: "2026-04-19T00:00:00Z", hakjongTotal: 70, grade: 2, semester: 1 }),
    ]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.source).toBe("metric_events");
      expect(result.severity).toBe("medium"); // |delta|=2
    }
  });

  it("snapshot 2 → fallback 미사용, source=snapshot", async () => {
    const prev = makeState({ grade: 1, semester: 2, builtAt: "2025-12-01T00:00:00Z", hakjongScore: makeHakjongScore(70) });
    const latest = makeState({ grade: 2, semester: 1, builtAt: "2026-04-20T00:00:00Z", hakjongScore: makeHakjongScore(75) });
    findTopNSnapshotsMock.mockResolvedValueOnce([makeSnapshot(latest), makeSnapshot(prev)]);
    // fallback 이 호출되어도 결과에 영향 없어야 함 — 실제로는 호출 안 되어야 함
    findRecentMetricEventsMock.mockResolvedValue([]);
    const result = await runPerceptionTrigger("s-1", "t-1");
    expect(result.status).toBe("evaluated");
    if (result.status === "evaluated") {
      expect(result.source).toBe("snapshot");
    }
    expect(findRecentMetricEventsMock).not.toHaveBeenCalled();
  });
});
