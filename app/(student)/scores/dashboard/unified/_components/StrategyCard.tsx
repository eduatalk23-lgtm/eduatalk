import { SectionCard } from "@/components/ui/SectionCard";
import type { StrategyResult, StrategyType } from "@/lib/types/scoreDashboard";
import { cn } from "@/lib/cn";
import { InfoMessage } from "./InfoMessage";

interface StrategyCardProps {
  strategy: StrategyResult;
}

/**
 * 전략 유형별 스타일 매핑
 */
const strategyStyles: Record<
  StrategyType,
  {
    badgeBg: string;
    badgeText: string;
    label: string;
  }
> = {
  BALANCED: {
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    label: "균형형",
  },
  MOCK_ADVANTAGE: {
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    label: "모의고사 우세",
  },
  INTERNAL_ADVANTAGE: {
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    label: "내신 우세",
  },
};

export function StrategyCard({ strategy }: StrategyCardProps) {
  const { type, message, data } = strategy;
  const style = strategyStyles[type];

  return (
    <SectionCard
      title="수시/정시 전략 분석"
      description="내신과 모의고사 성적 비교 기반 추천"
    >
      {/* 전략 유형 배지 */}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
          style.badgeBg,
          style.badgeText
        )}
      >
        {style.label}
      </span>

      {/* 전략 메시지 */}
      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-sm leading-relaxed text-gray-800">{message}</p>
      </div>

      {/* 비교 데이터 */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-gray-700">
          성적 비교 지표
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {/* 내신 백분위 */}
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-500">
              내신 환산 백분위
            </div>
            <div className="text-xl font-bold text-purple-700">
              {data.internalPct !== null
                ? `${data.internalPct.toFixed(1)}%`
                : "N/A"}
            </div>
          </div>

          {/* 모의고사 백분위 */}
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-500">
              모의고사 평균 백분위
            </div>
            <div className="text-xl font-bold text-blue-700">
              {data.mockPct !== null ? `${data.mockPct.toFixed(1)}%` : "N/A"}
            </div>
          </div>

          {/* 차이 */}
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-500">
              백분위 차이
            </div>
            <div
              className={cn(
                "text-xl font-bold",
                data.diff !== null
                  ? data.diff > 0
                    ? "text-blue-700"
                    : data.diff < 0
                      ? "text-purple-700"
                      : "text-gray-700"
                  : "text-gray-400"
              )}
            >
              {data.diff !== null
                ? data.diff > 0
                  ? `+${data.diff.toFixed(1)}%`
                  : `${data.diff.toFixed(1)}%`
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* 안내 문구 */}
      <InfoMessage
        message="💡 이 분석은 현재까지 입력된 성적을 기반으로 합니다. 정확한 전략 수립을 위해 최신 성적을 꾸준히 입력해주세요."
        variant="info"
      />
    </SectionCard>
  );
}

