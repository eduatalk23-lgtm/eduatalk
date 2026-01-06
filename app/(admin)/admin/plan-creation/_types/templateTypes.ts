/**
 * 플랜 생성 템플릿 타입 정의
 */

import type { CreationMethod } from "./batchTypes";

// 템플릿 기본 타입
export interface PlanCreationTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  creationMethod: CreationMethod;
  isDefault: boolean;
  settings: TemplateSettings;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 템플릿 설정 (메서드별로 다른 구조)
export type TemplateSettings =
  | AITemplateSettings
  | PlanGroupTemplateSettings
  | QuickPlanTemplateSettings
  | ContentAddTemplateSettings;

// AI 플랜 템플릿 설정
export interface AITemplateSettings {
  type: "ai";
  planDuration: number; // 일수
  dailyStudyMinutes: number;
  daysPerWeek: number[];
  focusAreas: string[];
  difficultyLevel: "easy" | "medium" | "hard";
  additionalInstructions?: string;
}

// 플랜 그룹 템플릿 설정
export interface PlanGroupTemplateSettings {
  type: "planGroup";
  dailyStudyMinutes: number;
  daysPerWeek: number[];
  defaultDurationDays: number;
}

// 빠른 플랜 템플릿 설정
export interface QuickPlanTemplateSettings {
  type: "quickPlan";
  defaultStartTime: string;
  defaultEndTime: string;
  defaultDurationMinutes: number;
}

// 콘텐츠 추가 템플릿 설정
export interface ContentAddTemplateSettings {
  type: "contentAdd";
  distributionStrategy: "even" | "front-loaded" | "back-loaded";
  defaultDurationDays: number;
  dailyStudyMinutes: number;
}

// 템플릿 생성 입력
export interface CreateTemplateInput {
  name: string;
  description?: string;
  creationMethod: CreationMethod;
  isDefault?: boolean;
  settings: TemplateSettings;
}

// 템플릿 수정 입력
export interface UpdateTemplateInput {
  id: string;
  name?: string;
  description?: string;
  isDefault?: boolean;
  settings?: Partial<TemplateSettings>;
}

// 템플릿 목록 필터
export interface TemplateListFilter {
  creationMethod?: CreationMethod;
  includeDefaults?: boolean;
}

// 템플릿 선택 상태
export interface TemplateSelectionState {
  selectedTemplateId: string | null;
  isLoading: boolean;
  templates: PlanCreationTemplate[];
}
