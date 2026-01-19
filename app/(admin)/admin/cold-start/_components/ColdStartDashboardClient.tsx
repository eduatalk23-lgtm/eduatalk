"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GeminiQuotaCard, type GeminiQuotaData } from "./GeminiQuotaCard";
import { CacheStatsCard, type CacheStatsData } from "./CacheStatsCard";
import BatchControlPanel from "./BatchControlPanel";
import BatchProgressModal from "./BatchProgressModal";
import BatchResultsSection from "./BatchResultsSection";
import type {
  BatchPreset,
  BatchResult,
  BatchTarget,
} from "@/lib/domains/plan/llm/actions/coldStart/batch/types";

interface DryRunResult {
  targets: BatchTarget[];
  estimatedDurationMinutes: number;
}

async function fetchQuotaData(): Promise<GeminiQuotaData> {
  const response = await fetch("/api/admin/gemini-quota");
  if (!response.ok) throw new Error("할당량 조회 실패");
  const json = await response.json();
  return json.data;
}

async function fetchCacheStats(): Promise<CacheStatsData> {
  const response = await fetch("/api/admin/cache-stats");
  if (!response.ok) throw new Error("캐시 통계 조회 실패");
  const json = await response.json();
  return json.data;
}

async function resetQuotaTracker(): Promise<void> {
  const response = await fetch("/api/admin/gemini-quota", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  if (!response.ok) throw new Error("트래커 리셋 실패");
}

async function clearCache(): Promise<void> {
  const response = await fetch("/api/admin/cache-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("캐시 초기화 실패");
}

async function dryRunBatch(preset: BatchPreset): Promise<DryRunResult> {
  const response = await fetch(`/api/admin/cold-start/batch/stream?preset=${preset}&dryRun=true`, {
    method: "GET",
  });
  if (!response.ok) throw new Error("드라이런 실패");
  const json = await response.json();
  return json.data;
}

export default function ColdStartDashboardClient() {
  const queryClient = useQueryClient();

  // 할당량 데이터
  const {
    data: quotaData,
    isLoading: isQuotaLoading,
  } = useQuery({
    queryKey: ["admin", "gemini-quota"],
    queryFn: fetchQuotaData,
    refetchInterval: 30000, // 30초마다 갱신
    staleTime: 10000,
  });

  // 캐시 통계 데이터
  const {
    data: cacheStats,
    isLoading: isCacheLoading,
  } = useQuery({
    queryKey: ["admin", "cache-stats"],
    queryFn: fetchCacheStats,
    refetchInterval: 60000, // 60초마다 갱신
    staleTime: 30000,
  });

  // 리셋/초기화 상태
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // 배치 처리 상태
  const [isExecuting, setIsExecuting] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [batchPreset, setBatchPreset] = useState<BatchPreset>("core");
  const [batchLimit, setBatchLimit] = useState<number | undefined>();
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // 할당량 트래커 리셋
  const handleResetQuota = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetQuotaTracker();
      queryClient.invalidateQueries({ queryKey: ["admin", "gemini-quota"] });
    } finally {
      setIsResetting(false);
    }
  }, [queryClient]);

  // 캐시 초기화
  const handleClearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearCache();
      queryClient.invalidateQueries({ queryKey: ["admin", "cache-stats"] });
    } finally {
      setIsClearing(false);
    }
  }, [queryClient]);

  // 드라이런
  const handleDryRun = useCallback(async (preset: BatchPreset): Promise<DryRunResult> => {
    return await dryRunBatch(preset);
  }, []);

  // 배치 실행
  const handleExecute = useCallback((preset: BatchPreset, limit?: number) => {
    setBatchPreset(preset);
    setBatchLimit(limit);
    setIsExecuting(true);
    setShowProgressModal(true);
  }, []);

  // 배치 완료
  const handleBatchComplete = useCallback((result: BatchResult) => {
    setBatchResult(result);
    setIsExecuting(false);
    // 쿼리 갱신
    queryClient.invalidateQueries({ queryKey: ["admin", "gemini-quota"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "cache-stats"] });
  }, [queryClient]);

  // 배치 취소
  const handleBatchCancel = useCallback(() => {
    setShowProgressModal(false);
    setIsExecuting(false);
  }, []);

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setShowProgressModal(false);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* KPI 카드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GeminiQuotaCard
          data={quotaData ?? null}
          isLoading={isQuotaLoading}
          onReset={handleResetQuota}
          isResetting={isResetting}
        />
        <CacheStatsCard
          data={cacheStats ?? null}
          isLoading={isCacheLoading}
          onClear={handleClearCache}
          isClearing={isClearing}
        />
      </div>

      {/* 배치 제어 패널 */}
      <BatchControlPanel
        onDryRun={handleDryRun}
        onExecute={handleExecute}
        isExecuting={isExecuting}
      />

      {/* 배치 결과 */}
      <BatchResultsSection result={batchResult} />

      {/* 진행 상황 모달 */}
      <BatchProgressModal
        isOpen={showProgressModal}
        onClose={handleCloseModal}
        onCancel={handleBatchCancel}
        preset={batchPreset}
        limit={batchLimit}
        onComplete={handleBatchComplete}
      />
    </div>
  );
}
