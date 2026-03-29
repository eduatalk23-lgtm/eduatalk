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
vi.mock("@/lib/domains/guide/llm/actions/generateGuide", () => ({
  generateGuideAction: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/service", () => ({
  getRecordTabData: vi.fn(),
  getStorylineTabData: vi.fn(),
}));
// competency-repository와 diagnosis-repository는 하단에서 확장 mock 정의
vi.mock("@/lib/domains/student-record/repository", () => ({
  findStorylinesByStudent: vi.fn(),
  findApplicationsByStudentYear: vi.fn(),
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
// Interview mocks (Agent 5)
vi.mock("@/lib/domains/student-record/interview-conflict-checker", () => ({
  checkInterviewConflicts: vi.fn(),
}));
// Report mocks (Agent 6)
vi.mock("@/lib/domains/student-record/llm/actions/generateActivitySummary", () => ({
  generateActivitySummary: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/llm/actions/generateSetekGuide", () => ({
  generateSetekGuide: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/actions/activitySummary", () => ({
  fetchActivitySummaries: vi.fn(),
  fetchSetekGuides: vi.fn(),
}));
// Bypass mocks
vi.mock("@/lib/domains/bypass-major/repository", () => ({
  findCandidates: vi.fn(),
  searchDepartments: vi.fn(),
}));
vi.mock("@/lib/domains/bypass-major/pipeline", () => ({
  runBypassPipeline: vi.fn(),
}));
// 세특 초안 + 진단 저장 + 파이프라인 + 수강 mocks
vi.mock("@/lib/domains/student-record/llm/actions/generateSetekDraft", () => ({
  generateSetekDraftAction: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/diagnosis-repository", () => ({
  findDiagnosisPair: vi.fn(),
  findDiagnosis: vi.fn(),
  findStrategies: vi.fn(),
  upsertDiagnosis: vi.fn(),
  insertStrategy: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/competency-repository", () => ({
  findCompetencyScores: vi.fn(),
  findActivityTags: vi.fn(),
  upsertCompetencyScore: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/actions/pipeline", () => ({
  fetchPipelineStatus: vi.fn(),
  runInitialAnalysisPipeline: vi.fn(),
  rerunPipelineTasks: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/course-adequacy", () => ({
  calculateCourseAdequacy: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/actions/coursePlan", () => ({
  generateRecommendationsAction: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/edge-repository", () => ({
  findEdges: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/min-score-simulator", () => ({
  simulateMinScore: vi.fn(),
  analyzeSubjectImpact: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/course-plan/recommendation", () => ({
  detectPlanConflicts: vi.fn(),
}));
vi.mock("@/lib/domains/student-record/guide-context", () => ({
  buildGuideContextSection: vi.fn().mockResolvedValue(""),
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
  uiState: null,
};

describe("createOrchestrator", () => {
  it("도구와 시스템 프롬프트를 반환한다", async () => {
    const { tools, systemPrompt } = await createOrchestrator(mockContext);

    expect(tools).toBeDefined();
    expect(systemPrompt).toBeDefined();
    expect(typeof systemPrompt).toBe("string");
  });

  it("시스템 프롬프트에 학생 이름이 포함된다", async () => {
    const { systemPrompt } = await createOrchestrator(mockContext);
    expect(systemPrompt).toContain("홍길동");
  });

  it("시스템 프롬프트에 학년도가 포함된다", async () => {
    const { systemPrompt } = await createOrchestrator(mockContext);
    expect(systemPrompt).toContain("2026");
  });

  it("데이터 도구 3개가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.getStudentRecords).toBeDefined();
    expect(tools.getStudentDiagnosis).toBeDefined();
    expect(tools.getStudentStorylines).toBeDefined();
  });

  it("분석 도구 5개 + 작성 도구 4개 + 파이프라인 2개 + 수강 2개가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    // 분석
    expect(tools.suggestTags).toBeDefined();
    expect(tools.analyzeCompetency).toBeDefined();
    expect(tools.analyzeHighlight).toBeDefined();
    expect(tools.detectStoryline).toBeDefined();
    expect(tools.generateDiagnosis).toBeDefined();
    // 작성
    expect(tools.generateSetekDraft).toBeDefined();
    expect(tools.saveDiagnosisResult).toBeDefined();
    expect(tools.saveCompetencyScore).toBeDefined();
    expect(tools.saveStrategy).toBeDefined();
    // 파이프라인
    expect(tools.getPipelineStatus).toBeDefined();
    expect(tools.triggerPipeline).toBeDefined();
    // 수강
    expect(tools.getCourseAdequacy).toBeDefined();
    expect(tools.recommendCourses).toBeDefined();
  });

  it("전략 도구 2개가 등록된다 (Agent 4)", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.suggestStrategies).toBeDefined();
    expect(tools.getWarnings).toBeDefined();
  });

  it("가이드 도구 4개가 등록된다 (Agent 2)", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.searchGuides).toBeDefined();
    expect(tools.getGuideDetail).toBeDefined();
    expect(tools.getStudentAssignments).toBeDefined();
    expect(tools.generateGuide).toBeDefined();
  });

  it("입시 배치 도구 7개가 등록된다 (Agent 3)", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.searchAdmissionData).toBeDefined();
    expect(tools.getUniversityScoreInfo).toBeDefined();
    expect(tools.runPlacementAnalysis).toBeDefined();
    expect(tools.filterPlacementResults).toBeDefined();
    expect(tools.simulateCardAllocation).toBeDefined();
    expect(tools.analyzeScoreImpact).toBeDefined();
    expect(tools.getUniversityEvalCriteria).toBeDefined();
  });

  it("면접 코칭 도구 3개가 등록된다 (Agent 5)", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.generateInterviewQuestions).toBeDefined();
    expect(tools.evaluateAnswer).toBeDefined();
    expect(tools.getInterviewPrep).toBeDefined();
  });

  it("리포트 도구 3개가 등록된다 (Agent 6)", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.generateReport).toBeDefined();
    expect(tools.fetchSavedReports).toBeDefined();
    expect(tools.getStudentOverview).toBeDefined();
  });

  it("우회학과 분석 도구 3개가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.getBypassCandidates).toBeDefined();
    expect(tools.searchBypassDepartments).toBeDefined();
    expect(tools.runBypassAnalysis).toBeDefined();
  });

  it("네비게이션 도구 3개가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.navigateToSection).toBeDefined();
    expect(tools.focusSubject).toBeDefined();
    expect(tools.switchLayerTab).toBeDefined();
  });

  it("교차 과목 분석 도구가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(tools.crossSubjectAnalysis).toBeDefined();
  });

  it("총 49개 도구가 등록된다", async () => {
    const { tools } = await createOrchestrator(mockContext);
    expect(Object.keys(tools)).toHaveLength(49);
  });

  it("uiState가 있으면 시스템 프롬프트에 화면 상태가 포함된다", async () => {
    const ctxWithUI: AgentContext = {
      ...mockContext,
      uiState: {
        activeLayerTab: "analysis",
        viewMode: "all",
        activeSection: "sec-diagnosis-analysis",
        activeStage: "diagnosis",
        focusedSubject: { subjectId: "sub1", subjectName: "국어", schoolYear: 2026 },
        sidePanelApp: "agent",
        bottomSheetOpen: true,
        topSheetOpen: false,
      },
    };
    const { systemPrompt } = await createOrchestrator(ctxWithUI);
    expect(systemPrompt).toContain("현재 사용자 화면 상태");
    expect(systemPrompt).toContain("포커스 과목: 국어");
    expect(systemPrompt).toContain("맥락 인식 규칙");
  });

  it("uiState가 null이면 화면 상태 블록이 없다", async () => {
    const { systemPrompt } = await createOrchestrator(mockContext);
    expect(systemPrompt).not.toContain("현재 사용자 화면 상태");
  });

  // ── 도메인 지식 블록 테스트 ──

  it("도메인 지식 블록이 시스템 프롬프트에 포함된다", async () => {
    const ctxWithProfile: AgentContext = {
      ...mockContext,
      studentGrade: 2,
      schoolCategory: "general",
      targetMajor: "컴퓨터공학",
    };
    const { systemPrompt } = await createOrchestrator(ctxWithProfile);
    expect(systemPrompt).toContain("컨설팅 도메인 지식");
    expect(systemPrompt).toContain("전형별 생기부 전략");
    expect(systemPrompt).toContain("집중기");
    expect(systemPrompt).toContain("일반고");
    expect(systemPrompt).toContain("컴퓨터공학");
  });

  it("학생 프로필이 없어도 기본 도메인 지식이 포함된다", async () => {
    const { systemPrompt } = await createOrchestrator(mockContext);
    expect(systemPrompt).toContain("전형별 생기부 전략");
    expect(systemPrompt).toContain("입학사정관 평가 관점");
    expect(systemPrompt).toContain("참조 지식");
    expect(systemPrompt).toContain("전형 선택");
    // 학교 유형 조건부 섹션은 schoolCategory 없을 때 미포함
    expect(systemPrompt).not.toContain("학교 유형 맥락");
  });

  it("학생 학년 정보가 시스템 프롬프트에 표시된다", async () => {
    const ctxWithGrade: AgentContext = {
      ...mockContext,
      studentGrade: 3,
      schoolName: "서울고등학교",
    };
    const { systemPrompt } = await createOrchestrator(ctxWithGrade);
    expect(systemPrompt).toContain("학년: 3학년");
    expect(systemPrompt).toContain("서울고등학교");
    expect(systemPrompt).toContain("완성기");
  });

  it("희망 전공이 도메인 지식 블록에 반영된다", async () => {
    const ctxWithMajor: AgentContext = {
      ...mockContext,
      targetMajor: "경영학",
    };
    const { systemPrompt } = await createOrchestrator(ctxWithMajor);
    expect(systemPrompt).toContain("경영학");
    expect(systemPrompt).toContain("전공 적합성을 우선 고려");
  });
});
