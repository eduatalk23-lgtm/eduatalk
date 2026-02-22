import type { PlanStatus } from '@/lib/types/plan';

/**
 * Ad-hoc 플랜 스냅샷 (hard-delete 복원용)
 * deletePlan에서 삭제 전 전체 row를 캡처하여 반환
 */
export interface AdHocPlanRow {
  id: string;
  student_id: string;
  title: string;
  status: string;
  container_type: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  memo: string | null;
  planner_id: string | null;
  [key: string]: unknown;
}

/**
 * Undo 가능한 액션 (discriminated union)
 */
export type UndoableAction =
  | {
      type: 'delete-plan';
      planId: string;
      isAdHoc: boolean;
      description: string;
    }
  | {
      type: 'delete-adhoc-snapshot';
      snapshot: AdHocPlanRow;
      description: string;
    }
  | {
      type: 'move-to-date';
      planId: string;
      studentId: string;
      prev: {
        date: string;
        startTime: string;
        endTime: string;
        estimatedMinutes?: number;
      };
      description: string;
    }
  | {
      type: 'resize';
      planId: string;
      studentId: string;
      plannerId: string;
      planDate: string;
      prev: {
        startTime: string;
        endTime: string;
        estimatedMinutes?: number;
      };
      description: string;
    }
  | {
      type: 'status-change';
      planId: string;
      isAdHoc: boolean;
      prevStatus: PlanStatus;
      description: string;
    };
