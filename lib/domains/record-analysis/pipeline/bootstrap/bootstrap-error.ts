// ============================================
// Bootstrap 전용 에러 타입
// runTaskWithState 가 throw 를 catch → failed 처리 → cascade 차단.
// ============================================

export type BootstrapErrorStep =
  | "target_major"
  | "main_exploration"
  | "course_plan";

export class BootstrapError extends Error {
  constructor(
    message: string,
    public readonly step: BootstrapErrorStep,
  ) {
    super(message);
    this.name = "BootstrapError";
  }
}
