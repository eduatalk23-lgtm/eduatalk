"use client";

/**
 * AI Provider 선택 컴포넌트
 *
 * 사용 가능한 LLM Provider를 선택하고 비용을 비교할 수 있는 UI를 제공합니다.
 *
 * @example
 * ```tsx
 * <ProviderSelector
 *   value="anthropic"
 *   onChange={(provider) => setProvider(provider)}
 *   tier="standard"
 *   showCostComparison
 * />
 * ```
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import Badge from "@/components/atoms/Badge";
import { Card, CardContent } from "@/components/molecules/Card";
import {
  Sparkles as SparklesIcon,
  CheckCircle as CheckCircleIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Info as InformationCircleIcon,
} from "lucide-react";

// ============================================
// 타입
// ============================================

export type ProviderType = "anthropic" | "openai" | "gemini";
export type ModelTier = "fast" | "standard" | "advanced";

interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  available: boolean;
  models: Record<ModelTier, ModelInfo>;
}

interface ModelInfo {
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

interface ProviderSelectorProps {
  /** 선택된 Provider */
  value: ProviderType;
  /** Provider 변경 핸들러 */
  onChange: (provider: ProviderType) => void;
  /** 선택된 모델 티어 (비용 계산에 사용) */
  tier?: ModelTier;
  /** 티어 변경 핸들러 */
  onTierChange?: (tier: ModelTier) => void;
  /** 비용 비교 표시 여부 */
  showCostComparison?: boolean;
  /** 티어 선택 표시 여부 */
  showTierSelector?: boolean;
  /** 추정 입력 토큰 수 (비용 계산에 사용) */
  estimatedInputTokens?: number;
  /** 추정 출력 토큰 수 (비용 계산에 사용) */
  estimatedOutputTokens?: number;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 상수
// ============================================

