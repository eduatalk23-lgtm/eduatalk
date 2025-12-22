/**
 * Block 도메인 타입 정의
 */

import { z } from "zod";

// ============================================
// DB 엔티티 타입
// ============================================

export interface Block {
  id: string;
  tenant_id: string | null;
  student_id: string;
  block_set_id: string;
  day_of_week: number; // 0(일) ~ 6(토)
  start_time: string; // HH:mm 형식
  end_time: string; // HH:mm 형식
  created_at: string;
  updated_at: string;
}

export interface BlockSet {
  id: string;
  tenant_id: string | null;
  student_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// BlockSetWithBlocks는 lib/data/blockSets.ts에서 정의됨
// repository.ts에서 re-export함

// ============================================
// 입력 타입
// ============================================

export interface CreateBlockInput {
  tenant_id: string | null;
  student_id: string;
  block_set_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface UpdateBlockInput {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
}

export interface CreateBlockSetInput {
  tenant_id: string | null;
  student_id: string;
  name: string;
  description?: string | null;
  display_order?: number;
}

export interface UpdateBlockSetInput {
  name?: string;
  description?: string | null;
  display_order?: number;
}

// ============================================
// 검증 스키마
// ============================================

export const blockSchema = z.object({
  day: z.coerce.number().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "올바른 시간 형식이 아닙니다"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "올바른 시간 형식이 아닙니다"),
}).refine(
  (data) => data.start_time < data.end_time,
  { message: "종료 시간은 시작 시간보다 늦어야 합니다", path: ["end_time"] }
);

export type BlockFormData = z.infer<typeof blockSchema>;

// ============================================
// 결과 타입
// ============================================

export interface BlockActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  /** 부분 성공 시 상세 정보 */
  details?: {
    successCount: number;
    skippedCount: number;
    skippedDays?: string[];
  };
}

// ============================================
// 서비스 컨텍스트
// ============================================

export interface BlockServiceContext {
  userId: string;
  tenantId: string;
  studentId: string;
}
