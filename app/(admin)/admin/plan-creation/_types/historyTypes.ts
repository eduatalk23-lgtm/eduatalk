/**
 * 플랜 생성 이력 타입 정의
 */

import type { CreationMethod } from "./batchTypes";
import type { TemplateSettings } from "./templateTypes";

// 이력 상태
export type HistoryStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

// 이력 결과 항목
export interface HistoryResultItem {
  studentId: string;
  studentName: string;
  status: "success" | "error" | "skipped";
  message?: string;
  planGroupId?: string;
  error?: string;
}

// 이력 기본 타입
export interface PlanCreationHistory {
  id: string;
  tenantId: string;
  creationMethod: CreationMethod;
  templateId: string | null;
  settingsSnapshot: TemplateSettings;
  targetStudentIds: string[];
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: HistoryResultItem[];
  startedAt: Date;
  completedAt: Date | null;
  status: HistoryStatus;
  createdBy: string | null;
  createdAt: Date;
}

// 이력 목록 아이템 (요약 정보만)
export interface HistoryListItem {
  id: string;
  creationMethod: CreationMethod;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  status: HistoryStatus;
  startedAt: Date;
  completedAt: Date | null;
  createdBy: string | null;
}

// 이력 생성 입력
export interface CreateHistoryInput {
  creationMethod: CreationMethod;
  templateId?: string;
  settingsSnapshot: TemplateSettings;
  targetStudentIds: string[];
}

// 이력 업데이트 입력
export interface UpdateHistoryInput {
  id: string;
  status?: HistoryStatus;
  results?: HistoryResultItem[];
  completedAt?: Date;
}

// 이력 목록 필터
export interface HistoryListFilter {
  creationMethod?: CreationMethod;
  status?: HistoryStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// 이력 통계
export interface HistoryStats {
  totalExecutions: number;
  totalStudentsProcessed: number;
  successRate: number;
  methodBreakdown: Record<CreationMethod, number>;
  recentExecutions: HistoryListItem[];
}
