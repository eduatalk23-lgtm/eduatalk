// 플랜 상태 관리 로직

import { PlanStatus, PlanStatusTransition } from "@/lib/types/plan";

/**
 * 플랜 상태 전이 규칙
 */
const STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ["saved", "paused"], // 중단은 일시정지로 통합
  saved: ["active", "draft", "paused"], // 중단은 일시정지로 통합
  active: ["paused", "completed"], // 중단은 일시정지로 통합
  paused: ["active"], // 일시정지에서 재개만 가능 (완료/중단은 active로 가서 처리)
  completed: [], // 완료 상태는 변경 불가
  cancelled: ["active"], // 기존 데이터 호환성을 위해 유지 (UI에서는 표시 안 함)
  pending: ["in_progress", "cancelled"], // 대기 중
  in_progress: ["completed", "paused", "cancelled"], // 진행 중
};

/**
 * 상태별 제약 조건
 */
const STATUS_CONSTRAINTS: Record<
  PlanStatus,
  {
    canEdit: boolean;
    canDelete: boolean;
    canModifyContents: boolean;
    canModifyExclusions: boolean;
    description: string;
  }
> = {
  draft: {
    canEdit: true,
    canDelete: true,
    canModifyContents: true,
    canModifyExclusions: true,
    description: "초안 상태 - 모든 수정 가능",
  },
  saved: {
    canEdit: true,
    canDelete: true,
    canModifyContents: true,
    canModifyExclusions: true,
    description: "저장됨 - 수정 및 삭제 가능",
  },
  active: {
    canEdit: false, // 메타데이터 수정 불가
    canDelete: false, // 삭제 불가
    canModifyContents: false, // 콘텐츠 수정 불가
    canModifyExclusions: true, // 제외일은 추가 가능
    description: "활성 상태 - 실행 중, 제한적 수정만 가능",
  },
  paused: {
    canEdit: false,
    canDelete: true, // 일시정지 상태에서도 삭제 가능
    canModifyContents: false,
    canModifyExclusions: true,
    description: "일시정지 상태 - 삭제 가능",
  },
  completed: {
    canEdit: false,
    canDelete: true, // 완료 상태에서도 삭제 가능
    canModifyContents: false,
    canModifyExclusions: false,
    description: "완료 상태 - 삭제 가능",
  },
  cancelled: {
    canEdit: false,
    canDelete: false,
    canModifyContents: false,
    canModifyExclusions: false,
    description: "중단 상태 (일시정지로 통합됨) - 읽기 전용",
  },
  pending: {
    canEdit: true,
    canDelete: true,
    canModifyContents: true,
    canModifyExclusions: true,
    description: "대기 중인 플랜",
  },
  in_progress: {
    canEdit: true,
    canDelete: false,
    canModifyContents: false,
    canModifyExclusions: false,
    description: "진행 중인 플랜",
  },
};

/**
 * 플랜 상태 관리자
 */
export class PlanStatusManager {
  /**
   * 상태 전이가 가능한지 확인
   */
  static canTransition(from: PlanStatus, to: PlanStatus): boolean {
    return STATUS_TRANSITIONS[from].includes(to);
  }

  /**
   * 가능한 다음 상태 목록 조회
   */
  static getAvailableTransitions(from: PlanStatus): PlanStatus[] {
    return STATUS_TRANSITIONS[from];
  }

  /**
   * 상태 전이 규칙 조회
   */
  static getTransitionRules(): PlanStatusTransition[] {
    const rules: PlanStatusTransition[] = [];

    for (const [from, allowedTo] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of allowedTo) {
        rules.push({
          from: from as PlanStatus,
          to: to as PlanStatus,
          allowed: true,
          condition: this.getTransitionCondition(from as PlanStatus, to as PlanStatus),
        });
      }
    }

    return rules;
  }

  /**
   * 상태별 제약 조건 조회
   */
  static getConstraints(status: PlanStatus) {
    return STATUS_CONSTRAINTS[status];
  }

  /**
   * 상태에서 수정 가능한지 확인
   */
  static canEdit(status: PlanStatus): boolean {
    return STATUS_CONSTRAINTS[status].canEdit;
  }

  /**
   * 상태에서 삭제 가능한지 확인
   */
  static canDelete(status: PlanStatus): boolean {
    return STATUS_CONSTRAINTS[status].canDelete;
  }

  /**
   * 상태에서 콘텐츠 수정 가능한지 확인
   */
  static canModifyContents(status: PlanStatus): boolean {
    return STATUS_CONSTRAINTS[status].canModifyContents;
  }

  /**
   * 상태에서 제외일 수정 가능한지 확인
   */
  static canModifyExclusions(status: PlanStatus): boolean {
    return STATUS_CONSTRAINTS[status].canModifyExclusions;
  }

  /**
   * 상태 전이 조건 설명
   */
  private static getTransitionCondition(
    from: PlanStatus,
    to: PlanStatus
  ): string {
    const conditions: Record<string, string> = {
      "draft->saved": "플랜 저장 완료",
      "draft->paused": "플랜 중단",
      "saved->active": "플랜 활성화 (시작)",
      "saved->draft": "다시 초안으로 변경",
      "saved->paused": "플랜 중단",
      "active->paused": "플랜 일시정지",
      "active->completed": "플랜 완료",
      "paused->active": "플랜 재개",
      "cancelled->active": "중단 해제 (재개)",
    };

    return conditions[`${from}->${to}`] || "상태 전이";
  }

  /**
   * 초기 상태 반환
   */
  static getInitialStatus(): PlanStatus {
    return "draft";
  }

  /**
   * 완료 상태 확인
   */
  static isTerminalStatus(status: PlanStatus): boolean {
    return status === "completed" || status === "cancelled";
  }

  /**
   * 활성 상태 확인 (진행 중인 플랜)
   */
  static isActiveStatus(status: PlanStatus): boolean {
    return status === "active" || status === "paused";
  }
}

