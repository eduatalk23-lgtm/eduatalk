/**
 * 재조정 히스토리 컴포넌트
 * 
 * 재조정 이력을 표시하고 분석합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { History, TrendingUp, AlertCircle, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { getRescheduleHistory } from "@/app/(student)/actions/plan-groups/rescheduleHistory";
import { analyzeReschedulePatterns, analyzeRescheduleEffects } from "@/lib/reschedule/patternAnalyzer";
import type { RescheduleHistoryResult } from "@/app/(student)/actions/plan-groups/rescheduleHistory";
import type { ReschedulePatternAnalysis, RescheduleEffectAnalysis } from "@/lib/reschedule/patternAnalyzer";

type RescheduleHistoryProps = {
  groupId: string;
};

export function RescheduleHistory({ groupId }: RescheduleHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RescheduleHistoryResult | null>(null);
  const [patternAnalysis, setPatternAnalysis] = useState<ReschedulePatternAnalysis | null>(null);
  const [effectAnalysis, setEffectAnalysis] = useState<RescheduleEffectAnalysis | null>(null);

  useEffect(() => {
    loadHistory();
  }, [groupId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getRescheduleHistory(groupId);
      setHistory(result);

      // 패턴 분석
      const patterns = analyzeReschedulePatterns(result.logs);
      setPatternAnalysis(patterns);

      // 효과 분석
      const effects = analyzeRescheduleEffects(result.logs);
      setEffectAnalysis(effects);
    } catch (error) {
      console.error("재조정 히스토리 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col gap-4 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-gray-600">히스토리를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!history || history.logs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <div className="mx-auto flex flex-col gap-4">
          <History className="mx-auto h-12 w-12 text-gray-400" />
          <p className="text-sm text-gray-600">재조정 이력이 없습니다.</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "rolled_back":
        return <RotateCcw className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "완료";
      case "failed":
        return "실패";
      case "rolled_back":
        return "롤백됨";
      default:
        return "대기 중";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-600">총 재조정</p>
          <p className="text-2xl font-bold text-gray-900">
            {history.statistics.totalReschedules}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-700">성공</p>
          <p className="text-2xl font-bold text-green-600">
            {history.statistics.successfulReschedules}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">실패</p>
          <p className="text-2xl font-bold text-red-600">
            {history.statistics.failedReschedules}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-700">롤백</p>
          <p className="text-2xl font-bold text-orange-600">
            {history.statistics.rolledBackReschedules}
          </p>
        </div>
      </div>

      {/* 효과 분석 */}
      {effectAnalysis && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <TrendingUp className="h-5 w-5" />
            재조정 효과 분석
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-600">성공률</p>
              <p className="text-2xl font-bold text-gray-900">
                {effectAnalysis.successRate}%
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-600">롤백률</p>
              <p className="text-2xl font-bold text-gray-900">
                {effectAnalysis.rollbackRate}%
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-600">평균 간격</p>
              <p className="text-2xl font-bold text-gray-900">
                {effectAnalysis.averageIntervalDays}일
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              {effectAnalysis.effectivenessDescription}
            </p>
          </div>
        </div>
      )}

      {/* 패턴 분석 */}
      {patternAnalysis && patternAnalysis.suggestions.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="font-semibold text-blue-900">개선 제안</h3>
          <div className="flex flex-col gap-3">
            {patternAnalysis.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="rounded-lg border border-blue-300 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-1 flex-col gap-1">
                    <h4 className="font-medium text-gray-900">
                      {suggestion.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {suggestion.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이력 목록 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">재조정 이력</h3>
        <div className="flex flex-col gap-3">
          {history.logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="font-medium text-gray-900">
                      {getStatusLabel(log.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(log.created_at), "yyyy년 M월 d일 HH:mm")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
                    <div>
                      <span className="text-xs">기존 플랜:</span>{" "}
                      <span className="font-medium">{log.plans_before_count}개</span>
                    </div>
                    <div>
                      <span className="text-xs">변경 후:</span>{" "}
                      <span className="font-medium text-blue-600">
                        {log.plans_after_count}개
                      </span>
                    </div>
                    <div>
                      <span className="text-xs">변화:</span>{" "}
                      <span
                        className={`font-medium ${
                          log.plans_after_count - log.plans_before_count >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {log.plans_after_count - log.plans_before_count >= 0
                          ? "+"
                          : ""}
                        {log.plans_after_count - log.plans_before_count}개
                      </span>
                    </div>
                    {log.affected_dates && log.affected_dates.length > 0 && (
                      <div>
                        <span className="text-xs">영향 날짜:</span>{" "}
                        <span className="font-medium">
                          {log.affected_dates.length}일
                        </span>
                      </div>
                    )}
                  </div>
                  {log.error_message && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                      <p className="text-xs text-red-800">{log.error_message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

