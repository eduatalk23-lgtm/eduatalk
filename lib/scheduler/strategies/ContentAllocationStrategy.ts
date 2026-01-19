/**
 * 콘텐츠 배분 전략 패턴
 *
 * 학습 콘텐츠를 날짜/시간 슬롯에 배분하는 다양한 전략을 정의합니다.
 */

import type { ContentInfo } from "@/lib/plan/scheduler";

/**
 * 콘텐츠 배분 전략 인터페이스
 */
export interface ContentAllocationStrategy {
  /** 전략 이름 */
  readonly name: string;

  /**
   * 콘텐츠를 정렬하여 배분 순서 결정
   *
   * @param contents - 정렬할 콘텐츠 배열
   * @param riskIndexMap - 과목별 취약도 맵 (선택)
   * @returns 정렬된 콘텐츠 배열
   */
  sortContents(
    contents: ContentInfo[],
    riskIndexMap?: Map<string, { riskScore: number }>
  ): ContentInfo[];
}

/**
 * 취약과목 우선 배분 전략
 *
 * riskScore가 높은 과목(취약 과목)을 먼저 배치합니다.
 */
export class RiskBasedAllocationStrategy implements ContentAllocationStrategy {
  readonly name = "risk_based";

  sortContents(
    contents: ContentInfo[],
    riskIndexMap?: Map<string, { riskScore: number }>
  ): ContentInfo[] {
    if (!riskIndexMap || riskIndexMap.size === 0) {
      return contents;
    }

    return [...contents].sort((a, b) => {
      const aSubject = a.subject?.toLowerCase().trim() || "";
      const bSubject = b.subject?.toLowerCase().trim() || "";
      const aRisk = riskIndexMap.get(aSubject)?.riskScore || 0;
      const bRisk = riskIndexMap.get(bSubject)?.riskScore || 0;
      return bRisk - aRisk; // 내림차순: 취약 과목 우선
    });
  }
}

/**
 * 균등 배분 전략
 *
 * 콘텐츠를 원래 순서 그대로 유지합니다.
 */
export class BalancedAllocationStrategy implements ContentAllocationStrategy {
  readonly name = "balanced";

  sortContents(contents: ContentInfo[]): ContentInfo[] {
    return [...contents];
  }
}

/**
 * 볼륨 기반 배분 전략
 *
 * 학습량(total_amount)이 큰 콘텐츠를 먼저 배치합니다. (Best Fit 최적화)
 */
export class VolumeBasedAllocationStrategy implements ContentAllocationStrategy {
  readonly name = "volume_based";

  sortContents(contents: ContentInfo[]): ContentInfo[] {
    return [...contents].sort((a, b) => {
      const aVolume = a.total_amount || 0;
      const bVolume = b.total_amount || 0;
      return bVolume - aVolume; // 내림차순: 큰 볼륨 우선
    });
  }
}

/**
 * 전략 팩토리 함수
 */
export function createAllocationStrategy(
  type: "risk_based" | "balanced" | "volume_based" = "risk_based"
): ContentAllocationStrategy {
  switch (type) {
    case "balanced":
      return new BalancedAllocationStrategy();
    case "volume_based":
      return new VolumeBasedAllocationStrategy();
    case "risk_based":
    default:
      return new RiskBasedAllocationStrategy();
  }
}
