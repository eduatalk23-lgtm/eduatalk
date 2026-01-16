import type { RepomixConfig } from "repomix";

const config: RepomixConfig = {
  include: [
    // LLM 플랜 생성 핵심 로직
    "lib/domains/plan/llm/**",
    // 관리자용 배치 AI 플랜 생성
    "lib/domains/admin-plan/actions/batchAIPlanGeneration.ts",
    "lib/domains/admin-plan/actions/aiPlanGeneration.ts",
    // AI UI 컴포넌트
    "components/ai/**",
    // 학생용 AI 플랜 생성 UI
    "app/(student)/plan/new-group/_components/_features/ai-mode/**",
    "app/(student)/plan/**/*AIPlan*.tsx",
    // 관리자용 AI 플랜 생성 UI
    "app/(admin)/admin/students/**/plans/**/*WebSearch*.tsx",
    "app/(admin)/admin/students/**/plans/**/*AI*.tsx",
    // 관련 문서
    "docs/**/*ai*.md",
    "docs/**/*llm*.md",
    "docs/**/plan-generation*.md",
    "docs/architecture/plan-generation*.md",
    "docs/ai-integration*.md",
    "docs/mentor-question-ai*.md",
    // LLM 관련 타입 및 유틸리티
    "lib/domains/plan/llm/types/**",
    "lib/domains/plan/llm/utils/**",
  ],
  exclude: [
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/__tests__/**",
    "**/__mocks__/**",
  ],
};

export default config;

