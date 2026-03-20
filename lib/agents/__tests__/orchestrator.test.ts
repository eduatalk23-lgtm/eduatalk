// ============================================
// 오케스트레이터 테스트
// createOrchestrator + 도구 등록 검증
// ============================================

import { describe, it, expect, vi } from "vitest";

// Mock server-only modules
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/domains/guide/repository", () => ({
  findGuideById: vi.fn(),
  findAssignmentsWithGuides: vi.fn(),
}));
vi.mock("@/lib/domains/guide/vector/search-service", () => ({
  searchGuidesByVector: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/service", () => ({
  getRecordTabData: vi.fn(),
  getStorylineTabData: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/competency-repository", () => ({
  findCompetencyScores: vi.fn(),
  findActivityTags: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/diagnosis-repository", () => ({
  findDiagnosisPair: vi.fn(),
  findDiagnosis: vi.fn(),
  findStrategies: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/repository", () => ({
  findStorylinesByStudent: vi.fn(),
}));
vi.mock("@/lib/domains/plan/llm/ai-sdk", () => ({
  generateTextWithRateLimit: vi.fn(),
}));
vi.mock("@/lib/domains/plan/llm/providers/gemini", () => ({
  geminiRateLimiter: { execute: vi.fn() },
  geminiQuotaTracker: { recordRequest: vi.fn() },
}));
// Admission mocks (Agent 3)
vi.mock("@/lib/domains/admission/repository", () => ({
  searchAdmissions: vi.fn(),
  getScoreConfig: vi.fn(),
  getRestrictions: vi.fn(),
}));
vi.mock("@/lib/domains/admission/placement/service", () => ({
  analyzePlacement: vi.fn(),
}));
vi.mock("@/lib/domains/admission/placement/engine", () => ({
  filterVerdicts: vi.fn(),
}));
vi.mock("@/lib/domains/admission/placement/score-converter", () => ({
  convertToSuneungScores: vi.fn(),
}));
vi.mock("@/lib/domains/admission/allocation/engine", () => ({
  simulateAllocation: vi.fn(),
}));

import { createOrchestrator } from "../orchestrator";
import type { AgentContext } from "../types";

const mockContext: AgentContext = {
  userId: "test-user-id",
  role: "admin",
  tenantId: "test-tenant-id",
  studentId: "test-student-id",
  studentName: "홍길동",
  schoolYear: 2026,
};

describe("createOrchestrator", () => {
  it("도구와 시스템 프롬프트를 반환한다", () => {
    const { tools, systemPrompt } = createOrchestrator(mockContext);

    expect(tools).toBeDefined();
    expect(systemPrompt).toBeDefined();
    expect(typeof systemPrompt).toBe("string");
  });

  it("시스템 프롬프트에 학생 이름이 포함된다", () => {
    const { systemPrompt } = createOrchestrator(mockContext);
    expect(systemPrompt).toContain("홍길동");
  });

  it("시스템 프롬프트에 학년도가 포함된다", () => {
    const { systemPrompt } = createOrchestrator(mockContext);
    expect(systemPrompt).toContain("2026");
  });

  it("데이터 도구 3개가 등록된다", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(tools.getStudentRecords).toBeDefined();
    expect(tools.getStudentDiagnosis).toBeDefined();
    expect(tools.getStudentStorylines).toBeDefined();
  });

  it("분석 도구 5개가 등록된다 (Agent 1)", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(tools.suggestTags).toBeDefined();
    expect(tools.analyzeCompetency).toBeDefined();
    expect(tools.analyzeHighlight).toBeDefined();
    expect(tools.detectStoryline).toBeDefined();
    expect(tools.generateDiagnosis).toBeDefined();
  });

  it("전략 도구 2개가 등록된다 (Agent 4)", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(tools.suggestStrategies).toBeDefined();
    expect(tools.getWarnings).toBeDefined();
  });

  it("가이드 도구 3개가 등록된다 (Agent 2)", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(tools.searchGuides).toBeDefined();
    expect(tools.getGuideDetail).toBeDefined();
    expect(tools.getStudentAssignments).toBeDefined();
  });

  it("입시 배치 도구 6개가 등록된다 (Agent 3)", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(tools.searchAdmissionData).toBeDefined();
    expect(tools.getUniversityScoreInfo).toBeDefined();
    expect(tools.runPlacementAnalysis).toBeDefined();
    expect(tools.filterPlacementResults).toBeDefined();
    expect(tools.simulateCardAllocation).toBeDefined();
    expect(tools.analyzeScoreImpact).toBeDefined();
  });

  it("총 19개 도구가 등록된다", () => {
    const { tools } = createOrchestrator(mockContext);
    expect(Object.keys(tools)).toHaveLength(19);
  });
});
