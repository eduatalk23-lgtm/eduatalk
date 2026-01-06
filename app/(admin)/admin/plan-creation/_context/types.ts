/**
 * 플랜 생성 통합 섹션 타입 정의
 */

import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";

/** 생성 방법 유형 */
export type CreationMethod =
  | "batch-ai" // 배치 AI 플랜 생성
  | "plan-group-wizard" // 플랜 그룹 생성 위저드 (7단계)
  | "quick-plan" // 빠른 플랜 추가
  | "content-wizard"; // 콘텐츠 추가 위저드

/** 플로우 단계 */
export type PlanCreationStep =
  | "student-selection" // 학생 선택
  | "method-selection" // 방법 선택
  | "creation-process" // 생성 진행
  | "results"; // 결과 확인

/** 생성 결과 상태 */
export type CreationResultStatus = "success" | "error" | "skipped";

/** 개별 생성 결과 */
export interface CreationResult {
  studentId: string;
  studentName: string;
  status: CreationResultStatus;
  message?: string;
  planGroupId?: string;
  plansCreated?: number;
  error?: string;
}

/** 전체 Context 상태 */
export interface PlanCreationState {
  // 학생 선택
  selectedStudentIds: Set<string>;

  // 방법 선택
  selectedMethod: CreationMethod | null;

  // 플로우 상태
  currentStep: PlanCreationStep;
  isCreating: boolean;

  // 결과
  creationResults: CreationResult[];

  // 재시도 대상
  retryStudentIds: string[];

  // 에러
  error: string | null;
}

/** 생성 방법 정보 */
export interface CreationMethodInfo {
  id: CreationMethod;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  features: string[];
  requiresMultipleStudents?: boolean;
  minStudents?: number;
  maxStudents?: number;
}

/** 생성 방법 메타데이터 */
export const CREATION_METHODS: CreationMethodInfo[] = [
  {
    id: "batch-ai",
    name: "AI 플랜 생성",
    description: "AI가 자동으로 최적의 학습 플랜을 생성합니다",
    icon: "Wand2",
    features: ["빠른 생성", "AI 최적화", "다중 학생 지원"],
  },
  {
    id: "plan-group-wizard",
    name: "플랜 그룹 생성",
    description: "7단계 위저드로 상세한 플랜 그룹을 생성합니다",
    icon: "FileText",
    features: ["세밀한 설정", "콘텐츠 선택", "스케줄 커스터마이징"],
  },
  {
    id: "quick-plan",
    name: "빠른 플랜 추가",
    description: "자유 학습, 독서, 운동 등 빠른 플랜을 추가합니다",
    icon: "Zap",
    features: ["간편 추가", "다양한 타입", "즉시 생성"],
  },
  {
    id: "content-wizard",
    name: "콘텐츠 추가",
    description: "3단계 위저드로 콘텐츠를 플랜에 추가합니다",
    icon: "BookOpen",
    features: ["콘텐츠 선택", "범위 설정", "배분 설정"],
  },
];

/** Selection Context 값 */
export interface SelectionContextValue {
  selectedStudentIds: Set<string>;
  selectedStudents: StudentListRow[];
  selectedMethod: CreationMethod | null;
  toggleStudent: (id: string) => void;
  selectAllStudents: () => void;
  clearSelection: () => void;
  selectMethod: (method: CreationMethod) => void;
  clearMethod: () => void;
}

/** Flow Context 값 */
export interface FlowContextValue {
  currentStep: PlanCreationStep;
  isCreating: boolean;
  results: CreationResult[];
  retryStudentIds: string[];
  failedStudentIds: string[];
  error: string | null;
  startCreation: () => void;
  finishCreation: (results: CreationResult[]) => void;
  updateResults: (results: CreationResult[]) => void;
  setStep: (step: PlanCreationStep) => void;
  setError: (error: string | null) => void;
  startRetry: (studentIds: string[]) => void;
  retryAllFailed: () => void;
  reset: () => void;
  resetResultsOnly: () => void;
}
