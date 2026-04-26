import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startPhaseDeadline,
  enforcePhaseDeadline,
  PHASE_BUDGET_MS,
} from "../pipeline/pipeline-route-helpers";

describe("Phase deadline guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("startPhaseDeadline — 기본 예산 270s", () => {
    const state = startPhaseDeadline("test");
    expect(state.budgetMs).toBe(PHASE_BUDGET_MS);
    expect(state.phaseLabel).toBe("test");
  });

  it("진입 직후 — 충분한 잔여 예산, true 반환", () => {
    const state = startPhaseDeadline("test");
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(true);
  });

  it("100s 경과 — 잔여 170s, 안전 마진 충분, true", () => {
    const state = startPhaseDeadline("test");
    vi.advanceTimersByTime(100_000);
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(true);
  });

  it("250s 경과 — 잔여 20s < 안전 마진 30s, false", () => {
    const state = startPhaseDeadline("test");
    vi.advanceTimersByTime(250_000);
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(false);
  });

  it("300s 초과 — 잔여 음수, false", () => {
    const state = startPhaseDeadline("test");
    vi.advanceTimersByTime(310_000);
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(false);
  });

  it("커스텀 예산 — 60s 부여 시 40s 경과는 통과", () => {
    const state = startPhaseDeadline("short", 60_000);
    vi.advanceTimersByTime(20_000);
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(true);
  });

  it("커스텀 예산 — 60s 부여 시 35s 경과는 차단 (잔여 25s < 30s)", () => {
    const state = startPhaseDeadline("short", 60_000);
    vi.advanceTimersByTime(35_000);
    expect(enforcePhaseDeadline(state, "task_a", "pipe-1")).toBe(false);
  });
});
