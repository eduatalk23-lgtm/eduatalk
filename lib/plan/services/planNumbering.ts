/**
 * 플랜 번호 계산 유틸리티
 *
 * generate/preview 서비스에서 공통으로 사용하는 plan_number 계산 로직입니다.
 * 동일한 날짜+콘텐츠+범위는 같은 플랜 번호를 부여합니다.
 *
 * @module lib/plan/services/planNumbering
 */

/**
 * 플랜 번호 계산기
 *
 * 동일한 날짜+콘텐츠+범위 조합은 같은 번호를 부여하고,
 * 새로운 조합은 순차적으로 증가하는 번호를 부여합니다.
 */
export class PlanNumberCalculator {
  private planNumberMap = new Map<string, number>();
  private nextPlanNumber = 1;

  /**
   * 플랜 키 생성
   *
   * @param date 플랜 날짜 (YYYY-MM-DD)
   * @param contentId 콘텐츠 ID (이미 해석된 학생 콘텐츠 ID)
   * @param startRange 시작 범위 (페이지/시간)
   * @param endRange 종료 범위 (페이지/시간)
   */
  createPlanKey(
    date: string,
    contentId: string,
    startRange: number | null,
    endRange: number | null
  ): string {
    return `${date}:${contentId}:${startRange}:${endRange}`;
  }

  /**
   * 플랜 번호 가져오기
   *
   * 이미 존재하는 키면 기존 번호를 반환하고,
   * 새로운 키면 새 번호를 부여하고 반환합니다.
   */
  getOrAssignNumber(planKey: string): number {
    const existing = this.planNumberMap.get(planKey);
    if (existing !== undefined) {
      return existing;
    }

    const newNumber = this.nextPlanNumber;
    this.planNumberMap.set(planKey, newNumber);
    this.nextPlanNumber++;
    return newNumber;
  }

  /**
   * 플랜 정보로 번호 가져오기 (편의 메서드)
   */
  getPlanNumber(
    date: string,
    contentId: string,
    startRange: number | null,
    endRange: number | null
  ): number {
    const key = this.createPlanKey(date, contentId, startRange, endRange);
    return this.getOrAssignNumber(key);
  }

  /**
   * 현재 상태 리셋
   */
  reset(): void {
    this.planNumberMap.clear();
    this.nextPlanNumber = 1;
  }

  /**
   * 현재 할당된 번호 개수
   */
  get count(): number {
    return this.planNumberMap.size;
  }
}

/**
 * 새 플랜 번호 계산기 생성
 */
export function createPlanNumberCalculator(): PlanNumberCalculator {
  return new PlanNumberCalculator();
}
