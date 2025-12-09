/**
 * 재조정 로그 상세 컴포넌트
 * 
 * 재조정 로그의 상세 정보를 표시합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RescheduleLogDetailProps = {
  logId: string;
};

export function RescheduleLogDetail({ logId }: RescheduleLogDetailProps) {
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<any>(null);
  const [histories, setHistories] = useState<any[]>([]);

  useEffect(() => {
    loadDetail();
  }, [logId]);

  const loadDetail = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      // 로그 상세 조회
      const { data: logData, error: logError } = await supabase
        .from("reschedule_log")
        .select("*")
        .eq("id", logId)
        .single();

      if (logError) throw logError;

      // 관련 히스토리 조회
      const { data: historyData, error: historyError } = await supabase
        .from("plan_history")
        .select("*")
        .eq("reschedule_log_id", logId)
        .order("created_at", { ascending: false });

      if (historyError) {
        console.error("[RescheduleLogDetail] 히스토리 조회 실패:", historyError);
      }

      setLog(logData);
      setHistories(historyData || []);
    } catch (error) {
      console.error("[RescheduleLogDetail] 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">로그를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="space-y-4">
        {/* 조정된 콘텐츠 */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            조정된 콘텐츠
          </h4>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <pre className="overflow-auto text-xs text-gray-700">
              {JSON.stringify(log.adjusted_contents, null, 2)}
            </pre>
          </div>
        </div>

        {/* 관련 히스토리 */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            관련 플랜 히스토리 ({histories.length}개)
          </h4>
          {histories.length === 0 ? (
            <p className="text-sm text-gray-500">히스토리가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {histories.map((history) => (
                <div
                  key={history.id}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="text-xs text-gray-600">
                    플랜 ID: {history.plan_id}
                    {history.adjustment_type && (
                      <span className="ml-2">
                        • 조정 유형: {history.adjustment_type}
                      </span>
                    )}
                    <span className="ml-2">
                      • {new Date(history.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