const PROVIDER_INFO: Record<ProviderType, Omit<ProviderInfo, "available">> = {
  anthropic: {
    type: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5 Haiku, Claude Sonnet 4",
    models: {
      fast: { modelId: "claude-3-5-haiku-20241022", inputCostPer1M: 0.25, outputCostPer1M: 1.25 },
      standard: { modelId: "claude-sonnet-4", inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
      advanced: { modelId: "claude-sonnet-4", inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
    },
  },
  openai: {
    type: "openai",
    name: "OpenAI GPT",
    description: "GPT-4o-mini, GPT-4o, GPT-4 Turbo",
    models: {
      fast: { modelId: "gpt-4o-mini", inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
      standard: { modelId: "gpt-4o", inputCostPer1M: 2.5, outputCostPer1M: 10.0 },
      advanced: { modelId: "gpt-4-turbo", inputCostPer1M: 10.0, outputCostPer1M: 30.0 },
    },
  },
  gemini: {
    type: "gemini",
    name: "Google Gemini",
    description: "Gemini 1.5 Flash, Gemini 1.5 Pro",
    models: {
      fast: { modelId: "gemini-1.5-flash", inputCostPer1M: 0.075, outputCostPer1M: 0.3 },
      standard: { modelId: "gemini-1.5-pro", inputCostPer1M: 1.25, outputCostPer1M: 5.0 },
      advanced: { modelId: "gemini-1.5-pro", inputCostPer1M: 1.25, outputCostPer1M: 5.0 },
    },
  },
};

const TIER_LABELS: Record<ModelTier, { label: string; description: string }> = {
  fast: { label: "빠름", description: "빠른 응답, 저비용" },
  standard: { label: "표준", description: "균형 잡힌 성능" },
  advanced: { label: "고급", description: "높은 정확도" },
};

// ============================================
// 유틸리티
// ============================================

function formatCost(cost: number): string {
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(3)}m`; // millidollar
  }
  return `$${cost.toFixed(4)}`;
}

function calculateCost(
  provider: ProviderType,
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number
): number {
  const model = PROVIDER_INFO[provider].models[tier];
  return (
    (inputTokens * model.inputCostPer1M) / 1_000_000 +
    (outputTokens * model.outputCostPer1M) / 1_000_000
  );
}

// ============================================
// 컴포넌트
// ============================================

export default function ProviderSelector({
  value,
  onChange,
  tier = "standard",
  onTierChange,
  showCostComparison = false,
  showTierSelector = false,
  estimatedInputTokens = 2000,
  estimatedOutputTokens = 1500,
  compact = false,
  disabled = false,
  className,
}: ProviderSelectorProps) {
  // Provider 가용성 상태 (실제로는 서버에서 가져와야 함)
  const [availability, setAvailability] = useState<Record<ProviderType, boolean>>({
    anthropic: true,
    openai: false,
    gemini: false,
  });

  // 클라이언트에서 환경 변수 확인은 불가능하므로
  // 서버 액션이나 API를 통해 확인해야 함
  // 여기서는 임시로 모두 사용 가능으로 표시
  useEffect(() => {
    // TODO: 실제 구현에서는 서버에서 Provider 가용성을 확인
    setAvailability({
      anthropic: true,
      openai: true,
      gemini: true,
    });
  }, []);

  // 비용 계산
  const costs = useMemo(() => {
    return (Object.keys(PROVIDER_INFO) as ProviderType[]).map((provider) => ({
      provider,
      cost: calculateCost(provider, tier, estimatedInputTokens, estimatedOutputTokens),
    }));
  }, [tier, estimatedInputTokens, estimatedOutputTokens]);

  // 최저 비용 Provider 찾기
  const cheapestProvider = useMemo(() => {
    const availableCosts = costs.filter((c) => availability[c.provider]);
    return availableCosts.reduce((min, c) => (c.cost < min.cost ? c : min), availableCosts[0]);
  }, [costs, availability]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 티어 선택 */}
      {showTierSelector && onTierChange && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">모델 티어</label>
          <div className="flex gap-2">
            {(Object.keys(TIER_LABELS) as ModelTier[]).map((t) => (
              <button
                key={t}
                onClick={() => onTierChange(t)}
                disabled={disabled}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                  tier === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="font-medium">{TIER_LABELS[t].label}</span>
                {!compact && (
                  <span className="block text-xs text-gray-500">{TIER_LABELS[t].description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Provider 선택 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">AI 모델</label>
        <div className={cn("grid gap-3", compact ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3")}>
          {(Object.entries(PROVIDER_INFO) as [ProviderType, Omit<ProviderInfo, "available">][]).map(
            ([provider, info]) => {
              const isAvailable = availability[provider];
              const isSelected = value === provider;
              const cost = costs.find((c) => c.provider === provider)?.cost || 0;
              const isCheapest = cheapestProvider?.provider === provider;

              return (
                <button
                  key={provider}
                  onClick={() => isAvailable && onChange(provider)}
                  disabled={disabled || !isAvailable}
                  className={cn(
                    "relative rounded-lg border p-3 text-left transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    !isAvailable && "cursor-not-allowed opacity-50",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  {/* 선택 표시 */}
                  {isSelected && (
                    <div className="absolute right-2 top-2">
                      <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                    </div>
                  )}

                  {/* 최저가 배지 */}
                  {isCheapest && showCostComparison && (
                    <Badge variant="success" size="sm" className="absolute right-2 top-2">
                      최저가
                    </Badge>
                  )}

                  {/* Provider 정보 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-gray-900">{info.name}</span>
                    </div>

                    {!compact && (
                      <p className="text-xs text-gray-500">{info.description}</p>
                    )}

                    {/* 모델 정보 */}
                    <p className="text-xs text-gray-400">
                      {info.models[tier].modelId}
                    </p>

                    {/* 비용 */}
                    {showCostComparison && (
                      <div className="mt-2 flex items-center gap-1 text-sm">
                        <span className="text-gray-500">예상 비용:</span>
                        <span className={cn("font-medium", isCheapest && "text-green-600")}>
                          {formatCost(cost)}
                        </span>
                      </div>
                    )}

                    {/* 비가용 표시 */}
                    {!isAvailable && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        <span>API 키 미설정</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* 비용 비교 테이블 */}
      {showCostComparison && !compact && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <InformationCircleIcon className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">비용 비교</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium text-right">입력 (1M)</th>
                    <th className="pb-2 font-medium text-right">출력 (1M)</th>
                    <th className="pb-2 font-medium text-right">예상 비용</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(PROVIDER_INFO) as [ProviderType, Omit<ProviderInfo, "available">][]).map(
                    ([provider, info]) => {
                      const model = info.models[tier];
                      const cost = calculateCost(
                        provider,
                        tier,
                        estimatedInputTokens,
                        estimatedOutputTokens
                      );
                      const isCheapest = cheapestProvider?.provider === provider;
                      const isSelected = value === provider;

                      return (
                        <tr
                          key={provider}
                          className={cn(
                            "border-b last:border-0",
                            isSelected && "bg-blue-50"
                          )}
                        >
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{info.name}</span>
                              {isCheapest && (
                                <Badge variant="success" size="sm">
                                  최저가
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            ${model.inputCostPer1M.toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            ${model.outputCostPer1M.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              "py-2 text-right font-medium",
                              isCheapest ? "text-green-600" : "text-gray-900"
                            )}
                          >
                            {formatCost(cost)}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              * 입력 {estimatedInputTokens.toLocaleString()}개, 출력{" "}
              {estimatedOutputTokens.toLocaleString()}개 토큰 기준
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// 하위 컴포넌트: 간소화된 Provider 배지
// ============================================

export function ProviderBadge({
  provider,
  className,
}: {
  provider: ProviderType;
  className?: string;
}) {
  const info = PROVIDER_INFO[provider];

  const colors: Record<ProviderType, string> = {
    anthropic: "bg-orange-50 text-orange-700 border-orange-200",
    openai: "bg-green-50 text-green-700 border-green-200",
    gemini: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        colors[provider],
        className
      )}
    >
      <SparklesIcon className="h-3 w-3" />
      {info.name}
    </span>
  );
}
