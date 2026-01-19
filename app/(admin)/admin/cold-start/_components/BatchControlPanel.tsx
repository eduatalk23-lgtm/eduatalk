"use client";

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Play, Eye, Clock, FileText, Loader2 } from "lucide-react";
import type { BatchPreset, BatchTarget } from "@/lib/domains/plan/llm/actions/coldStart/batch/types";

interface DryRunResult {
  targets: BatchTarget[];
  estimatedDurationMinutes: number;
}

interface BatchControlPanelProps {
  onDryRun: (preset: BatchPreset) => Promise<DryRunResult>;
  onExecute: (preset: BatchPreset, limit?: number) => void;
  isExecuting: boolean;
}

const PRESETS: { value: BatchPreset; label: string; description: string }[] = [
  { value: "core", label: "핵심 교과", description: "국영수 + 한국사 + 인기 탐구과목" },
  { value: "math", label: "수학", description: "수학 전체 과목 및 난이도 조합" },
  { value: "english", label: "영어", description: "영어 전체 과목 및 난이도 조합" },
  { value: "science", label: "과학탐구", description: "물리/화학/생명/지구과학" },
  { value: "all", label: "전체", description: "모든 교과/과목 조합" },
];

function BatchControlPanelComponent({
  onDryRun,
  onExecute,
  isExecuting,
}: BatchControlPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<BatchPreset>("core");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [limit, setLimit] = useState(5);

  const handleDryRun = useCallback(async () => {
    setIsDryRunning(true);
    setDryRunResult(null);
    try {
      const result = await onDryRun(selectedPreset);
      setDryRunResult(result);
    } finally {
      setIsDryRunning(false);
    }
  }, [selectedPreset, onDryRun]);

  const handleExecute = useCallback(() => {
    onExecute(selectedPreset, limitEnabled ? limit : undefined);
  }, [selectedPreset, limitEnabled, limit, onExecute]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/50 p-2">
          <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-h3 text-gray-900 dark:text-gray-100">배치 처리</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            콜드 스타트 콘텐츠 사전 생성
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* 프리셋 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            프리셋 선택
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  setSelectedPreset(preset.value);
                  setDryRunResult(null);
                }}
                disabled={isExecuting}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border text-left transition-colors",
                  selectedPreset === preset.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    selectedPreset === preset.value
                      ? "text-indigo-700 dark:text-indigo-300"
                      : "text-gray-900 dark:text-gray-100"
                  )}
                >
                  {preset.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 옵션 */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={limitEnabled}
              onChange={(e) => setLimitEnabled(e.target.checked)}
              disabled={isExecuting}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              처리 개수 제한
            </span>
          </label>
          {limitEnabled && (
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
              disabled={isExecuting}
              className={cn(
                "w-20 px-3 py-1.5 text-sm rounded-lg border",
                "border-gray-300 dark:border-gray-600",
                "bg-white dark:bg-gray-700",
                "text-gray-900 dark:text-gray-100",
                "focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              )}
            />
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDryRun}
            disabled={isDryRunning || isExecuting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              "border border-gray-300 dark:border-gray-600",
              "text-gray-700 dark:text-gray-300",
              "hover:bg-gray-50 dark:hover:bg-gray-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isDryRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            드라이런
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              "bg-indigo-600 text-white",
              "hover:bg-indigo-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isExecuting ? "실행 중..." : "배치 실행"}
          </button>
        </div>

        {/* 드라이런 결과 */}
        {dryRunResult && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              드라이런 결과
            </h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">대상:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {dryRunResult.targets.length}개
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">예상 시간:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  약 {dryRunResult.estimatedDurationMinutes}분
                </span>
              </div>
            </div>
            {dryRunResult.targets.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  {dryRunResult.targets.slice(0, 10).map((target, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="text-gray-400">{idx + 1}.</span>
                      <span>{target.subjectCategory}</span>
                      {target.subject && (
                        <>
                          <span className="text-gray-400">&gt;</span>
                          <span>{target.subject}</span>
                        </>
                      )}
                      {target.difficulty && (
                        <span className="text-indigo-500">({target.difficulty})</span>
                      )}
                      {target.contentType && (
                        <span className="text-cyan-500">[{target.contentType}]</span>
                      )}
                    </div>
                  ))}
                  {dryRunResult.targets.length > 10 && (
                    <div className="text-gray-400">
                      ... 외 {dryRunResult.targets.length - 10}개
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const BatchControlPanel = memo(BatchControlPanelComponent);
export default BatchControlPanel;
